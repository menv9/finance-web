import { useToastStore } from '../store/useToastStore';

const KIND_STYLES = {
  error: {
    border: 'var(--danger)',
    bg: 'var(--danger-soft)',
    icon: '!',
  },
  success: {
    border: 'var(--positive)',
    bg: 'var(--positive-soft)',
    icon: '✓',
  },
  info: {
    border: 'var(--accent)',
    bg: 'var(--accent-soft)',
    icon: 'i',
  },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind] || KIND_STYLES.info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 text-sm"
            style={{
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--ink)',
              borderLeft: `3px solid ${style.border}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
            role="status"
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: style.bg, color: style.border }}
              aria-hidden
            >
              {style.icon}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 text-ink-muted hover:text-ink transition-colors"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
