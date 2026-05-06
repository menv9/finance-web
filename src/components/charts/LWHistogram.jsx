import { useEffect, useRef } from 'react';
import { ColorType, HistogramSeries, createChart } from 'lightweight-charts';

function resolveColor(color, element) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  return getComputedStyle(element).getPropertyValue(match[1]).trim() || color;
}

export default function LWHistogram({
  data = [], // [{ time: 'YYYY-MM-DD', value: number, color?: string }]
  color = 'var(--accent)',
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        attributionLogo: false,
        textColor: 'rgba(128,128,128,0.65)',
      },
      grid: {
        vertLines: { color: 'transparent' },
        horzLines: { color: 'rgba(128,128,128,0.08)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
        horzLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
      },
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];

    if (!data.length) return;

    const container = containerRef.current;
    const resolved = resolveColor(color, container);

    const series = chart.addSeries(HistogramSeries, {
      color: resolved,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(data.map((d) => ({
      time: d.time,
      value: d.value,
      ...(d.color ? { color: d.color } : {}),
    })));

    seriesRef.current.push(series);
    chart.timeScale().fitContent();
  }, [data, color]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
