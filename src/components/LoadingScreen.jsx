export function LoadingScreen({ label, compact = false }) {
  return (
    <div
      className={`glass-card ${compact ? 'panel' : ''} flex min-h-[240px] items-center justify-center rounded-[28px]`}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
