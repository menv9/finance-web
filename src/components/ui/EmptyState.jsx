import { cn } from './cn';

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 px-6 text-center',
        className,
      )}
    >
      <div className="h-px w-8 bg-rule-strong" aria-hidden />
      {icon ? (
        <div className="text-ink-faint" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="font-display text-lg text-ink">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
