import { useEffect, useRef, useState } from 'react';
import { useTour } from './TourContext';
import { TOUR_STEPS } from './tourSteps';

const PAD = 8;
const TOOLTIP_W = 280;
const TOOLTIP_H = 200;

export function TourSpotlight() {
  const {
    active,
    stepIndex,
    stopIndex,
    currentStep,
    currentStop,
    nextStop,
    prevStop,
    skipTour,
  } = useTour();
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
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });

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

  if (!active || !currentStop || !currentStep) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const isFirstStop = stepIndex === 0 && stopIndex === 0;
  const isLastStop =
    stepIndex === TOUR_STEPS.length - 1 &&
    stopIndex === currentStep.stops.length - 1;

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
      {/* Dim overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none' }} />

      {/* Spotlight hole */}
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

      {/* Tooltip + controls — single card */}
      <div
        key={`tooltip-${currentStop.tourId}`}
        style={{ ...tooltipStyle, zIndex: 42 }}
        className="rounded-xl bg-surface shadow-lift border border-rule overflow-hidden animate-rise"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-accent">
            {currentStep.page}
          </span>
          <span className="text-xs text-ink-muted">
            {stepIndex + 1} / {TOUR_STEPS.length}
          </span>
        </div>

        {/* Content */}
        <div className="px-4 pb-2">
          <p className="text-sm font-semibold text-ink">{currentStop.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">{currentStop.desc}</p>
        </div>

        {/* Stop dots */}
        <div className="flex items-center gap-1.5 px-4 pb-3">
          {currentStep.stops.map((_, i) => (
            <span
              key={i}
              className={`block h-1.5 rounded-full transition-all duration-180 ${
                i === stopIndex ? 'w-4 bg-accent' : 'w-1.5 bg-rule-strong'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center border-t border-rule">
          <button
            onClick={prevStop}
            disabled={isFirstStop}
            className="flex-1 py-2.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-120"
          >
            ← Back
          </button>
          <span className="w-px h-5 bg-rule" />
          <button
            onClick={skipTour}
            className="flex-1 py-2.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors duration-120"
          >
            Skip tour
          </button>
          <span className="w-px h-5 bg-rule" />
          <button
            onClick={nextStop}
            className="flex-1 py-2.5 text-xs font-semibold text-accent hover:text-accent-strong transition-colors duration-120"
          >
            {isLastStop ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
