export function ChartCard({ title, actions, children }) {
  return (
    <section className="glass-card panel rounded-[28px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="h-[320px]">{children}</div>
    </section>
  );
}
