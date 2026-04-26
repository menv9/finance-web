import { cn } from './cn';

export function Card({
  eyebrow,
  title,
  description,
  action,
  variant = 'default',
  density = 'comfortable',
  as: Tag = 'section',
  className,
  bodyClassName,
  children,
  footer,
  ...rest
}) {
  const padY = density === 'compact' ? 'py-4' : 'py-6';
  const padX = density === 'compact' ? 'px-4' : 'px-6';
  const isChart = variant === 'chart';
  const chartBody = isChart ? 'flex-1 min-h-[240px]' : '';
  const flush = variant === 'flush';

  return (
    <Tag
      className={cn(
        'relative rounded-lg border border-rule bg-surface',
        'transition-colors duration-180',
        isChart && 'flex flex-col',
        className,
      )}
      {...rest}
    >
      {(eyebrow || title || description || action) && (
        <header
          className={cn(
            'flex flex-wrap items-start justify-between gap-4',
            flush ? 'px-0 pt-0' : `${padX} pt-5`,
            'pb-4 border-b border-rule',
          )}
        >
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? (
              <h2 className="mt-1 font-display text-xl font-medium text-ink">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      )}
      <div className={cn(flush ? '' : `${padX} ${padY}`, chartBody, bodyClassName)}>{children}</div>
      {footer ? (
        <footer className={cn('border-t border-rule', flush ? '' : `${padX} py-3`)}>
          {footer}
        </footer>
      ) : null}
    </Tag>
  );
}
