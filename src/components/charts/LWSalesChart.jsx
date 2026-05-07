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
      timeScale: { borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { vertLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false }, horzLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false } },
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];
    if (!data.length) return;
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
      ...(priceFormatter ? { priceFormat: { type: 'custom', formatter: priceFormatter } } : {}),
    });
    series.setData(data);
    seriesRef.current.push(series);
    chart.timeScale().fitContent();
  }, [data, priceFormatter]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
