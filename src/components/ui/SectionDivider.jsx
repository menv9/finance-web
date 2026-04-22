import { cn } from './cn';

export function SectionDivider({ label, className }) {
  return (
    <div className={cn('flex items-center gap-4', className)} role="separator">
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-rule" aria-hidden />
    </div>
  );
}
