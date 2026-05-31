import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTimeToMs, cleanChartData, formatAxisTime } from './chartData';

/* Resolve a CSS var() color to its computed value so SVG fills/strokes work. */
function resolveColor(color) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  if (typeof document === 'undefined') return color;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color;
}

/*
 * Merge multiple series ([{ time, value }]) into a single row set keyed by time,
 * one column per series (s0, s1, ...). Times that a series doesn't cover stay
 * undefined so multi-line gaps render as breaks (connectNulls={false}).
 */
function buildRows(series, visibleRange) {
  const rows = new Map();
  series.forEach((s, i) => {
    cleanChartData(s.data).forEach((point) => {
      const key = String(point.time);
      if (!rows.has(key)) rows.set(key, { time: point.time });
      rows.get(key)[`s${i}`] = point.value;
    });
  });

  let out = [...rows.values()].sort((a, b) => chartTimeToMs(a.time) - chartTimeToMs(b.time));

  if (visibleRange?.from && visibleRange?.to) {
    const from = chartTimeToMs(visibleRange.from);
    const to = chartTimeToMs(visibleRange.to);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      out = out.filter((row) => {
        const t = chartTimeToMs(row.time);
        return t >= from && t <= to;
      });
    }
  }
  return out;
}

/**
 * A themed Recharts line/area chart. Replaces the lightweight-charts line family
 * (area, multi-line segments, baseline P&L) with a single, readable component.
 *
 * series: [{ data: [{ time, value }], color, label, fill, fillOpacity, dashed }]
 * referenceLine: { y, color, label }   — horizontal marker (e.g. a savings goal)
 * baseline:  true  — single series split green/red around zero (realized P&L)
 * valueFormatter: (value) => string    — Y axis ticks + tooltip values
 * visibleRange: { from, to }           — clip the x-domain to a date window
 * compact: true   — hide axes for sparkline-style cards
 */
export default function TrendChart({
  series = [],
  referenceLine = null,
  baseline = false,
  valueFormatter = (v) => String(v),
  visibleRange = null,
  compact = false,
}) {
  const gradientId = useId().replace(/:/g, '');

  const rows = useMemo(() => buildRows(series, visibleRange), [series, visibleRange]);

  const resolvedSeries = useMemo(
    () => series.map((s) => ({ ...s, resolvedColor: resolveColor(s.color) })),
    [series],
  );

  // For baseline mode: gradient offset at the zero crossing so positive values
  // read green and negative read red, in one continuous area.
  const baselineOffset = useMemo(() => {
    if (!baseline) return null;
    const values = rows.map((r) => r.s0).filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [baseline, rows]);

  if (!rows.length) return null;

  const positive = resolveColor('var(--positive)');
  const danger = resolveColor('var(--danger)');

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: compact ? 0 : 4 }}>
        <defs>
          {resolvedSeries.map((s, i) =>
            s.fill ? (
              <linearGradient key={i} id={`${gradientId}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.resolvedColor} stopOpacity={s.fillOpacity ?? 0.28} />
                <stop offset="100%" stopColor={s.resolvedColor} stopOpacity={0} />
              </linearGradient>
            ) : null,
          )}
          {baseline && baselineOffset !== null && (
            <linearGradient id={`${gradientId}-baseline`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={positive} stopOpacity={0.28} />
              <stop offset={baselineOffset} stopColor={positive} stopOpacity={0.04} />
              <stop offset={baselineOffset} stopColor={danger} stopOpacity={0.04} />
              <stop offset="100%" stopColor={danger} stopOpacity={0.28} />
            </linearGradient>
          )}
        </defs>

        <CartesianGrid vertical={false} strokeDasharray="3 3" />

        <XAxis
          dataKey="time"
          tickFormatter={formatAxisTime}
          interval="preserveStartEnd"
          minTickGap={compact ? 60 : 28}
          tickLine={false}
          axisLine={false}
          hide={compact}
          padding={{ left: 4, right: 4 }}
        />
        <YAxis
          tickFormatter={valueFormatter}
          width={compact ? 0 : 56}
          tickLine={false}
          axisLine={false}
          hide={compact}
          tickCount={4}
        />

        <Tooltip
          formatter={(value, name) => [valueFormatter(value), name || '']}
          labelFormatter={formatAxisTime}
          isAnimationActive={false}
        />

        {referenceLine && Number.isFinite(referenceLine.y) && (
          <ReferenceLine
            y={referenceLine.y}
            stroke={resolveColor(referenceLine.color || 'var(--positive)')}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={
              referenceLine.label
                ? { value: referenceLine.label, position: 'insideTopRight', fill: 'var(--ink-muted)', fontSize: 11 }
                : undefined
            }
          />
        )}

        {baseline ? (
          <Area
            type="monotone"
            dataKey="s0"
            stroke={positive}
            strokeWidth={1.75}
            fill={`url(#${gradientId}-baseline)`}
            connectNulls
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ) : (
          resolvedSeries.map((s, i) =>
            s.fill ? (
              <Area
                key={i}
                type="monotone"
                dataKey={`s${i}`}
                name={s.label || ''}
                stroke={s.resolvedColor}
                strokeWidth={s.dashed ? 1 : 1.75}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                fill={`url(#${gradientId}-fill-${i})`}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={i}
                type="monotone"
                dataKey={`s${i}`}
                name={s.label || ''}
                stroke={s.resolvedColor}
                strokeWidth={s.dashed ? 1 : 2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ),
          )
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
