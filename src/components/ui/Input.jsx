import { forwardRef } from 'react';
import { cn } from './cn';

const baseField =
  'block w-full rounded-md border border-rule-strong bg-surface-raised text-ink placeholder:text-ink-faint ' +
  'px-3 py-2.5 text-sm transition-colors duration-180 ' +
  'hover:border-ink-faint ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30';

export const Input = forwardRef(function Input(
  { type = 'text', className, numeric, ...rest },
  ref,
) {
  const isNumeric = numeric || type === 'number';
  return (
    <input
      ref={ref}
      type={type}
      className={cn(baseField, isNumeric && 'font-mono tabular', type === 'date' && 'text-left block max-w-full', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(baseField, 'resize-y', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(baseField, 'appearance-none pr-9 cursor-pointer', className)}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted"
      >
        <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});
