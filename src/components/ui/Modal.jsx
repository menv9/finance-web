import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

const sizeMap = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  size = 'md',
  children,
  footer,
  initialFocusRef,
}) {
  const panelRef = useRef(null);
  const lastActiveRef = useRef(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    lastActiveRef.current = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTarget =
      initialFocusRef?.current ||
      panelRef.current?.querySelector(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
    focusTarget?.focus?.();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (lastActiveRef.current && typeof lastActiveRef.current.focus === 'function') {
        lastActiveRef.current.focus();
      }
    };
  }, [open, handleClose, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 sm:py-16"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={handleClose}
        className="fixed inset-0 bg-canvas/70 backdrop-blur-[2px] animate-[fadeIn_180ms_ease-out]"
      />
      <div
        ref={panelRef}
        className={cn(
          'relative w-full border border-rule bg-surface shadow-lift',
          'rounded-t-2xl sm:rounded-lg',
          'max-h-[92dvh] overflow-y-auto',
          'animate-[modalRise_220ms_cubic-bezier(0.22,0.61,0.36,1)]',
          sizeMap[size] || sizeMap.md,
        )}
      >
        {(eyebrow || title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-rule px-6 pt-5 pb-4">
            <div className="min-w-0">
              {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              {title ? (
                <h2 className="mt-1 font-display text-2xl font-medium text-ink">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="shrink-0 -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M2 2l10 10M12 2L2 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
        )}
        <div className="px-6 py-6">{children}</div>
        {footer ? (
          <footer className="border-t border-rule px-6 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
