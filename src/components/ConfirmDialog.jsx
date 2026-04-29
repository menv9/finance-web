import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

export function ConfirmDialog({ open, title, description, confirmLabel = 'Delete', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="fixed inset-0 bg-canvas/75 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
      />

      {/* Dialog panel */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        className="relative w-full max-w-sm rounded-2xl border border-rule bg-surface shadow-lift animate-[modalRise_180ms_cubic-bezier(0.22,0.61,0.36,1)] overflow-hidden"
      >
        {/* Content */}
        <div className="px-5 pt-5 pb-4">
          <p id="confirm-title" className="font-display text-lg font-medium text-ink">
            {title}
          </p>
          {description && (
            <p id="confirm-desc" className="mt-1.5 text-sm text-ink-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Actions — stacked on mobile, row on sm+ */}
        <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="w-full sm:w-auto">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
