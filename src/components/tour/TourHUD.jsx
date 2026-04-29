import { useTour } from './TourContext';
import { TOUR_STEPS } from './tourSteps';

export function TourHUD() {
  const { active, stepIndex, stopIndex, currentStep, currentStop, nextStop, prevStop, skipTour } =
    useTour();

  if (!active || !currentStep || !currentStop) return null;

  const totalPages = TOUR_STEPS.length;
  const isFirstStop = stepIndex === 0 && stopIndex === 0;
  const isLastStop =
    stepIndex === TOUR_STEPS.length - 1 &&
    stopIndex === currentStep.stops.length - 1;

  return (
    <div
      style={{ zIndex: 50 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm animate-rise"
    >
      <div className="rounded-xl bg-surface shadow-lift border border-rule overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-accent">
            {currentStep.page}
          </span>
          <span className="text-xs text-ink-muted">
            {stepIndex + 1} / {totalPages}
          </span>
        </div>

        {/* Stop content */}
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
            {isLastStop ? 'Finish tour' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
