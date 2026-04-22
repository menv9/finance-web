export function LoadingScreen({ label = 'Loading…', compact = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center rounded-lg border border-rule bg-surface ${
        compact ? 'min-h-[160px] p-6' : 'min-h-[240px] p-10'
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-rule-strong border-t-accent"
        />
        <p className="eyebrow">{label}</p>
      </div>
    </div>
  );
}
