import { useEffect, useMemo, useState } from 'react';
import { searchProfilesByUsername } from '../utils/profilesApi';
import { useFinanceStore } from '../store/useFinanceStore';

const TABS = [
  ['bots', 'Liquidity Bots'],
  ['health', 'Market Health'],
  ['reserve', 'Reserve'],
  ['coins', 'Coin Controls'],
  ['admins', 'Admins'],
  ['logs', 'Logs'],
];

function FC({ amount, decimals = 2 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>FC</span>
    </span>
  );
}

function timeAgo(value) {
  if (!value) return 'Never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NumberField({ label, value, onChange, step = '0.01', min = '0' }) {
  return (
    <label className="cg-admin-field">
      <span>{label}</span>
      <input type="number" step={step} min={min} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function BotVariablesInfo() {
  const items = [
    ['Min trade pct', 'Lower bound for trade size as a fraction of minted supply. Higher means every bot trade starts larger.'],
    ['Max trade pct', 'Upper bound for trade size as a fraction of minted supply. This is the main aggression dial.'],
    ['Min tokens', 'Absolute minimum trade size. Useful for young coins where percentage-based trades would be tiny.'],
    ['Tick interval seconds', 'Minimum time between runs for that bot. Lower values make that specific bot wake up more often.'],
    ['Trades per coin/day', 'Hard limit for each bot on each coin per UTC day. Higher keeps charts moving longer.'],
    ['Max price impact', 'Maximum allowed price move per bot trade. Higher allows bigger jumps; lower keeps movement subtle.'],
    ['Inactive hours', 'How long a coin must go without real user trades before the bot can step in. Use 0 for always eligible.'],
    ['Daily volume cap', 'Maximum bot volume compared with real market volume after the daily floor is spent. 0.5 means 50%.'],
    ['Daily floor FC', 'Free daily bot volume before the percentage cap applies. This lets empty markets bootstrap.'],
  ];

  return (
    <div className="cg-admin-info-panel">
      <div>
        <strong>Bot variables</strong>
        <span>Use these as controls for frequency, size, and safety.</span>
      </div>
      <div className="cg-admin-info-grid">
        {items.map(([label, description]) => (
          <div key={label}>
            <strong>{label}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BotsTab({ config, onSave }) {
  const global = config?.global || {};
  const bots = useMemo(() => config?.bots || [], [config]);
  const [draft, setDraft] = useState(global);
  const [botDrafts, setBotDrafts] = useState(bots);

  useEffect(() => {
    setDraft(global);
    setBotDrafts(bots);
  }, [config, bots]);

  const set = (key, value) => setDraft((state) => ({ ...state, [key]: value }));
  const setBot = (botId, key, value) => {
    setBotDrafts((state) => state.map((bot) => (
      bot.bot_id === botId ? { ...bot, [key]: value } : bot
    )));
  };

  async function save() {
    await onSave({
      enabled: Boolean(draft.enabled),
      inactivity_threshold_h: Number(draft.inactivity_threshold_h),
      max_bot_daily_volume_pct: Number(draft.max_bot_daily_volume_pct),
      daily_volume_floor_fc: Number(draft.daily_volume_floor_fc),
      reserve_low_threshold_fc: Number(draft.reserve_low_threshold_fc),
      bot_profiles: botDrafts.map((bot) => ({
        bot_id: bot.bot_id,
        bot_name: bot.bot_name,
        enabled: Boolean(bot.enabled),
        min_trade_pct: Number(bot.min_trade_pct),
        max_trade_pct: Number(bot.max_trade_pct),
        min_tokens_abs: Number(bot.min_tokens_abs),
        tick_interval_seconds: Number(bot.tick_interval_seconds),
        max_trades_per_coin_day: Number(bot.max_trades_per_coin_day),
        max_price_impact_pct: Number(bot.max_price_impact_pct),
      })),
    });
  }

  return (
    <div className="cg-admin-panel">
      <div className="cg-admin-toolbar">
        <label className="cg-admin-toggle">
          <input type="checkbox" checked={Boolean(draft.enabled)} onChange={(event) => set('enabled', event.target.checked)} />
          <span>Global bot system</span>
        </label>
        <div className="cg-admin-muted">Last tick: {timeAgo(global.last_tick_at)}</div>
      </div>

      <div className="cg-admin-form-grid">
        <NumberField label="Inactive hours" value={draft.inactivity_threshold_h} onChange={(v) => set('inactivity_threshold_h', v)} step="1" />
        <NumberField label="Daily volume cap" value={draft.max_bot_daily_volume_pct} onChange={(v) => set('max_bot_daily_volume_pct', v)} step="0.01" />
        <NumberField label="Daily floor FC" value={draft.daily_volume_floor_fc} onChange={(v) => set('daily_volume_floor_fc', v)} step="100" />
        <NumberField label="Reserve low threshold" value={draft.reserve_low_threshold_fc} onChange={(v) => set('reserve_low_threshold_fc', v)} step="100" />
      </div>

      <div className="cg-bot-profile-grid">
        {botDrafts.map((bot) => (
          <div className={`cg-bot-profile-card ${bot.bot_id}`} key={bot.bot_id}>
            <div className="cg-bot-profile-head">
              <label>
                <input type="checkbox" checked={Boolean(bot.enabled)} onChange={(event) => setBot(bot.bot_id, 'enabled', event.target.checked)} />
                <strong>{bot.bot_name}</strong>
              </label>
              <span>{bot.bot_id}</span>
            </div>
            <div className="cg-admin-form-grid compact">
              <NumberField label="Min trade pct" value={bot.min_trade_pct} onChange={(v) => setBot(bot.bot_id, 'min_trade_pct', v)} step="0.0001" />
              <NumberField label="Max trade pct" value={bot.max_trade_pct} onChange={(v) => setBot(bot.bot_id, 'max_trade_pct', v)} step="0.0001" />
              <NumberField label="Min tokens" value={bot.min_tokens_abs} onChange={(v) => setBot(bot.bot_id, 'min_tokens_abs', v)} step="1" />
              <NumberField label="Tick interval seconds" value={bot.tick_interval_seconds} onChange={(v) => setBot(bot.bot_id, 'tick_interval_seconds', v)} step="1" min="1" />
              <NumberField label="Trades per coin/day" value={bot.max_trades_per_coin_day} onChange={(v) => setBot(bot.bot_id, 'max_trades_per_coin_day', v)} step="1" min="1" />
              <NumberField label="Max price impact" value={bot.max_price_impact_pct} onChange={(v) => setBot(bot.bot_id, 'max_price_impact_pct', v)} step="0.01" />
            </div>
            <div className="cg-admin-muted">Last tick: {timeAgo(bot.last_tick_at)}</div>
          </div>
        ))}
      </div>

      <BotVariablesInfo />

      <button className="cg-btn cg-btn-primary" onClick={save}>Save Settings</button>
    </div>
  );
}

function HealthTab({ health }) {
  const botPct = health?.bot_volume_pct == null ? null : Number(health.bot_volume_pct) * 100;
  return (
    <div className="cg-admin-grid">
      <div className="cg-stat-card"><div className="cg-stat-label">Market 24h</div><div className="cg-stat-value"><FC amount={health?.market_volume_24h} /></div></div>
      <div className="cg-stat-card"><div className="cg-stat-label">Bot 24h</div><div className="cg-stat-value"><FC amount={health?.bot_volume_24h} /></div></div>
      <div className="cg-stat-card"><div className="cg-stat-label">Bot share</div><div className="cg-stat-value">{botPct == null ? 'Floor' : `${botPct.toFixed(1)}%`}</div></div>
      <div className="cg-stat-card"><div className="cg-stat-label">Inactive coins</div><div className="cg-stat-value">{health?.inactive_coins ?? 0}</div></div>
      <div className="cg-stat-card"><div className="cg-stat-label">Reserve</div><div className="cg-stat-value"><FC amount={health?.reserve_fc} /></div></div>
    </div>
  );
}

function ReserveTab({ health, onSave }) {
  const [amount, setAmount] = useState('');
  useEffect(() => setAmount(String(health?.reserve_fc ?? '')), [health]);
  const low = Number(health?.reserve_fc ?? 0) < Number(health?.reserve_low_threshold_fc ?? 0);
  return (
    <div className="cg-admin-panel">
      <div className="cg-admin-reserve">
        <span>System reserve</span>
        <strong><FC amount={health?.reserve_fc} /></strong>
      </div>
      {low && <div className="cg-error">Reserve is below the low threshold. Buys will be disabled.</div>}
      <div className="cg-admin-inline">
        <input className="cg-input" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
        <button className="cg-btn cg-btn-primary" onClick={() => onSave(Number(amount))}>Set Reserve</button>
      </div>
    </div>
  );
}

function CoinsTab({ coins, onToggle }) {
  return (
    <div className="cg-admin-table-wrap">
      <table className="cg-admin-table">
        <thead><tr><th>Coin</th><th>Status</th><th>Minted</th><th>Bot</th><th>Last bot trade</th><th>Today</th></tr></thead>
        <tbody>
          {(coins || []).map((coin) => (
            <tr key={coin.coin_id}>
              <td>{coin.coin_name}</td>
              <td>{coin.status}</td>
              <td>{Number(coin.tokens_minted ?? 0).toLocaleString()}</td>
              <td><input type="checkbox" checked={Boolean(coin.bot_enabled)} onChange={(event) => onToggle(coin.coin_id, event.target.checked)} /></td>
              <td>{timeAgo(coin.last_bot_trade_at)}</td>
              <td>{coin.bot_trades_today ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminsTab({ admins, currentUserId, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const rows = await searchProfilesByUsername(query, currentUserId);
      if (!cancelled) setResults(rows);
    }
    run().catch(() => setResults([]));
    return () => { cancelled = true; };
  }, [query, currentUserId]);

  return (
    <div className="cg-admin-panel">
      <div className="cg-admin-list">
        {(admins || []).map((admin) => (
          <div className="cg-admin-list-row" key={admin.user_id}>
            <div><strong>@{admin.username || admin.email || admin.user_id}</strong><span>{admin.display_name || 'Admin user'}</span></div>
            <button className="cg-btn cg-btn-secondary" disabled={admin.user_id === currentUserId} onClick={() => onRemove(admin.user_id)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="cg-admin-search">
        <input className="cg-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username" />
        {results.map((profile) => (
          <button className="cg-admin-result" key={profile.user_id} onClick={() => onAdd(profile.user_id)}>
            <span>@{profile.username}</span>
            <small>{profile.display_name || profile.user_id}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ logs, coins, onRefresh }) {
  const [coinId, setCoinId] = useState('');
  return (
    <div className="cg-admin-panel">
      <div className="cg-admin-toolbar">
        <select className="cg-input" value={coinId} onChange={(event) => setCoinId(event.target.value)}>
          <option value="">All coins</option>
          {(coins || []).map((coin) => <option key={coin.coin_id} value={coin.coin_id}>{coin.coin_name}</option>)}
        </select>
        <button className="cg-btn cg-btn-secondary" onClick={() => onRefresh(coinId || null)}>Refresh</button>
      </div>
      <div className="cg-admin-table-wrap">
        <table className="cg-admin-table">
          <thead><tr><th>Time</th><th>Bot</th><th>Coin</th><th>Action</th><th>Reason</th><th>Tokens</th><th>FC</th></tr></thead>
          <tbody>
            {(logs || []).map((log) => (
              <tr key={log.id}>
                <td>{timeAgo(log.tick_at)}</td>
                <td>{log.bot_name || log.bot_id || 'System'}</td>
                <td>{log.coin_name || 'System'}</td>
                <td><span className={`cg-admin-action ${log.action}`}>{log.action}</span></td>
                <td>{log.reason || '-'}</td>
                <td>{Number(log.tokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td>{Number(log.fc_amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CoingameAdminPage() {
  const user = useFinanceStore((s) => s.supabaseUser);
  const status = useFinanceStore((s) => s.coingameAdminStatus);
  const error = useFinanceStore((s) => s.coingameAdminError);
  const config = useFinanceStore((s) => s.coingameBotConfig);
  const health = useFinanceStore((s) => s.coingameMarketHealth);
  const logs = useFinanceStore((s) => s.coingameBotLogs);
  const admins = useFinanceStore((s) => s.coingameAdminUsers);
  const loadAdmin = useFinanceStore((s) => s.loadCoingameAdmin);
  const refreshHealth = useFinanceStore((s) => s.refreshMarketHealth);
  const updateConfig = useFinanceStore((s) => s.updateBotConfig);
  const toggleCoin = useFinanceStore((s) => s.toggleBotCoin);
  const setReserve = useFinanceStore((s) => s.setBotReserve);
  const addAdmin = useFinanceStore((s) => s.addCoingameAdmin);
  const removeAdmin = useFinanceStore((s) => s.removeCoingameAdmin);
  const refreshLogs = useFinanceStore((s) => s.refreshBotLogs);
  const [tab, setTab] = useState('bots');
  const coins = useMemo(() => config?.coins || [], [config]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  useEffect(() => {
    const timer = setInterval(refreshHealth, 60000);
    return () => clearInterval(timer);
  }, [refreshHealth]);

  if (status === 'loading' && !config) {
    return <div className="cg-page"><div className="cg-skeleton" style={{ height: 420 }} /></div>;
  }

  if (status === 'error' && !config) {
    return <div className="cg-page"><div className="cg-error">{error || 'Admin access required'}</div></div>;
  }

  return (
    <div className="cg-page cg-admin-page">
      <div className="cg-page-header">
        <div>
          <div className="cg-kicker">SYSTEM LIQUIDITY</div>
          <h1>Coingame Admin</h1>
        </div>
      </div>

      <div className="cg-admin-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {error && <div className="cg-error">{error}</div>}
      {tab === 'bots' && <BotsTab config={config} onSave={updateConfig} />}
      {tab === 'health' && <HealthTab health={health} />}
      {tab === 'reserve' && <ReserveTab health={health} onSave={setReserve} />}
      {tab === 'coins' && <CoinsTab coins={coins} onToggle={toggleCoin} />}
      {tab === 'admins' && <AdminsTab admins={admins} currentUserId={user?.id} onAdd={addAdmin} onRemove={removeAdmin} />}
      {tab === 'logs' && <LogsTab logs={logs} coins={coins} onRefresh={refreshLogs} />}
    </div>
  );
}
