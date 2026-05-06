import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import { buyCost, searchCoins, sellProceeds, spotPrice } from '../utils/coingameApi';

function FC({ amount, decimals = 4 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>FC</span>
    </span>
  );
}

function CoinCard({ coin, ownHolding, isOwnCoin, onBuy, onSell }) {
  const profile = coin.profiles;
  const coinName = coin.coin_name || profile?.username || 'Unnamed coin';
  const price = spotPrice(coin.tokens_minted, coin.base_price);
  const marketCap = price * coin.tokens_minted;
  const owned = ownHolding?.tokens_held ?? 0;

  return (
    <div className="cg-coin-card">
      <div className="cg-coin-card-image">
        <div className="cg-coin-card-avatar">
          {(profile?.username?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="cg-coin-card-badge">
          <span className={`cg-badge cg-badge-${coin.status}`}>{coin.status}</span>
        </div>
      </div>

      <div className="cg-coin-card-body">
        <div className="cg-coin-card-name">{coinName}</div>
        <div className="cg-coin-card-handle" style={{ fontFamily: 'var(--cg-font-mono)' }}>
          @{profile?.username ?? '...'} · {Number(coin.tokens_minted).toLocaleString()} {coinName} minted
        </div>
        {owned > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--cg-accent)', fontFamily: 'var(--cg-font-mono)' }}>
            {Number(owned).toLocaleString()} {coinName} held
          </div>
        )}
        <div className="cg-coin-card-footer">
          <span className="cg-coin-card-cap" style={{ fontSize: '0.78rem' }}>
            <FC amount={marketCap} decimals={2} />
          </span>
          <span style={{ fontFamily: 'var(--cg-font-mono)', fontSize: '0.7rem', color: 'var(--cg-text-3)' }}>
            {price.toFixed(4)} FC/{coinName}
          </span>
        </div>
      </div>

      {!isOwnCoin && (
        <div className="cg-coin-card-actions">
          <Link className="cg-btn cg-btn-secondary cg-btn-sm" style={{ flex: 1, justifyContent: 'center' }} to={`/coingame/coin/${coin.coin_id}`}>
            Open
          </Link>
          <button className="cg-btn cg-btn-primary cg-btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onBuy(coin)}>
            Buy
          </button>
          {owned > 0 && (
            <button className="cg-btn cg-btn-danger cg-btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSell(coin)}>
              Sell
            </button>
          )}
        </div>
      )}
      {isOwnCoin && (
        <div className="cg-coin-card-actions">
          <Link className="cg-btn cg-btn-secondary cg-btn-sm" style={{ flex: 1, justifyContent: 'center' }} to={`/coingame/coin/${coin.coin_id}`}>
            Open coin
          </Link>
        </div>
      )}
    </div>
  );
}

function TradeModal({ coin, mode, ownHolding, onClose, onConfirm }) {
  const [tokens, setTokens] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const maxSell = ownHolding?.tokens_held ?? 0;
  const coinName = coin.coin_name || coin.profiles?.username || 'coin';

  const t = parseFloat(tokens) || 0;
  const preview = mode === 'buy'
    ? buyCost(coin.tokens_minted, t, coin.base_price)
    : sellProceeds(coin.tokens_minted, t, coin.base_price);
  const fee = preview * 0.01;
  const net = mode === 'buy' ? preview + fee : preview - fee;

  async function handleSubmit() {
    if (t <= 0) { setErr('Enter a positive amount'); return; }
    if (mode === 'sell' && t > maxSell) { setErr(`Max sell: ${maxSell} ${coinName}`); return; }
    setBusy(true); setErr('');
    try {
      await onConfirm(coin.coin_id, t);
      onClose();
    } catch (e) {
      setErr(e.message ?? 'Transaction failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cg-overlay" onClick={onClose}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cg-modal-header">
          <span className="cg-modal-title">
            {mode === 'buy' ? 'Buy' : 'Sell'} {coin.coin_name || `@${coin.profiles?.username}`}
          </span>
          <button className="cg-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="cg-modal-body">
          <label className="cg-label">{coinName}</label>
          <input
            className="cg-input"
            type="number"
            min="0"
            step="1"
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            placeholder="0"
            autoFocus
          />
          {mode === 'sell' && maxSell > 0 && (
            <button
              type="button"
              style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: 'var(--cg-accent)', fontSize: '0.78rem', cursor: 'pointer', padding: 0, fontFamily: 'var(--cg-font-mono)' }}
              onClick={() => setTokens(String(maxSell))}
            >
              Max: {Number(maxSell).toLocaleString()} {coinName}
            </button>
          )}

          {t > 0 && (
            <div className="cg-preview-box">
              <div className="cg-preview-row">
                <span className="cg-preview-row-label">{mode === 'buy' ? 'Cost' : 'Proceeds'}</span>
                <span className="cg-preview-row-value"><FC amount={preview} /></span>
              </div>
              <div className="cg-preview-row">
                <span className="cg-preview-row-label">Fee (1%)</span>
                <span className="cg-preview-row-value" style={{ color: 'var(--cg-text-3)' }}>{fee.toFixed(4)} FC</span>
              </div>
              <hr className="cg-preview-divider" />
              <div className="cg-preview-row cg-preview-total">
                <span className="cg-preview-row-label">{mode === 'buy' ? 'Total charge' : 'You receive'}</span>
                <span className="cg-preview-row-value"><FC amount={net} /></span>
              </div>
            </div>
          )}

          {err && <div className="cg-error">{err}</div>}
        </div>

        <div className="cg-modal-footer">
          <button
            className={`cg-btn ${mode === 'buy' ? 'cg-btn-primary' : 'cg-btn-danger'}`}
            style={{ justifyContent: 'center' }}
            onClick={handleSubmit}
            disabled={busy || t <= 0}
          >
            {busy ? 'Processing…' : mode === 'buy' ? 'Confirm Buy' : 'Confirm Sell'}
          </button>
          <button className="cg-btn cg-btn-secondary" style={{ justifyContent: 'center' }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'strong', label: 'Strong' },
  { key: 'active', label: 'Active' },
  { key: 'starter', label: 'Starter' },
];

export default function CoingameMarketPage() {
  const coingameBuy = useFinanceStore((s) => s.coingameBuy);
  const coingameSell = useFinanceStore((s) => s.coingameSell);
  const trending = useFinanceStore((s) => s.coingameTrending);
  const holdings = useFinanceStore((s) => s.coingameHoldings);
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const status = useFinanceStore((s) => s.coingameStatus);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      try { setSearchResults(await searchCoins(query)); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const baseList = query.trim() ? searchResults : trending;
  const displayList = filter === 'all' ? baseList : baseList.filter((c) => c.status === filter);
  const loading = status === 'loading' && trending.length === 0;

  function holdingFor(coinId) { return holdings.find((h) => h.coin_id === coinId); }

  return (
    <div className="cg-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--cg-font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
          Market
        </h1>
      </div>

      {/* Search */}
      <div className="cg-topbar">
        <div className="cg-search-wrap">
          <span className="cg-search-icon">⌕</span>
          <input
            className="cg-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coin or username..."
          />
        </div>
      </div>

      {/* Filters */}
      <div className="cg-filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`cg-filter-tab${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading || searching ? (
        <div className="cg-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="cg-skeleton" style={{ height: 260, borderRadius: 12 }} />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="cg-table">
          <div className="cg-empty">
            <div className="cg-empty-icon">◎</div>
            <div className="cg-empty-title">{query.trim() ? 'No results found' : 'No coins yet'}</div>
            <div className="cg-empty-desc">Be the first to get active</div>
          </div>
        </div>
      ) : (
        <div className="cg-grid">
          {displayList.map((coin) => (
            <CoinCard
              key={coin.coin_id}
              coin={coin}
              ownHolding={holdingFor(coin.coin_id)}
              isOwnCoin={coin.coin_id === ownCoin?.coin_id}
              onBuy={(c) => setModal({ coin: c, mode: 'buy' })}
              onSell={(c) => setModal({ coin: c, mode: 'sell' })}
            />
          ))}
        </div>
      )}

      {modal && (
        <TradeModal
          coin={modal.coin}
          mode={modal.mode}
          ownHolding={holdingFor(modal.coin.coin_id)}
          onClose={() => setModal(null)}
          onConfirm={modal.mode === 'buy' ? coingameBuy : coingameSell}
        />
      )}
    </div>
  );
}
