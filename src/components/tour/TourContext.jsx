import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../../store/useFinanceStore';
import { TOUR_STEPS } from './tourSteps';

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const navigate = useNavigate();
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const setTourActive = useFinanceStore((s) => s.setTourActive);
  const onboardingTutorialCompleted = useFinanceStore(
    (s) => s.settings.onboardingTutorialCompleted,
  );

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);
  const autoStarted = useRef(false);

  const currentStep = TOUR_STEPS[stepIndex] ?? null;
  const currentStop = currentStep?.stops[stopIndex] ?? null;

  const startTour = useCallback(() => {
    setActive(true);
    setStepIndex(0);
    setStopIndex(0);
    setTourActive(true);
    navigate('/dashboard');
  }, [navigate, setTourActive]);

  const endTour = useCallback(
    (completed) => {
      setActive(false);
      setTourActive(false);
      updateSettings({ onboardingTutorialCompleted: true });
      if (completed) {
        navigate('/onboarding');
      }
    },
    [navigate, updateSettings, setTourActive],
  );

  const skipTour = useCallback(() => endTour(true), [endTour]);

  const nextStop = useCallback(() => {
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;
    if (stopIndex < step.stops.length - 1) {
      setStopIndex((i) => i + 1);
    } else if (stepIndex < TOUR_STEPS.length - 1) {
      const nextStepIndex = stepIndex + 1;
      setStepIndex(nextStepIndex);
      setStopIndex(0);
      navigate(TOUR_STEPS[nextStepIndex].route);
    } else {
      endTour(true);
    }
  }, [stepIndex, stopIndex, navigate, endTour]);

  const prevStop = useCallback(() => {
    if (stopIndex > 0) {
      setStopIndex((i) => i - 1);
    } else if (stepIndex > 0) {
      const prevStepIndex = stepIndex - 1;
      const prevStep = TOUR_STEPS[prevStepIndex];
      setStepIndex(prevStepIndex);
      setStopIndex(prevStep.stops.length - 1);
      navigate(prevStep.route);
    }
  }, [stepIndex, stopIndex, navigate]);

  // Auto-start for new users
  useEffect(() => {
    if (autoStarted.current) return;
    if (onboardingTutorialCompleted) return;
    autoStarted.current = true;
    const id = setTimeout(() => startTour(), 400);
    return () => clearTimeout(id);
  }, [onboardingTutorialCompleted, startTour]);

  return (
    <TourContext.Provider
      value={{
        active,
        stepIndex,
        stopIndex,
        currentStep,
        currentStop,
        startTour,
        nextStop,
        prevStop,
        skipTour,
        endTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}
