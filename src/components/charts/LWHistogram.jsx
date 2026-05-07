import { useEffect, useRef, useState } from 'react';
import { ColorType, HistogramSeries, createChart } from 'lightweight-charts';
import { axisLabelsFromPoints, cleanChartData, formatAxisMonth } from './chartData';

function resolveColor(color, element) {
  if (!color || !color.includes('var(')) return color;
  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) return color;
  return getComputedStyle(element).getPropertyValue(match[1]).trim() || color;
}

function customPriceFormat(formatter) {
  return formatter ? { priceFormat: { type: 'custom', minMove: 0.01, formatter } } : {};
}

function nonNegativeAutoscale(baseImplementation) {
  const autoscale = baseImplementation();
  if (!autoscale?.priceRange) return autoscale;
  const maxValue = Math.max(autoscale.priceRange.maxValue, 0);
  return {
    ...autoscale,
    priceRange: {
      ...autoscale.priceRange,
      minValue: 0,
      maxValue: maxValue === 0 ? 1 : maxValue,
    },
  };
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

export default function LWHistogram({
  data = [], // [{ time: 'YYYY-MM-DD', value: number, color?: string }]
  color = 'var(--accent)',
  priceFormatter = null,
  showAllMonthLabels = false,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef([]);
  const [coordinateLabels, setCoordinateLabels] = useState([]);

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
        scaleMargins: { top: 0.08, bottom: 0 },
      },
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

    const chartData = cleanChartData(data);
    if (!chartData.length) return;

    const container = containerRef.current;
    const resolved = resolveColor(color, container);

    const series = chart.addSeries(HistogramSeries, {
      color: resolved,
      priceLineVisible: false,
      lastValueVisible: false,
      autoscaleInfoProvider: nonNegativeAutoscale,
      ...customPriceFormat(priceFormatter),
    });

    series.setData(chartData.map((d) => ({
      time: d.time,
      value: d.value,
      ...(d.color ? { color: d.color } : {}),
    })));

    seriesRef.current.push(series);
    chart.timeScale().fitContent();

    if (!showAllMonthLabels) {
      setCoordinateLabels([]);
      return undefined;
    }

    let frameId = 0;
    const updateCoordinateLabels = () => {
      frameId = window.requestAnimationFrame(() => {
        const nextLabels = chartData
          .map((point) => {
            const x = chart.timeScale().timeToCoordinate(point.time);
            return x == null ? null : { label: formatAxisMonth(point.time), x };
          })
          .filter(Boolean);
        setCoordinateLabels(nextLabels);
      });
    };
    updateCoordinateLabels();

    const resizeObserver = new ResizeObserver(updateCoordinateLabels);
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [data, color, priceFormatter, showAllMonthLabels]);

  const labels = showAllMonthLabels ? coordinateLabels : axisLabelsFromPoints(data);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {showAllMonthLabels && labels.length > 0 && (
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', pointerEvents: 'none' }}>
          {labels.map(({ label, x }, index) => (
            <span
              key={`${label}-${index}`}
              style={{
                position: 'absolute',
                left: x,
                bottom: 0,
                transform: 'translateX(-50%)',
                fontSize: 10,
                color: 'rgba(128,128,128,0.75)',
                fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {!showAllMonthLabels && labels.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 0,
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {labels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              style={{
                minWidth: 0,
                fontSize: 11,
                color: 'rgba(128,128,128,0.75)',
                fontFamily: 'JetBrains Mono, monospace',
                overflow: 'hidden',
                textOverflow: 'clip',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
