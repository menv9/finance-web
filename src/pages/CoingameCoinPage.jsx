import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AreaSeries, CandlestickSeries, ColorType, createChart, HistogramSeries } from 'lightweight-charts';
import { useFinanceStore } from '../store/useFinanceStore';
import { buyCost, fetchCoinById, fetchCoinChart, sellProceeds, spotPrice } from '../utils/coingameApi';

const CHART_RANGES = [
  { key: '1m', label: '1m', minutes: 1 },
  { key: '5m', label: '5m', minutes: 5 },
  { key: '15m', label: '15m', minutes: 15 },
  { key: '1h', label: '1h', minutes: 60 },
  { key: '4h', label: '4h', minutes: 240 },
  { key: '24h', label: '24h', minutes: 1440 },
  { key: '7d', label: '7d', minutes: 10080 },
];

function FC({ amount, decimals = 2 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>FC</span>
    </span>
  );
}

function InfoTooltip({ text }) {
  return (
    <span className="cg-info-tooltip" tabIndex={0} aria-label={text}>
      <Info size={13} strokeWidth={2.4} aria-hidden="true" />
      <span className="cg-info-tooltip-bubble" role="tooltip">{text}</span>
    </span>
  );
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

function LightweightCoinChart({ data, chartType }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      autoSize: true,
      attributionLogo: false,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#707070',
        fontFamily: "'DM Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.045)' },
        horzLines: { color: 'rgba(255,255,255,0.055)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(23,245,0,0.28)', labelBackgroundColor: '#17f500' },
        horzLine: { color: 'rgba(23,245,0,0.18)', labelBackgroundColor: '#17f500' },
      },
      localization: {
        priceFormatter: (value) => `${Number(value).toFixed(6)} FC`,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(23,245,0,0.24)',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (priceSeriesRef.current) {
      chart.removeSeries(priceSeriesRef.current);
    }

    priceSeriesRef.current = chart.addSeries(chartType === 'candles' ? CandlestickSeries : AreaSeries, chartType === 'candles' ? {
      upColor: '#17f500',
      downColor: '#ff4444',
      borderUpColor: '#17f500',
      borderDownColor: '#ff4444',
      wickUpColor: '#8aff80',
      wickDownColor: '#ff7777',
      priceLineColor: '#17f500',
      priceLineWidth: 1,
      lastValueVisible: true,
    } : {
      lineColor: '#17f500',
      topColor: 'rgba(23,245,0,0.26)',
      bottomColor: 'rgba(23,245,0,0.02)',
      lineWidth: 2,
      priceLineColor: '#17f500',
      priceLineWidth: 1,
      lastValueVisible: true,
    });
  }, [chartType]);

  useEffect(() => {
    if (!priceSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    const priceData = data.map((point) => ({
      time: Math.floor(new Date(point.bucketStart).getTime() / 1000),
      value: Number(point.price || 0),
    }));
    const candleData = priceData.map((point, index) => {
      const previousClose = index > 0 ? priceData[index - 1].value : point.value;
      return {
        time: point.time,
        open: previousClose,
        high: Math.max(previousClose, point.value),
        low: Math.min(previousClose, point.value),
        close: point.value,
      };
    });
    const volumeData = data.map((point, index) => {
      const previousPrice = Number(data[Math.max(index - 1, 0)]?.price || point.price || 0);
      const currentPrice = Number(point.price || 0);
      const hasVolume = Number(point.volume || 0) > 0;
      return {
        time: Math.floor(new Date(point.bucketStart).getTime() / 1000),
        value: Number(point.volume || 0),
        color: hasVolume
          ? (currentPrice >= previousPrice ? 'rgba(23,245,0,0.32)' : 'rgba(255,68,68,0.26)')
          : 'rgba(255,255,255,0.06)',
      };
    });
    priceSeriesRef.current.setData(chartType === 'candles' ? candleData : priceData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current.timeScale().fitContent();
  }, [data, chartType]);

  return <div className="cg-lightweight-chart" ref={containerRef} />;
}

function TradePanel({ coin, holding, isOwnCoin, onTradeComplete }) {
  const coingameBuy = useFinanceStore((s) => s.coingameBuy);
  const coingameSell = useFinanceStore((s) => s.coingameSell);
  const wallet = useFinanceStore((s) => s.coingameWallet);
  const status = useFinanceStore((s) => s.coingameStatus);
  const [mode, setMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const coinName = coin.coin_name || coin.profiles?.username || 'coin';

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
        if (numericAmount <= 0) throw new Error(`Enter a ${coinName} amount.`);
        if (numericAmount > maxSell) throw new Error(`Max sell: ${maxSell.toLocaleString()} ${coinName}`);
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
      <InfoTooltip text={`Compra o vende ${coinName} usando FingesCoin. Las compras pagan FC y las ventas devuelven FC menos la fee.`} />
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
        <span>{mode === 'buy' ? 'FC' : coinName}</span>
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
            <div><span>You receive</span><strong>{buyTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} {coinName}</strong></div>
            <div><span>Pair</span><strong>{coin.coin_name}/FC</strong></div>
          </>
        ) : (
          <>
            <div><span>You receive</span><strong><FC amount={sellNet} /></strong></div>
            <div><span>Available</span><strong>{maxSell.toLocaleString(undefined, { maximumFractionDigits: 4 })} {coinName}</strong></div>
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
      <InfoTooltip text="Resumen de la moneda del usuario: propietario, estado y cantidad total emitida." />
      <div className="cg-coin-hero-avatar">{(name[0] || '?').toUpperCase()}</div>
      <div>
        <div className="cg-coin-eyebrow">USERCOIN / FINGESCOIN</div>
        <h1>{name}</h1>
        <div className="cg-coin-meta">
          <span>@{profile?.username || 'unknown'}</span>
          <span>{coin.status}</span>
          <span>{Number(coin.tokens_minted ?? 0).toLocaleString()} {name} minted</span>
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
  const [chartData, setChartData] = useState([]);
  const [chartType, setChartType] = useState('candles');
  const [chartRangeKey, setChartRangeKey] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRange = CHART_RANGES.find((range) => range.key === chartRangeKey) ?? CHART_RANGES[5];

  async function loadCoin() {
    setLoading(true);
    setError('');
    try {
      const [nextCoin, nextChart] = await Promise.all([
        fetchCoinById(coinId),
        fetchCoinChart(coinId, chartRange.minutes),
      ]);
      if (!nextCoin) throw new Error('Coin not found');
      setCoin(nextCoin);
      setChartData(nextChart);
    } catch (err) {
      setError(err.message || 'Could not load coin');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoin();
  }, [coinId, chartRange.minutes]);

  const holding = holdings.find((item) => item.coin_id === coinId);
  const price = coin ? spotPrice(Number(coin.tokens_minted), Number(coin.base_price)) : 0;
  const marketCap = coin ? price * Number(coin.tokens_minted) : 0;
  const isOwnCoin = coin?.coin_id === ownCoin?.coin_id;
  const rangeVolume = useMemo(
    () => chartData.reduce((sum, point) => sum + Number(point.volume || 0), 0),
    [chartData],
  );
  const rangeVolumeFc = useMemo(
    () => chartData.reduce((sum, point) => sum + Number(point.volumeFc || 0), 0),
    [chartData],
  );
  const coinName = coin?.coin_name || coin?.profiles?.username || 'coin';

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
              <div className="cg-metric-label">
                <span>Market Cap</span>
                <InfoTooltip text={`Valor total estimado de ${coinName}: precio actual multiplicado por la cantidad emitida.`} />
              </div>
              <strong><FC amount={marketCap} /></strong>
            </div>
            <div>
              <div className="cg-metric-label">
                <span>Price</span>
                <InfoTooltip text={`Precio actual de 1 ${coinName} en FingesCoin, calculado con la bonding curve.`} />
              </div>
              <strong><FC amount={price} decimals={6} /></strong>
            </div>
            <div>
              <div className="cg-metric-label">
                <span>Your Position</span>
                <InfoTooltip text={`Cantidad de ${coinName} que tienes ahora mismo en tu cartera de Coingame.`} />
              </div>
              <strong>{Number(holding?.tokens_held ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {coinName}</strong>
            </div>
          </section>

          <section className="cg-chart-card">
            <div className="cg-chart-toolbar">
              <div className="cg-chart-heading">
                <span className="cg-coin-eyebrow">TRADE DISPLAY</span>
                <div>
                  <strong>{coin.coin_name}/FC</strong>
                  <InfoTooltip text={`Histórico de precio y volumen de ${coinName}. Puedes alternar entre velas o línea y elegir el rango temporal.`} />
                </div>
              </div>
              <div className="cg-chart-actions">
                <div className="cg-chart-type-toggle" aria-label="Chart type">
                  <button className={chartType === 'candles' ? 'active' : ''} onClick={() => setChartType('candles')}>Velas</button>
                  <button className={chartType === 'line' ? 'active' : ''} onClick={() => setChartType('line')}>Linea</button>
                </div>
                <div className="cg-chart-range-toggle" aria-label="Time range">
                  {CHART_RANGES.map((range) => (
                    <button
                      key={range.key}
                      className={chartRangeKey === range.key ? 'active' : ''}
                      onClick={() => setChartRangeKey(range.key)}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                <div className="cg-chart-pill">{chartRange.label} real transactions</div>
              </div>
            </div>
            <div className="cg-big-chart">
              <LightweightCoinChart data={chartData} chartType={chartType} />
            </div>
          </section>

          <section className="cg-coin-info-grid">
            <div>
              <div className="cg-metric-label">
                <span>Vol {chartRange.label}</span>
                <InfoTooltip text={`Cantidad de ${coinName} comprada o vendida en el rango temporal seleccionado.`} />
              </div>
              <strong>{rangeVolume.toLocaleString(undefined, { maximumFractionDigits: 4 })} {coinName}</strong>
            </div>
            <div>
              <div className="cg-metric-label">
                <span>Volume FC</span>
                <InfoTooltip text="Valor total movido en FingesCoin dentro del rango temporal seleccionado." />
              </div>
              <strong><FC amount={rangeVolumeFc} /></strong>
            </div>
            <div>
              <div className="cg-metric-label">
                <span>Base Price</span>
                <InfoTooltip text={`Precio mínimo de referencia desde el que empieza la curva de ${coinName}.`} />
              </div>
              <strong><FC amount={coin.base_price} decimals={4} /></strong>
            </div>
            <div>
              <div className="cg-metric-label">
                <span>Fee</span>
                <InfoTooltip text="Comisión aplicada a cada trade. Parte se quema o alimenta la pool según las reglas de Coingame." />
              </div>
              <strong>1% burn/pool</strong>
            </div>
          </section>
        </div>

        <TradePanel coin={coin} holding={holding} isOwnCoin={isOwnCoin} onTradeComplete={refreshAfterTrade} />
      </div>
    </div>
  );
}
