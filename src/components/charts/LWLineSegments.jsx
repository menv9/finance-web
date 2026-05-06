import { useEffect, useRef } from 'react';
import { ColorType, LineSeries, createChart } from 'lightweight-charts';

function resolveColor(color, element) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  return getComputedStyle(element).getPropertyValue(match[1]).trim() || color;
}

export default function LWLineSegments({
  // segments: [{ key, color, data: [{ time: 'YYYY-MM-DD', value: number }] }]
  segments = [],
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      attributionLogo: false,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
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

    chart.getSeries().forEach((s) => chart.removeSeries(s));

    if (!segments.length) return;

    const container = containerRef.current;

    segments.forEach((segment) => {
      if (!segment.data?.length) return;
      const resolved = resolveColor(segment.color, container);
      const series = chart.addSeries(LineSeries, {
        color: resolved,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(segment.data);
    });

    chart.timeScale().fitContent();
  }, [segments]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
