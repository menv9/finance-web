import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, createChart } from 'lightweight-charts';

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
    const len = c.length === 3 ? 1 : 2;
    const r = parseInt(c.slice(0, len).padEnd(2, c[0]), 16);
    const g = parseInt(c.slice(len, len * 2).padEnd(2, c[len]), 16);
    const b = parseInt(c.slice(len * 2, len * 3).padEnd(2, c[len * 2]), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  return color;
}

export default function LWAreaChart({
  data = [],
  color = 'var(--accent)',
  topOpacity = 0.28,
  bottomOpacity = 0,
  referenceY = null,
  referenceColor = 'var(--positive)',
  secondSeries = null, // { data, color, topOpacity, bottomOpacity, dashed }
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

    if (!data.length) return;

    const container = containerRef.current;
    const resolved = resolveColor(color, container);
    const resolvedRef = resolveColor(referenceColor, container);

    const series = chart.addSeries(AreaSeries, {
      lineColor: resolved,
      topColor: withAlpha(resolved, topOpacity),
      bottomColor: withAlpha(resolved, bottomOpacity),
      lineWidth: 1.75,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    series.setData(data);

    if (referenceY !== null) {
      series.createPriceLine({
        price: referenceY,
        color: resolvedRef,
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: false,
      });
    }

    if (secondSeries?.data?.length) {
      const s2Color = resolveColor(secondSeries.color || 'var(--danger)', container);
      const s2 = chart.addSeries(AreaSeries, {
        lineColor: s2Color,
        topColor: withAlpha(s2Color, secondSeries.topOpacity ?? 0.08),
        bottomColor: withAlpha(s2Color, secondSeries.bottomOpacity ?? 0.04),
        lineWidth: secondSeries.dashed ? 1 : 1.5,
        lineStyle: secondSeries.dashed ? 1 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s2.setData(secondSeries.data);
    }

    chart.timeScale().fitContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, color, topOpacity, bottomOpacity, referenceY, referenceColor, secondSeries?.data, secondSeries?.color, secondSeries?.topOpacity, secondSeries?.bottomOpacity, secondSeries?.dashed]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
