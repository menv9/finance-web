function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTooltipTime(time) {
  if (time == null) return '';

  if (typeof time === 'number') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(time * 1000));
  }

  if (typeof time === 'object') {
    const { year, month, day } = time;
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(Date.UTC(year, month - 1, day)));
    }
  }

  const date = new Date(`${time}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  return String(time);
}

function getPointValue(point) {
  if (!point) return null;
  if (Number.isFinite(point.value)) return point.value;
  if (Number.isFinite(point.close)) return point.close;
  return null;
}

function defaultValueFormatter(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function createTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.zIndex = '5';
  tooltip.style.display = 'none';
  tooltip.style.minWidth = '132px';
  tooltip.style.maxWidth = '220px';
  tooltip.style.padding = '0.55rem 0.65rem';
  tooltip.style.border = '1px solid var(--rule-strong)';
  tooltip.style.borderRadius = '8px';
  tooltip.style.background = 'color-mix(in srgb, var(--surface) 94%, transparent)';
  tooltip.style.boxShadow = '0 12px 28px rgba(0,0,0,0.14)';
  tooltip.style.backdropFilter = 'blur(14px) saturate(140%)';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.fontFamily = 'Instrument Sans, sans-serif';
  tooltip.style.color = 'var(--ink)';
  tooltip.style.transform = 'translate3d(0, 0, 0)';
  container.appendChild(tooltip);
  return tooltip;
}

export function subscribeChartTooltip(chart, container, seriesRef, {
  formatterRef = null,
  labels = [],
} = {}) {
  const tooltip = createTooltip(container);

  const hide = () => {
    tooltip.style.display = 'none';
  };

  const handler = (param) => {
    if (!param?.point || param.time == null || !param.seriesData) {
      hide();
      return;
    }

    const series = seriesRef.current || [];
    const rows = series
      .map((item, index) => {
        const seriesApi = item?.series || item;
        const point = param.seriesData.get(seriesApi);
        const value = getPointValue(point);
        if (!Number.isFinite(value)) return null;
        const formatter = formatterRef?.current || defaultValueFormatter;
        return {
          label: item?.label || labels[index] || (index === 0 ? 'Value' : `Series ${index + 1}`),
          value: formatter(value),
        };
      })
      .filter(Boolean);

    if (!rows.length) {
      hide();
      return;
    }

    tooltip.innerHTML = `
      <div style="font-family: JetBrains Mono, monospace; font-size: 0.66rem; letter-spacing: 0.05em; color: var(--ink-faint); margin-bottom: 0.35rem;">
        ${escapeHtml(formatTooltipTime(param.time))}
      </div>
      <div style="display: grid; gap: 0.22rem;">
        ${rows.map((row) => `
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 0.85rem;">
            <span style="font-size: 0.76rem; color: var(--ink-muted);">${escapeHtml(row.label)}</span>
            <strong style="font-family: JetBrains Mono, monospace; font-size: 0.78rem; font-weight: 600; color: var(--ink);">${escapeHtml(row.value)}</strong>
          </div>
        `).join('')}
      </div>
    `;

    tooltip.style.display = 'block';

    const margin = 12;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const x = param.point.x + margin + tooltipWidth > containerWidth
      ? param.point.x - tooltipWidth - margin
      : param.point.x + margin;
    const y = param.point.y + margin + tooltipHeight > containerHeight
      ? param.point.y - tooltipHeight - margin
      : param.point.y + margin;

    tooltip.style.left = `${Math.max(6, x)}px`;
    tooltip.style.top = `${Math.max(6, y)}px`;
  };

  chart.subscribeCrosshairMove(handler);

  return () => {
    chart.unsubscribeCrosshairMove(handler);
    tooltip.remove();
  };
}
