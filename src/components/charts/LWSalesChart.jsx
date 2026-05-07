import { useEffect, useRef } from 'react';
import { BaselineSeries, ColorType, createChart } from 'lightweight-charts';

function resolveColor(color, element) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  return getComputedStyle(element).getPropertyValue(match[1]).trim() || color;
}

function withAlpha(color, alpha) {
  if (!color) return `rgba(128,128,128,${alpha})`;
  if (color.startsWith('#')) {
    const c = color.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  return color;
}

function customPriceFormat(formatter) {
  return formatter ? { priceFormat: { type: 'custom', minMove: 0.01, formatter } } : {};
}

function cleanData(points = []) {
  return points
    .filter((point) => point?.time != null && Number.isFinite(Number(point.value)))
    .map((point) => ({ ...point, value: Number(point.value) }));
}

function removeSeriesSafely(chart, seriesList) {
  seriesList.forEach((series) => {
    if (!series) return;
    try {
      chart.removeSeries(series);
    } catch {
      // React dev remounts can leave a stale series handle behind.
    }
  });
}

function formatAxisTime(time) {
  if (time == null) return '';
  const date = typeof time === 'number'
    ? new Date(time * 1000)
    : new Date(String(time).length === 10 ? `${time}T00:00:00` : time);
  if (Number.isNaN(date.getTime())) return String(time);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(date);
}

function axisLabels(points = []) {
  const clean = cleanData(points);
  if (!clean.length) return [];
  const mid = Math.floor((clean.length - 1) / 2);
  return [clean[0], clean[mid], clean[clean.length - 1]]
    .filter((point, index, list) => index === 0 || point.time !== list[index - 1].time)
    .map((point) => formatAxisTime(point.time));
}

export default function LWSalesChart({ data = [], priceFormatter = null }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(128,128,128,0.65)', attributionLogo: false },
      grid: { vertLines: { color: 'transparent' }, horzLines: { color: 'rgba(128,128,128,0.08)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, visible: true, ticksVisible: true, timeVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { vertLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false }, horzLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false } },
    });
    chartRef.current = chart;
    return () => { seriesRef.current = []; chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    removeSeriesSafely(chart, seriesRef.current);
    seriesRef.current = [];
    const chartData = cleanData(data);
    if (!chartData.length) return;
    const container = containerRef.current;
    const pos = resolveColor('var(--positive)', container);
    const neg = resolveColor('var(--danger)', container);
    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: pos,
      topFillColor1: withAlpha(pos, 0.28),
      topFillColor2: withAlpha(pos, 0.04),
      bottomLineColor: neg,
      bottomFillColor1: withAlpha(neg, 0.04),
      bottomFillColor2: withAlpha(neg, 0.28),
      lineWidth: 1.75,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      ...customPriceFormat(priceFormatter),
    });
    series.setData(chartData);
    seriesRef.current.push(series);
    chart.timeScale().fitContent();
  }, [data, priceFormatter]);

  const labels = axisLabels(data);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {labels.length > 0 && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
          {labels.map((label) => (
            <span key={label} style={{ fontSize: 11, color: 'rgba(128,128,128,0.75)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
