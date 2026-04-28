import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';
import { useCountUp } from '../../utils/motion';

export function InfoPopover({ info, className }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  if (!info) return null;

  const show = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 8,
        left: Math.min(window.innerWidth - 256, Math.max(16, rect.right - 240)),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rule bg-surface-raised text-[9px] font-semibold leading-none text-ink-muted transition-colors hover:border-accent hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30',
          className,
        )}
        aria-label="KPI information"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] max-w-60 rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-xs leading-relaxed text-ink shadow-card"
              style={{ top: position.top, left: position.left }}
              role="tooltip"
            >
              {info}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function Stat({
  label,
  value,
  mode = 'currency',
  currency = 'EUR',
  locale = 'en-GB',
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
  info,
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
        'relative flex flex-col min-w-0',
        size === 'compact' ? 'gap-1' : 'gap-2',
        align === 'right' && 'items-end text-right',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-1.5', align === 'center' && 'justify-center', align === 'right' && 'justify-end')}>
        <p className="eyebrow truncate">{label}</p>
        <InfoPopover info={info} />
      </div>
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
