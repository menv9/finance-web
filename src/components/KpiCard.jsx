import { formatCurrency, formatPercent } from '../utils/formatters';

export function KpiCard({
  title,
  value,
  currency = 'EUR',
  locale = 'de-AT',
  hint,
  mode = 'currency',
}) {
  const displayValue =
    mode === 'percent' ? formatPercent(value, locale) : formatCurrency(value, currency, locale);

  return (
    <div className="glass-card panel rounded-[24px]">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">{title}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{displayValue}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
