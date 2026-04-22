import { useEffect, useRef, useState } from 'react';

export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const DUR = { fast: 120, base: 180, slow: 260 };

/**
 * Returns a className that applies the rise animation with staggered delay.
 * Usage: <div className={rise(i)}>...</div>
 */
export function rise(index = 0) {
  const clamped = Math.min(Math.max(index, 0), 6);
  return clamped === 0 ? 'rise' : `rise rise-${clamped}`;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts up from 0 to `target` over ~600ms using an ease-out curve.
 * Returns a live number suitable for display. Respects prefers-reduced-motion.
 * Re-runs when `target` changes.
 */
export function useCountUp(target, { duration = 600, enabled = true } = {}) {
  const [value, setValue] = useState(typeof target === 'number' ? target : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      setValue(target);
      return undefined;
    }
    if (!enabled || prefersReducedMotion() || duration <= 0) {
      setValue(target);
      return undefined;
    }

    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setValue(to);
      return undefined;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}

/**
 * Fires once when `ref.current` enters the viewport. Never flips back to false.
 * Lightweight alternative to framer-motion's whileInView for one-shot reveals.
 */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, ...options },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options.threshold, options.root, options.rootMargin]);

  return [ref, inView];
}
