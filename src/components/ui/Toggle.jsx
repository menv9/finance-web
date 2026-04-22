import { cn } from './cn';

export function Toggle({ checked, onChange, label, description, disabled, id }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <span className="relative inline-flex h-5 w-9 shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full border border-rule-strong bg-surface-raised',
            'transition-colors duration-180',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-ink shadow-sm',
            'transition-transform duration-180 ease-editorial',
            'peer-checked:translate-x-4 peer-checked:bg-accent-ink',
          )}
        />
      </span>
      {(label || description) && (
        <span className="grid gap-0.5 leading-tight">
          {label ? <span className="text-sm text-ink">{label}</span> : null}
          {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, id, disabled }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <span className="relative inline-flex h-4 w-4">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-sm border border-rule-strong bg-surface-raised',
            'transition-colors duration-180',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
          )}
        />
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="relative z-10 h-4 w-4 text-accent-ink opacity-0 peer-checked:opacity-100 transition-opacity"
        >
          <path d="M2.5 6.2l2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label ? <span className="text-sm text-ink">{label}</span> : null}
    </label>
  );
}
