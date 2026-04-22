import { cloneElement } from 'react';
import { cn } from './cn';

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

const variants = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-strong active:scale-[0.98] border border-transparent',
  secondary:
    'bg-transparent text-ink border border-rule-strong hover:border-ink-faint active:scale-[0.98]',
  ghost:
    'bg-transparent text-ink-muted hover:text-ink border border-transparent hover:bg-surface-raised',
  danger:
    'bg-danger text-ink-inverse hover:opacity-90 active:scale-[0.98] border border-transparent',
  link: 'bg-transparent text-ink underline underline-offset-4 decoration-rule-strong hover:decoration-accent px-0 h-auto',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  leading,
  trailing,
  as,
  asChild,
  ...rest
}) {
  const isDisabled = disabled || loading;

  // asChild: wrap a single child element with button styling (e.g. react-router Link)
  if (asChild) {
    const child = Array.isArray(children) ? children[0] : children;
    if (!child) return null;
    const extraClass = cn(
      'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium',
      'transition-[background,color,border-color,transform,opacity] duration-180 ease-editorial',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      variant !== 'link' && sizes[size],
      variants[variant],
      className,
      child.props?.className,
    );
    return cloneElement(child, { className: extraClass });
  }

  const Tag = as || 'button';
  const tagProps = Tag === 'button' ? { type, disabled: isDisabled } : {};

  return (
    <Tag
      {...tagProps}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium',
        'transition-[background,color,border-color,transform,opacity] duration-180 ease-editorial',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        variant !== 'link' && sizes[size],
        variants[variant],
        className,
      )}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      ) : leading ? (
        <span className="inline-flex -ml-0.5 text-ink-muted">{leading}</span>
      ) : null}
      <span className="inline-flex items-center gap-2 min-w-0 whitespace-nowrap">{children}</span>
      {trailing && !loading ? (
        <span className="inline-flex -mr-0.5 text-ink-muted">{trailing}</span>
      ) : null}
    </Tag>
  );
}
