export function EmptyState({ title, description }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--border-soft)] px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}
