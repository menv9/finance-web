import { useEffect, useRef } from 'react';
import { ColorType, HistogramSeries, createChart } from 'lightweight-charts';

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

// Shifts a 'YYYY-MM-DD' date by `days` days.
function shiftDate(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function customPriceFormat(formatter) {
  return formatter ? { priceFormat: { type: 'custom', minMove: 0.01, formatter } } : {};
}

function validPoint(point) {
  return point?.time != null && Number.isFinite(Number(point.value));
}

function cleanData(points = []) {
  return points.filter(validPoint).map((point) => ({ ...point, value: Number(point.value) }));
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

export default function LWGroupedHistogram({
  // seriesA: { data: [{ time, value, color? }], color }
  // seriesB: { data: [{ time, value, color? }], color }
  seriesA = { data: [], color: 'var(--accent)' },
  seriesB = { data: [], color: 'var(--danger)' },
  offsetDays = 14, // how many days to shift seriesB within the same month
  // selectedTime: 'YYYY-MM-DD' — bars at this time render at full opacity, others at dimOpacity
  selectedTime = null,
  dimOpacity = 0.35,
  // xLabels: string[] — custom labels rendered as HTML overlay (hides time axis when set)
  xLabels = null,
  priceFormatter = null,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef([]);
  const dateLabels = xLabels?.length ? [] : axisLabels([...(seriesA.data || []), ...(seriesB.data || [])]);

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
        timeVisible: false,
        ticksVisible: xLabels ? false : true,
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
  }, [xLabels]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    removeSeriesSafely(chart, seriesRef.current);
    seriesRef.current = [];

    const container = containerRef.current;
    const dataA = cleanData(seriesA.data);
    const dataB = cleanData(seriesB.data);
    const hasA = dataA.length > 0;
    const hasB = dataB.length > 0;
    if (!hasA && !hasB) return;

    if (hasA) {
      const colorA = resolveColor(seriesA.color, container);
      const sA = chart.addSeries(HistogramSeries, {
        color: colorA,
        priceLineVisible: false,
        lastValueVisible: false,
        ...customPriceFormat(priceFormatter),
      });
      seriesRef.current.push(sA);
      sA.setData(dataA.map((d) => {
        const isSelected = !selectedTime || d.time === selectedTime;
        const itemColor = d.color || (selectedTime ? withAlpha(colorA, isSelected ? 1 : dimOpacity) : colorA);
        return { time: d.time, value: d.value, color: itemColor };
      }));
    }

    if (hasB) {
      const colorB = resolveColor(seriesB.color, container);
      const sB = chart.addSeries(HistogramSeries, {
        color: colorB,
        priceLineVisible: false,
        lastValueVisible: false,
        ...customPriceFormat(priceFormatter),
      });
      seriesRef.current.push(sB);
      sB.setData(dataB.map((d) => {
        const shifted = shiftDate(d.time, offsetDays);
        const isSelected = !selectedTime || d.time === selectedTime;
        const itemColor = d.color || (selectedTime ? withAlpha(colorB, isSelected ? 1 : dimOpacity) : colorB);
        return { time: shifted, value: d.value, color: itemColor };
      }));
    }

    chart.timeScale().fitContent();
  }, [seriesA, seriesB, offsetDays, selectedTime, dimOpacity, priceFormatter]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {xLabels?.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${xLabels.length}, 1fr)`,
            pointerEvents: 'none',
            padding: '0 4px',
          }}
        >
          {xLabels.map((label) => (
            <span
              key={label}
              style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(128,128,128,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {!xLabels?.length && dateLabels.length > 0 && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
          {dateLabels.map((label) => (
            <span key={label} style={{ fontSize: 11, color: 'rgba(128,128,128,0.75)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
