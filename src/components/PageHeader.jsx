import { cn } from './ui';

export function PageHeader({ eyebrow, title, description, actions, number, className }) {
  return (
    <header className={cn('mb-0 grid gap-6 border-b border-rule pb-6 lg:grid-cols-12 lg:gap-8', className)}>
      <div className="lg:col-span-8 flex gap-4 lg:gap-6">
        {number ? (
          <span
            aria-hidden
            className="numeric text-xs text-ink-faint pt-2 tracking-widest"
          >
            {number}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[0.95] tracking-tight break-words">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-prose text-base text-ink-muted leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="lg:col-span-4 flex flex-wrap items-start gap-2 justify-end lg:pt-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}