import { cn } from './cn';
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';
import { useCountUp } from '../../utils/motion';

export function Stat({
  label,
  value,
  mode = 'currency',
  currency = 'EUR',
  locale = 'de-AT',
  hint,
  delta,
  deltaMode = 'percent',
  sparkline,
  className,
  align = 'left',
  animate = true,
}) {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const live = useCountUp(numericValue ?? 0, { enabled: animate && numericValue !== null });

  let display = value;
  if (value === null || value === undefined) display = '—';
  if (numericValue !== null) {
    const shown = animate ? live : numericValue;
    if (mode === 'currency') display = formatCurrency(Math.round(shown), currency, locale);
    else if (mode === 'percent') display = formatPercent(shown, locale);
    else if (mode === 'number') display = formatNumber(shown, locale, 0);
    else display = shown;
  }

  const deltaNum = typeof delta === 'number' ? delta : null;
  const deltaUp = deltaNum !== null && deltaNum > 0;
  const deltaDown = deltaNum !== null && deltaNum < 0;
  const deltaDisplay =
    deltaNum !== null
      ? deltaMode === 'percent'
        ? formatPercent(Math.abs(deltaNum), locale)
        : formatCurrency(Math.abs(deltaNum), currency, locale)
      : null;

  return (
    <div className={cn('flex flex-col gap-2 min-w-0', align === 'right' && 'items-end text-right', className)}>
      <p className="eyebrow">{label}</p>
      <p
        className="font-display text-2xl sm:text-3xl leading-none text-ink tabular numeric truncate"
        title={typeof display === 'string' ? display : undefined}
      >
        {display}
      </p>
      <div className="flex items-center gap-2 text-xs text-ink-muted min-h-[1rem]">
        {deltaDisplay ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 tabular',
              deltaUp && 'text-positive',
              deltaDown && 'text-danger',
            )}
          >
            <span aria-hidden>{deltaUp ? '↑' : deltaDown ? '↓' : '·'}</span>
            {deltaDisplay}
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
      {sparkline ? <div className="h-8 mt-1">{sparkline}</div> : null}
    </div>
  );
}
