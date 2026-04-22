import { cn } from './cn';

export function Skeleton({ className, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-md bg-rule',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-rule-strong before:to-transparent',
        'before:animate-shimmer',
        className,
      )}
      {...rest}
    />
  );
}

export function StatSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function RowSkeleton({ cols = 5 }) {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-rule">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
  );
}
