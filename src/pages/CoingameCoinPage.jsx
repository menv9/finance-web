import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { buyCost, fetchCoinById, sellProceeds, spotPrice } from '../utils/coingameApi';

function FC({ amount, decimals = 2 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>FC</span>
    </span>
  );
}

function makeChartData(coin) {
  const minted = Number(coin?.tokens_minted ?? 0);
  const base = Number(coin?.base_price ?? 1);
  const current = spotPrice(minted, base);
  const seed = String(coin?.coin_id || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return Array.from({ length: 48 }, (_, i) => {
    const drift = 0.76 + (i / 47) * 0.34;
    const wave = Math.sin((i + seed) * 0.48) * 0.075;
    const pulse = Math.sin((i + seed) * 1.13) * 0.035;
    const price = Math.max(base, current * (drift + wave + pulse));
    return {
      label: i % 8 === 0 ? `${i}h` : '',
      price,
      volume: Math.max(4, Math.round((minted / 1200) * (1 + Math.sin((i + seed) * 0.7)) + 18 + (i > 40 ? i * 3 : 0))),
    };
  });
}

function tokensForBudget(coin, budgetFc) {
  const budget = Number(budgetFc || 0);
  if (budget <= 0) return 0;
  const base = Number(coin?.base_price ?? 1);
  const minted = Number(coin?.tokens_minted ?? 0);
  let lo = 0;
  let hi = Math.max(1, budget / Math.max(base, 0.000001));
  for (let i = 0; i < 32; i += 1) {
    const mid = (lo + hi) / 2;
    const total = buyCost(minted, mid, base) * 1.01;
    if (total <= budget) lo = mid;
    else hi = mid;
  }
  return lo;
}

function TradePanel({ coin, holding, isOwnCoin, onTradeComplete }) {
  const coingameBuy = useFinanceStore((s) => s.coingameBuy);
  const coingameSell = useFinanceStore((s) => s.coingameSell);
  const wallet = useFinanceStore((s) => s.coingameWallet);
  const status = useFinanceStore((s) => s.coingameStatus);
  const [mode, setMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const numericAmount = Number(amount || 0);
  const maxSell = Number(holding?.tokens_held ?? 0);
  const buyTokens = mode === 'buy' ? tokensForBudget(coin, numericAmount) : 0;
  const sellGross = mode === 'sell' ? sellProceeds(Number(coin.tokens_minted), numericAmount, Number(coin.base_price)) : 0;
  const sellNet = sellGross * 0.99;

  async function submitTrade() {
    setError('');
    try {
      if (mode === 'buy') {
        if (isOwnCoin) throw new Error('You cannot buy your own coin.');
        if (numericAmount <= 0 || buyTokens <= 0) throw new Error('Enter an FC amount.');
        await coingameBuy(coin.coin_id, buyTokens);
      } else {
        if (numericAmount <= 0) throw new Error('Enter a token amount.');
        if (numericAmount > maxSell) throw new Error(`Max sell: ${maxSell.toLocaleString()} tokens`);
        await coingameSell(coin.coin_id, numericAmount);
      }
      setAmount('');
      await onTradeComplete();
    } catch (err) {
      setError(err.message || 'Trade failed');
    }
  }

  return (
    <aside className="cg-trade-panel">
      <div className="cg-trade-tabs">
        {['buy', 'sell'].map((key) => (
          <button
            key={key}
            className={mode === key ? 'active' : ''}
            onClick={() => {
              setMode(key);
              setAmount('');
              setError('');
            }}
          >
            {key === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div className="cg-trade-balance">
        <span>Balance</span>
        <strong><FC amount={wallet?.fc_balance} /></strong>
      </div>

      <div className="cg-trade-amount">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
        <span>{mode === 'buy' ? 'FC' : 'TOKENS'}</span>
      </div>

      {mode === 'buy' ? (
        <div className="cg-trade-quick">
          {[25, 100, 250].map((value) => (
            <button key={value} onClick={() => setAmount(String(value))}>{value} FC</button>
          ))}
        </div>
      ) : (
        <div className="cg-trade-quick">
          {[0.25, 0.5, 1].map((ratio) => (
            <button key={ratio} disabled={maxSell <= 0} onClick={() => setAmount(String(maxSell * ratio))}>
              {ratio === 1 ? 'Max' : `${Math.round(ratio * 100)}%`}
            </button>
          ))}
        </div>
      )}

      <div className="cg-trade-preview">
        {mode === 'buy' ? (
          <>
            <div><span>You receive</span><strong>{buyTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</strong></div>
            <div><span>Pair</span><strong>{coin.coin_name}/FC</strong></div>
          </>
        ) : (
          <>
            <div><span>You receive</span><strong><FC amount={sellNet} /></strong></div>
            <div><span>Available</span><strong>{maxSell.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</strong></div>
          </>
        )}
      </div>

      {isOwnCoin && mode === 'buy' && (
        <div className="cg-trade-note">Other users can trade this coin. Buying your own coin is blocked.</div>
      )}
      {error && <div className="cg-error">{error}</div>}

      <button className="cg-btn cg-btn-primary cg-trade-submit" onClick={submitTrade} disabled={status === 'loading'}>
        {status === 'loading' ? 'Trading...' : `${mode === 'buy' ? 'Buy' : 'Sell'} ${coin.coin_name}`}
      </button>
    </aside>
  );
}

function CoinHeader({ coin }) {
  const profile = coin.profiles;
  const name = coin.coin_name || profile?.username || 'Unnamed coin';
  return (
    <section className="cg-coin-hero">
      <div className="cg-coin-hero-avatar">{(name[0] || '?').toUpperCase()}</div>
      <div>
        <div className="cg-coin-eyebrow">USERCOIN / FINGESCOIN</div>
        <h1>{name}</h1>
        <div className="cg-coin-meta">
          <span>@{profile?.username || 'unknown'}</span>
          <span>{coin.status}</span>
          <span>{Number(coin.tokens_minted ?? 0).toLocaleString()} minted</span>
        </div>
      </div>
      <Link className="cg-btn cg-btn-secondary cg-coin-market-link" to="/coingame/market">Market</Link>
    </section>
  );
}

export default function CoingameCoinPage() {
  const { coinId } = useParams();
  const holdings = useFinanceStore((s) => s.coingameHoldings);
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const loadCoingame = useFinanceStore((s) => s.loadCoingame);
  const [coin, setCoin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCoin() {
    setLoading(true);
    setError('');
    try {
      const nextCoin = await fetchCoinById(coinId);
      if (!nextCoin) throw new Error('Coin not found');
      setCoin(nextCoin);
    } catch (err) {
      setError(err.message || 'Could not load coin');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoin();
  }, [coinId]);

  const holding = holdings.find((item) => item.coin_id === coinId);
  const chartData = useMemo(() => makeChartData(coin), [coin]);
  const price = coin ? spotPrice(Number(coin.tokens_minted), Number(coin.base_price)) : 0;
  const marketCap = coin ? price * Number(coin.tokens_minted) : 0;
  const isOwnCoin = coin?.coin_id === ownCoin?.coin_id;

  async function refreshAfterTrade() {
    await Promise.all([loadCoingame(), loadCoin()]);
  }

  if (loading) {
    return (
      <div className="cg-page cg-coin-detail-page">
        <div className="cg-skeleton" style={{ height: 500 }} />
      </div>
    );
  }

  if (error || !coin) {
    return (
      <div className="cg-page cg-coin-detail-page">
        <div className="cg-error">{error || 'Coin not found'}</div>
        <Link className="cg-btn cg-btn-secondary" to="/coingame/market">Back to market</Link>
      </div>
    );
  }

  return (
    <div className="cg-page cg-coin-detail-page">
      <div className="cg-coin-layout">
        <div className="cg-coin-main">
          <CoinHeader coin={coin} />

          <section className="cg-coin-stat-strip">
            <div>
              <span>Market Cap</span>
              <strong><FC amount={marketCap} /></strong>
            </div>
            <div>
              <span>Price</span>
              <strong><FC amount={price} decimals={6} /></strong>
            </div>
            <div>
              <span>Your Position</span>
              <strong>{Number(holding?.tokens_held ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
            </div>
          </section>

          <section className="cg-chart-card">
            <div className="cg-chart-toolbar">
              <div>
                <span className="cg-coin-eyebrow">TRADE DISPLAY</span>
                <strong>{coin.coin_name}/FC</strong>
              </div>
              <div className="cg-chart-pill">24h synthetic feed</div>
            </div>
            <div className="cg-big-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#505050', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fill: '#505050', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                  <YAxis yAxisId="volume" hide />
                  <Tooltip
                    formatter={(value, key) => key === 'price' ? [`${Number(value).toFixed(6)} FC`, 'Price'] : [value, 'Volume']}
                    contentStyle={{ background: 'rgba(17,17,17,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f0f0' }}
                  />
                  <Bar yAxisId="volume" dataKey="volume" fill="rgba(23,245,0,0.22)" barSize={5} />
                  <Area yAxisId="price" type="monotone" dataKey="price" stroke="#17f500" strokeWidth={2} fill="rgba(23,245,0,0.08)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="cg-coin-info-grid">
            <div><span>Vol 24h</span><strong>{Math.round(Number(coin.tokens_minted || 0) / 8).toLocaleString()} tokens</strong></div>
            <div><span>Base Price</span><strong><FC amount={coin.base_price} decimals={4} /></strong></div>
            <div><span>Fee</span><strong>1% burn/pool</strong></div>
            <div><span>Pair</span><strong>UserCoin / FingesCoin</strong></div>
          </section>
        </div>

        <TradePanel coin={coin} holding={holding} isOwnCoin={isOwnCoin} onTradeComplete={refreshAfterTrade} />
      </div>
    </div>
  );
}
