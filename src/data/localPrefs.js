// Device-local preferences. These never travel through Supabase — they belong
// to the browser, not the user account. Theme/locale are user-pickable per
// device; the API keys are local credentials that pair with a device.
const STORAGE_KEY = 'pft-local-prefs';

export const DEFAULT_LOCAL_PREFS = {
  theme: 'light',
  locale: 'en-GB',
  finnhubApiKey: '',
  alphaVantageApiKey: '',
};

export const LOCAL_PREF_KEYS = Object.keys(DEFAULT_LOCAL_PREFS);

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(prefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function loadLocalPrefs() {
  return { ...DEFAULT_LOCAL_PREFS, ...(read() || {}) };
}

export function saveLocalPrefs(prefs) {
  const next = { ...DEFAULT_LOCAL_PREFS, ...(read() || {}), ...prefs };
  // Strip anything that isn't a known local pref so callers can't accidentally
  // smuggle synced settings into localStorage.
  const sanitized = Object.fromEntries(
    LOCAL_PREF_KEYS.map((key) => [key, next[key]]),
  );
  write(sanitized);
  return sanitized;
}

export function updateLocalPref(key, value) {
  if (!LOCAL_PREF_KEYS.includes(key)) {
    throw new Error(`localPrefs: unknown key "${key}"`);
  }
  return saveLocalPrefs({ [key]: value });
}

// One-time helper for Phase 4 migration: when bootstrapping a user who still
// has the merged settings blob in IndexedDB, peel off the device-local fields
// into localStorage before discarding the IndexedDB copy.
export function adoptFromLegacySettings(legacySettings) {
  if (!legacySettings) return loadLocalPrefs();
  const carried = {};
  for (const key of LOCAL_PREF_KEYS) {
    if (key in legacySettings) carried[key] = legacySettings[key];
  }
  return saveLocalPrefs(carried);
}
