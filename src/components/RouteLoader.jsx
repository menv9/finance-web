export function RouteLoader() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="pointer-events-none">
      <span
        aria-hidden
        className="fixed left-0 right-0 top-0 z-40 block h-[2px] overflow-hidden"
        style={{ background: 'transparent' }}
      >
        <span
          className="absolute inset-y-0 left-0 w-1/3"
          style={{
            background:
              'linear-gradient(to right, transparent, var(--accent-strong), var(--accent), transparent)',
            animation: 'route-loader-slide 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite',
          }}
        />
      </span>
    </div>
  );
}
