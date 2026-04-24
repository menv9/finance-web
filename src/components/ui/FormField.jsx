import { useId } from 'react';
import { cn } from './cn';

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}) {
  const fallbackId = useId();
  const id = htmlFor || fallbackId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      {label ? (
        <label
          htmlFor={id}
          className="eyebrow flex items-center gap-1.5 text-ink-muted"
        >
          <span>{label}</span>
          {required ? <span aria-hidden className="text-danger">*</span> : null}
        </label>
      ) : null}
      <div className={cn('relative w-full min-w-0 overflow-hidden', error && 'ring-1 ring-danger rounded-md')}>
        {typeof children === 'function'
          ? children({ id, 'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined, 'aria-invalid': Boolean(error) || undefined })
          : children}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs italic text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
