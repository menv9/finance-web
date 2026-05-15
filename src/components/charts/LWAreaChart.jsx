import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, createChart } from 'lightweight-charts';
import { axisLabelsFromPoints, cleanChartData } from './chartData';

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

function customPriceFormat(formatter) {
  return formatter ? { priceFormat: { type: 'custom', minMove: 0.01, formatter } } : {};
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

export default function LWAreaChart({
  data = [],
  color = 'var(--accent)',
  topOpacity = 0.28,
  bottomOpacity = 0,
  referenceY = null,
  referenceColor = 'var(--positive)',
  secondSeries = null, // { data, color, topOpacity, bottomOpacity, dashed }
  priceFormatter = null,
  visibleRange = null,
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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.18 },
      },
      timeScale: {
        borderVisible: false,
        visible: true,
        ticksVisible: true,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
        horzLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
      },
    });

    chartRef.current = chart;
    return () => {
      seriesRef.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    removeSeriesSafely(chart, seriesRef.current);
    seriesRef.current = [];

    const mainData = cleanChartData(data);
    if (!mainData.length) return;

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
      ...customPriceFormat(priceFormatter),
    });
    series.setData(mainData);
    seriesRef.current.push(series);

    if (referenceY !== null) {
      series.createPriceLine({
        price: referenceY,
        color: resolvedRef,
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: false,
      });
    }

    const secondaryData = cleanChartData(secondSeries?.data);
    if (secondaryData.length) {
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
        ...customPriceFormat(priceFormatter),
      });
      s2.setData(secondaryData);
      seriesRef.current.push(s2);
    }

    if (visibleRange?.from && visibleRange?.to) {
      chart.timeScale().setVisibleRange(visibleRange);
    } else {
      chart.timeScale().fitContent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, color, topOpacity, bottomOpacity, referenceY, referenceColor, secondSeries?.data, secondSeries?.color, secondSeries?.topOpacity, secondSeries?.bottomOpacity, secondSeries?.dashed, priceFormatter, visibleRange?.from, visibleRange?.to]);

  const labels = axisLabelsFromPoints(data);

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
