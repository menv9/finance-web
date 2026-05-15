export function normalizeChartTime(time) {
  if (time == null) return null;

  if (typeof time === 'object') {
    const { year, month, day } = time;
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  if (typeof time === 'number' && Number.isFinite(time)) {
    const milliseconds = time > 100000000000 ? time : time * 1000;
    return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
  }

  const value = String(time).trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && /^\d+$/.test(value)) {
    return normalizeChartTime(numeric);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
}

export function chartTimeToMs(time) {
  const normalized = normalizeChartTime(time);
  if (normalized == null) return Number.NaN;
  if (typeof normalized === 'number') return normalized * 1000;
  const date = new Date(`${normalized}T00:00:00`);
  return date.getTime();
}

export function cleanChartData(points = []) {
  const normalized = points
    .map((point, index) => {
      const time = normalizeChartTime(point?.time);
      const value = Number(point?.value);
      return time != null && Number.isFinite(value) ? { ...point, time, value, __order: index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => chartTimeToMs(a.time) - chartTimeToMs(b.time) || a.__order - b.__order);

  return [...new Map(normalized.map((point) => [String(point.time), point])).values()]
    .map(({ __order, ...point }) => point);
}

export function formatAxisTime(time) {
  const normalized = normalizeChartTime(time);
  if (!normalized) return '';
  const date = typeof normalized === 'number'
    ? new Date(normalized * 1000)
    : new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(normalized);
  if (typeof normalized === 'number') {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(date);
}

export function formatAxisMonth(time) {
  const normalized = normalizeChartTime(time);
  if (!normalized) return '';
  const date = typeof normalized === 'number'
    ? new Date(normalized * 1000)
    : new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(normalized).slice(5, 7);
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
}

export function axisLabelsFromPoints(points = []) {
  const clean = cleanChartData(points);
  if (!clean.length) return [];
  const mid = Math.floor((clean.length - 1) / 2);
  return [...new Set([clean[0], clean[mid], clean[clean.length - 1]].map((point) => formatAxisTime(point.time)).filter(Boolean))];
}

export function allMonthLabelsFromPoints(points = []) {
  return cleanChartData(points)
    .map((point) => formatAxisMonth(point.time))
    .filter(Boolean);
}
