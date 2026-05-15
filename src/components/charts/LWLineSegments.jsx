import { useEffect, useRef } from 'react';
import { ColorType, LineSeries, createChart } from 'lightweight-charts';
import { axisLabelsFromPoints, cleanChartData } from './chartData';
import { subscribeChartTooltip } from './chartTooltip';

function resolveColor(color, element) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  return getComputedStyle(element).getPropertyValue(match[1]).trim() || color;
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

function axisLabels(segments = []) {
  return axisLabelsFromPoints(segments.flatMap((segment) => segment.data || []));
}

export default function LWLineSegments({
  // segments: [{ key, color, data: [{ time: 'YYYY-MM-DD', value: number }] }]
  segments = [],
  priceFormatter = null,
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
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        visible: true,
        ticksVisible: true,
        timeVisible: false,
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
      labels: ['Value'],
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

    if (!segments.length) return;

    const container = containerRef.current;

    segments.forEach((segment) => {
      const segmentData = cleanChartData(segment.data);
      if (!segmentData.length) return;
      const resolved = resolveColor(segment.color, container);
      const series = chart.addSeries(LineSeries, {
        color: resolved,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        ...customPriceFormat(priceFormatter),
      });
      series.setData(segmentData);
      seriesRef.current.push({ series, label: segment.label || segment.key || 'Value' });
    });

    chart.timeScale().fitContent();
  }, [segments, priceFormatter]);

  const labels = axisLabels(segments);

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
