import { useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';

const METRICS = [
  { key: 'gains_fc',     label: 'Gains' },
  { key: 'volume_fc',    label: 'Volume' },
  { key: 'trades_count', label: 'Trades' },
];

const RANK_COLORS = [
  { color: '#ffd700', bg: 'rgba(255,215,0,0.08)' },
  { color: '#c0c0c0', bg: 'rgba(192,192,192,0.06)' },
  { color: '#cd7f32', bg: 'rgba(205,127,50,0.06)' },
];

function getEntryValue(entry, metric) {
  if (metric === 'trades_count') return entry.trades_count ?? 0;
  return Number(entry[metric] ?? 0);
}

function formatValue(val, metric) {
  if (metric === 'trades_count') return `${val} txs`;
  const sign = metric === 'gains_fc' && val >= 0 ? '+' : '';
  return `${sign}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} FC`;
}

function getValueColor(val, metric) {
  if (metric === 'gains_fc') return val >= 0 ? 'var(--cg-positive)' : 'var(--cg-danger)';
  return 'var(--cg-text)';
}

function LeaderRow({ entry, rank, metric, maxVal }) {
  const val = getEntryValue(entry, metric);
  const absVal = Math.abs(val);
  const absMax = Math.abs(maxVal);
  const ratio = absMax > 0 ? absVal / absMax : 0;
  const rs = RANK_COLORS[rank];

  return (
    <div className="cg-row" style={{ position: 'relative', background: rs ? rs.bg : undefined }}>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${ratio * 100}%`,
        background: 'rgba(23,245,0,0.03)',
        pointerEvents: 'none',
        borderRadius: 0,
      }} />

      {/* Rank */}
      <div className="cg-rank-num" style={{ color: rs ? rs.color : 'var(--cg-text-3)' }}>
        #{String(rank + 1).padStart(2, '0')}
      </div>

      {/* Avatar */}
      <div
        className="cg-avatar cg-avatar-sm"
        style={{
          background: rs ? `${rs.bg}` : 'var(--cg-surface-raised)',
          border: `1px solid ${rs ? rs.color + '40' : 'var(--cg-border)'}`,
          color: rs ? rs.color : 'var(--cg-text-2)',
        }}
      >
        {(entry.username?.[0] ?? '?').toUpperCase()}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: rs ? rs.color : 'var(--cg-text)' }}>
          @{entry.username ?? '…'}
        </div>
        <div className="cg-progress-bar">
          <div className="cg-progress-fill" style={{ width: `${ratio * 100}%`, background: rs ? rs.color : 'var(--cg-accent)', opacity: 0.5 }} />
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontFamily: 'var(--cg-font-mono)',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: getValueColor(val, metric),
        flexShrink: 0,
      }}>
        {formatValue(val, metric)}
      </div>
    </div>
  );
}

export default function CoingameLeaderboardPage() {
  const leaderboard = useFinanceStore((s) => s.coingameLeaderboard);
  const metric = useFinanceStore((s) => s.coingameLeaderboardMetric);
  const loadCoingameLeaderboard = useFinanceStore((s) => s.loadCoingameLeaderboard);
  const status = useFinanceStore((s) => s.coingameStatus);

  useEffect(() => { loadCoingameLeaderboard(metric); }, [loadCoingameLeaderboard, metric]);

  const loading = status === 'loading' && leaderboard.length === 0;

  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
  })();

  const maxVal = leaderboard.length > 0 ? Math.abs(getEntryValue(leaderboard[0], metric)) : 1;

  return (
    <div className="cg-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--cg-font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
          Rankings
        </h1>
        <p style={{ color: 'var(--cg-text-3)', fontSize: '0.875rem', marginTop: '0.3rem', fontFamily: 'var(--cg-font-mono)' }}>
          Week of {weekStart} · Resets every Monday 00:00 UTC
        </p>
      </div>

      {/* Metric tabs */}
      <div className="cg-filter-tabs">
        {METRICS.map((m) => (
          <button
            key={m.key}
            className={`cg-filter-tab${metric === m.key ? ' active' : ''}`}
            onClick={() => loadCoingameLeaderboard(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="cg-table">
        <div className="cg-table-header">
          <span className="cg-table-title">Top Traders</span>
          {leaderboard.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>
              {leaderboard.length} players
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="cg-skeleton" style={{ height: 52 }} />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="cg-empty">
            <div className="cg-empty-icon">▲</div>
            <div className="cg-empty-title">No activity yet this week</div>
            <div className="cg-empty-desc">Start trading to appear on the leaderboard</div>
          </div>
        ) : (
          leaderboard.map((entry, i) => (
            <LeaderRow
              key={entry.user_id}
              entry={entry}
              rank={i}
              metric={metric}
              maxVal={maxVal}
            />
          ))
        )}
      </div>
    </div>
  );
}
