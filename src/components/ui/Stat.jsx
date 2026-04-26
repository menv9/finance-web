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
  size = 'default',
  tone = 'default',
  valueClassName,
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
    <div
      className={cn(
        'flex flex-col min-w-0',
        size === 'compact' ? 'gap-1' : 'gap-2',
        align === 'right' && 'items-end text-right',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'font-display leading-none tabular numeric',
          tone === 'muted' ? 'text-ink-muted' : 'text-ink',
          align === 'center' ? 'whitespace-nowrap' : 'truncate',
          size === 'compact' ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl',
          valueClassName,
        )}
        title={typeof display === 'string' ? display : undefined}
      >
        {display}
      </p>
      <div
        className={cn(
          'flex items-center gap-2 text-ink-muted min-h-[1rem]',
          tone === 'muted' && 'text-ink-faint',
          align === 'center' && 'justify-center',
          size === 'compact' ? 'text-[10px]' : 'text-xs',
        )}
      >
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
