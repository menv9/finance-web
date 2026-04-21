export function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="glass-card panel rounded-[28px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
