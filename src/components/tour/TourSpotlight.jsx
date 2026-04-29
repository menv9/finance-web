import { useEffect, useRef, useState } from 'react';
import { useTour } from './TourContext';

const PAD = 8;
const TOOLTIP_W = 260;
const TOOLTIP_H = 110;

export function TourSpotlight() {
  const { active, currentStop } = useTour();
  const [rect, setRect] = useState(null);
  const observerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active || !currentStop) {
      setRect(null);
      return;
    }

    function measure() {
      const el = document.querySelector(`[data-tour="${currentStop.tourId}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const el = document.querySelector(`[data-tour="${currentStop.tourId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Delay first measurement to let scroll settle
    const timer = setTimeout(() => {
      measure();

      observerRef.current = new ResizeObserver(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(measure);
      });
      const target = document.querySelector(`[data-tour="${currentStop.tourId}"]`);
      if (target) observerRef.current.observe(target);
    }, 120);

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      observerRef.current?.disconnect();
    };
  }, [active, currentStop]);

  if (!active || !currentStop) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let tooltipStyle;
  if (!rect) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_W,
    };
  } else {
    const spaceRight = vw - (rect.left + rect.width + PAD);
    const spaceLeft = rect.left - PAD;
    let tx;
    let ty = Math.max(8, Math.min(rect.top + rect.height / 2 - TOOLTIP_H / 2, vh - TOOLTIP_H - 8));

    if (spaceRight >= TOOLTIP_W + 4) {
      tx = rect.left + rect.width + PAD;
    } else if (spaceLeft >= TOOLTIP_W + 4) {
      tx = rect.left - PAD - TOOLTIP_W;
    } else {
      // Above or below — default below
      tx = Math.max(8, Math.min(rect.left, vw - TOOLTIP_W - 8));
      ty = rect.top + rect.height + PAD;
      if (ty + TOOLTIP_H > vh - 8) {
        ty = rect.top - TOOLTIP_H - PAD;
      }
    }

    tooltipStyle = { position: 'fixed', top: ty, left: tx, width: TOOLTIP_W };
  }

  return (
    <>
      {/* Dim overlay — blocks pointer events on page content */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0)',
        }}
      />

      {/* Spotlight hole using box-shadow trick */}
      {rect && (
        <div
          key={currentStop.tourId}
          style={{
            position: 'fixed',
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            zIndex: 41,
            borderRadius: 10,
            border: '2px solid rgba(255,255,255,0.80)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.50)',
            pointerEvents: 'none',
            animation: 'spotlight-in 300ms cubic-bezier(0.2,0.8,0.2,1) both',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{ ...tooltipStyle, zIndex: 42 }}
        className="pointer-events-none rounded-lg bg-surface px-4 py-3 shadow-lift animate-rise"
      >
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-accent mb-1">
          {currentStop.label}
        </p>
        <p className="text-sm text-ink leading-relaxed">{currentStop.desc}</p>
      </div>
    </>
  );
}
