import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { bondingCurvePoints, spotPrice } from '../utils/coingameApi';

function FC({ amount, decimals = 2 }) {
  const n = Number(amount ?? 0);
  return (
    <span>
      {n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>FC</span>
    </span>
  );
}

function StatRow({ wallet, ownCoin }) {
  const price = ownCoin ? spotPrice(ownCoin.tokens_minted, ownCoin.base_price) : 0;
  const marketCap = price * (ownCoin?.tokens_minted ?? 0);

  return (
    <div className="cg-stat-row">
      <div className="cg-stat-card">
        <div className="cg-stat-label">FC Balance</div>
        <div className="cg-stat-value accent" style={{ fontFamily: 'var(--cg-font-mono)', fontSize: '1.1rem' }}>
          <FC amount={wallet?.fc_balance} />
        </div>
      </div>
      <div className="cg-stat-card">
        <div className="cg-stat-label">Login Streak</div>
        <div className="cg-stat-value">{wallet?.login_streak ?? 0} <span style={{ fontSize: '0.7em', color: 'var(--cg-text-3)' }}>days</span></div>
      </div>
      <div className="cg-stat-card">
        <div className="cg-stat-label">Coin Price</div>
        <div className="cg-stat-value" style={{ fontFamily: 'var(--cg-font-mono)', fontSize: '0.95rem' }}>
          <FC amount={price} decimals={6} />
        </div>
        {ownCoin && (
          <div className="cg-stat-sub">
            <span className={`cg-badge cg-badge-${ownCoin.status}`}>{ownCoin.status}</span>
            <span style={{ marginLeft: '0.4rem' }}>{ownCoin.coin_name || 'Your coin'}</span>
            <span style={{ marginLeft: '0.4rem' }}>{Number(ownCoin.tokens_minted).toLocaleString()} {ownCoin.coin_name || 'Your coin'} minted</span>
          </div>
        )}
      </div>
      <div className="cg-stat-card">
        <div className="cg-stat-label">Market Cap</div>
        <div className="cg-stat-value" style={{ fontFamily: 'var(--cg-font-mono)', fontSize: '0.95rem' }}>
          <FC amount={marketCap} />
        </div>
      </div>
    </div>
  );
}

function DailyClaimCard({ wallet, onClaim }) {
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const canClaim = (() => {
    if (!wallet?.last_daily_claim_at) return true;
    const last = new Date(wallet.last_daily_claim_at);
    return last.toDateString() !== new Date().toDateString();
  })();

  async function handleClaim() {
    setBusy(true); setErr('');
    try {
      const r = await onClaim();
      setResult(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cg-claim-card">
      <div>
        <div style={{ fontFamily: 'var(--cg-font-display)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
          Daily Reward
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--cg-text-2)' }}>
          {canClaim
            ? `Streak: ${wallet?.login_streak ?? 0} days · Claim now`
            : 'Already claimed · Next: tomorrow'}
        </div>
        {result && (
          <div style={{ fontSize: '0.8rem', color: 'var(--cg-positive)', marginTop: '0.3rem', fontFamily: 'var(--cg-font-mono)' }}>
            +{result.reward} FC · Streak {result.streak}
          </div>
        )}
        {err && (
          <div style={{ fontSize: '0.8rem', color: 'var(--cg-danger)', marginTop: '0.3rem' }}>{err}</div>
        )}
      </div>
      <button
        className="cg-btn cg-btn-primary"
        onClick={handleClaim}
        disabled={!canClaim || busy}
      >
        {busy ? 'Claiming…' : '+ Claim'}
      </button>
    </div>
  );
}

function BondingCurveCard({ coin }) {
  if (!coin) return null;
  const max = Math.max(coin.tokens_minted * 2, 10000);
  const points = bondingCurvePoints(max, coin.base_price, 80);
  const price = spotPrice(coin.tokens_minted, coin.base_price);
  const coinName = coin.coin_name || coin.profiles?.username || 'coin';

  return (
    <div className="cg-chart-wrap">
      <div className="cg-chart-header">
        <span className="cg-chart-title">Bonding Curve</span>
        <span className="cg-chart-price">{price.toFixed(6)} FC/{coinName}</span>
      </div>
      <div style={{ padding: '0.75rem 0.5rem 0.5rem' }}>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cgCurve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#17f500" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#17f500" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="tokens" hide />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [`${v.toFixed(8)} FC`, 'Price']}
              labelFormatter={(v) => `${Number(v).toLocaleString()} ${coinName}`}
              contentStyle={{
                background: 'rgba(17,17,17,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                color: '#f0f0f0',
              }}
            />
            <Area type="monotone" dataKey="price" stroke="#17f500" fill="url(#cgCurve)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)', padding: '0 0.5rem', marginTop: '0.2rem' }}>
          <span>0</span>
          <span style={{ color: 'var(--cg-accent)' }}>▲ {Number(coin.tokens_minted).toLocaleString()}</span>
          <span>{Number(max).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function HoldingsCard({ holdings }) {
  return (
    <div className="cg-table" style={{ marginBottom: '1.5rem' }}>
      <div className="cg-table-header">
        <span className="cg-table-title">My Holdings</span>
        <Link to="/coingame/market" className="cg-section-link">Market →</Link>
      </div>
      {holdings.length === 0 ? (
        <div className="cg-empty">
          <div className="cg-empty-icon">◈</div>
          <div className="cg-empty-title">No holdings yet</div>
          <div className="cg-empty-desc">Buy coins from other users in the market</div>
        </div>
      ) : (
        holdings.slice(0, 6).map((h) => {
          const coin = h.coingame_coins;
          const profile = coin?.profiles;
          const coinName = coin?.coin_name || profile?.username || 'Unnamed coin';
          const price = spotPrice(coin?.tokens_minted ?? 0, coin?.base_price ?? 1);
          const value = price * h.tokens_held;
          const pnl = value - h.avg_buy_price * h.tokens_held;
          return (
            <div key={`${h.holder_user_id}-${h.coin_id}`} className="cg-row">
              <div className="cg-avatar cg-avatar-sm" style={{ background: 'var(--cg-accent-soft)', border: '1px solid var(--cg-accent-border)', color: 'var(--cg-accent)' }}>
                {(profile?.username?.[0] ?? '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {coinName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>
                  @{profile?.username ?? '...'} · {Number(h.tokens_held).toLocaleString()} {coinName}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--cg-font-mono)', fontSize: '0.875rem', fontWeight: 500 }}>
                  <FC amount={value} />
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--cg-font-mono)', color: pnl >= 0 ? 'var(--cg-positive)' : 'var(--cg-danger)' }}>
                  {pnl >= 0 ? '+' : ''}<FC amount={pnl} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function EconomyStrip({ economy }) {
  if (!economy) return null;
  return (
    <div className="cg-economy-strip">
      {[
        { label: 'Minted', value: Number(economy.total_supply_minted).toLocaleString(), unit: 'coins' },
        { label: 'Burned', value: Number(economy.total_burned).toLocaleString(undefined, { maximumFractionDigits: 0 }), unit: 'FC' },
        { label: 'Prize Pool', value: Number(economy.prize_pool_fc).toLocaleString(undefined, { maximumFractionDigits: 0 }), unit: 'FC', accent: true },
      ].map((item) => (
        <div key={item.label} className="cg-economy-cell">
          <div className="cg-economy-cell-label">{item.label}</div>
          <div className="cg-economy-cell-value" style={item.accent ? { color: 'var(--cg-positive)' } : {}}>
            {item.value}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--cg-text-3)', marginTop: '0.15rem', fontFamily: 'var(--cg-font-mono)' }}>{item.unit}</div>
        </div>
      ))}
    </div>
  );
}

export default function CoingamePage() {
  const coingameClaimDaily = useFinanceStore((s) => s.coingameClaimDaily);
  const wallet = useFinanceStore((s) => s.coingameWallet);
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const holdings = useFinanceStore((s) => s.coingameHoldings);
  const economy = useFinanceStore((s) => s.coingameEconomy);
  const status = useFinanceStore((s) => s.coingameStatus);
  const error = useFinanceStore((s) => s.coingameError);

  const loading = status === 'loading' && !wallet;

  return (
    <div className="cg-page">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--cg-font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
          Home
        </h1>
        <p style={{ color: 'var(--cg-text-3)', fontSize: '0.875rem' }}>
          Virtual social economy · Fully separate from real finances
        </p>
      </div>

      {error && <div className="cg-error">{error}</div>}

      {loading ? (
        <div className="cg-stat-row">
          {[0, 1, 2, 3].map((i) => <div key={i} className="cg-skeleton" style={{ height: 80 }} />)}
        </div>
      ) : (
        <>
          <StatRow wallet={wallet} ownCoin={ownCoin} />
          <DailyClaimCard wallet={wallet} onClaim={coingameClaimDaily} />
          <BondingCurveCard coin={ownCoin} />
          <HoldingsCard holdings={holdings} />
          <EconomyStrip economy={economy} />

          {/* Quick nav */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            {[
              { to: '/coingame/market',      icon: '◈', label: 'Market' },
              { to: '/coingame/leaderboard', icon: '▲', label: 'Rankings' },
              { to: '/coingame/history',     icon: '◎', label: 'History' },
            ].map(({ to, icon, label }) => (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '1rem',
                  background: 'var(--cg-surface)',
                  border: '1px solid var(--cg-border)',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'var(--cg-text-2)',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cg-surface-raised)'; e.currentTarget.style.color = 'var(--cg-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cg-surface)'; e.currentTarget.style.color = 'var(--cg-text-2)'; }}
              >
                <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
