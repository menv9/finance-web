const KEY = 'pft-fin-mode';

export function loadAppMode() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'lite' ? 'lite' : 'pro';
  } catch {
    return 'pro';
  }
}

export function saveAppMode(mode) {
  try {
    window.localStorage.setItem(KEY, mode === 'lite' ? 'lite' : 'pro');
  } catch {
    // localStorage unavailable (private mode, etc.) — silent
  }
}

export const LITE_PATHS = new Set([
  '/today',
  '/expenses',
  '/income',
  '/profile',
  '/settings',
]);
