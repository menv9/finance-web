import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, createChart } from 'lightweight-charts';
import { chartTimeToMs, cleanChartData } from './chartData';
import { subscribeChartTooltip } from './chartTooltip';

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
    const seriesApi = series?.series || series;
    if (!seriesApi) return;
    try {
      chart.removeSeries(seriesApi);
    } catch {
      // React dev remounts can leave a stale series handle behind.
    }
  });
}

function shouldUseVisibleRange(visibleRange, points) {
  if (!visibleRange?.from || !visibleRange?.to || points.length < 2) return false;

  const from = chartTimeToMs(visibleRange.from);
  const to = chartTimeToMs(visibleRange.to);
  const times = points
    .map((point) => chartTimeToMs(point.time))
    .filter((time) => Number.isFinite(time));

  if (!Number.isFinite(from) || !Number.isFinite(to) || times.length < 2) return false;

  const min = Math.min(...times);
  const max = Math.max(...times);
  const rangeSpan = to - from;
  if (rangeSpan <= 0) return false;

  const leftGap = Math.max(0, min - from);
  const rightGap = Math.max(0, to - max);
  const dataSpan = max - min;

  return dataSpan >= rangeSpan * 0.45 && leftGap <= rangeSpan * 0.28 && rightGap <= rangeSpan * 0.28;
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
  const formatterRef = useRef(priceFormatter);
  formatterRef.current = priceFormatter;

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
        rightOffset: 0,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
        horzLine: { color: 'rgba(128,128,128,0.25)', labelVisible: false },
      },
    });

    chartRef.current = chart;
    const cleanupTooltip = subscribeChartTooltip(chart, container, seriesRef, {
      formatterRef,
      labels: ['Value', 'Cost basis'],
    });
    return () => {
      cleanupTooltip();
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
    seriesRef.current.push({ series, label: 'Value' });

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
      seriesRef.current.push({ series: s2, label: secondSeries.label || 'Cost basis' });
    }

    if (shouldUseVisibleRange(visibleRange, mainData)) {
      chart.timeScale().setVisibleRange(visibleRange);
    } else {
      chart.timeScale().fitContent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, color, topOpacity, bottomOpacity, referenceY, referenceColor, secondSeries?.data, secondSeries?.color, secondSeries?.topOpacity, secondSeries?.bottomOpacity, secondSeries?.dashed, priceFormatter, visibleRange?.from, visibleRange?.to]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
