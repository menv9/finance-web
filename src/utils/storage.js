import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../data/defaults';
import {
  fetchAllForUser,
  fetchStore,
  removeMany,
  removeRecord,
  saveSettings as cloudSaveSettings,
  upsertMany,
  upsertRecord,
  wipeAllForUser,
} from '../data/cloudStore';

// ---------------------------------------------------------------------------
// Persistence layer (Phase 2a: cloud-only)
//
// `finance_records` in Supabase is the source of truth. The helpers below keep
// the same names/signatures the rest of the app already uses so call sites
// don't need to change in this pass. IndexedDB is no longer touched here.
// Settings still live in localStorage as a fast device-local cache for the
// boot path; the in-memory zustand state is hydrated from Supabase right after
// bootstrap and used as truth from then on.
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'pft-settings';
const LEGACY_DEFAULT_CATEGORIES = [
  'Vivienda',
  'Transporte',
  'Alimentacion',
  'Suscripciones',
  'Ocio',
  'Salud',
  'Otros',
];

function normalizeSettings(settings) {
  const categories = Array.isArray(settings.categories) ? settings.categories : DEFAULT_CATEGORIES;
  const hasLegacyDefaults =
    categories.length === LEGACY_DEFAULT_CATEGORIES.length &&
    categories.every((category, index) => category === LEGACY_DEFAULT_CATEGORIES[index]);

  return {
    ...settings,
    categories: hasLegacyDefaults ? DEFAULT_CATEGORIES : categories,
    locale: DEFAULT_SETTINGS.locale,
  };
}

// --- Per-record helpers (cloud-backed) -------------------------------------

export async function getRecord(storeName, id) {
  const records = await fetchStore(storeName);
  return records.find((r) => r.id === id) ?? null;
}

export async function getAllRecords(storeName) {
  return fetchStore(storeName);
}

export async function putRecord(storeName, record) {
  await upsertRecord(storeName, record);
}

export async function putManyRecords(storeName, records) {
  await upsertMany(storeName, records);
}

export async function deleteRecord(storeName, id) {
  await removeRecord(storeName, id);
}

export async function deleteManyRecords(storeName, ids) {
  await removeMany(storeName, ids);
}

export async function clearAllStores() {
  await wipeAllForUser();
}

// Single-shot hydration for bootstrap: pulls every row for the current user
// in one round-trip and returns `{ [storeName]: payload[] }`.
export async function fetchAllStoresForCurrentUser() {
  return fetchAllForUser();
}

// --- One-time migration: drop the legacy IndexedDB database ---------------
// Phase 1 of the cloud-only switchover left a hefty `personal-finance-tracker`
// IDB on every existing device. Nothing reads it anymore; this just frees the
// space. Marker keeps us from re-deleting on every boot.

const IDB_CLEANUP_KEY = 'pft-idb-cleanup-v1';
const LEGACY_DB_NAME = 'personal-finance-tracker';

export function cleanupLegacyIndexedDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  if (localStorage.getItem(IDB_CLEANUP_KEY)) return;
  try {
    const req = window.indexedDB.deleteDatabase(LEGACY_DB_NAME);
    req.onsuccess = () => localStorage.setItem(IDB_CLEANUP_KEY, '1');
    req.onerror = () => { /* leave the marker unset so we retry next boot */ };
    req.onblocked = () => { /* same — try again next time */ };
  } catch {
    // best-effort: never break boot over this
  }
}

// --- Settings (localStorage cache + cloud singleton) -----------------------

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Write to localStorage immediately (so the next cold start has the right
// theme/locale before the cloud round-trip finishes) and asynchronously
// upsert the same payload into Supabase. Errors propagate so callers can
// decide whether to revert.
export function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  // Fire-and-forget: cloud write doesn't block the UI thread. Callers that
  // need the awaited write should use `saveSettingsToCloud` directly.
  cloudSaveSettings(normalized).catch(() => {});
}

export async function saveSettingsToCloud(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  await cloudSaveSettings(normalized);
  return normalized;
}

export function cacheSettingsLocally(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

// --- Sync-engine stubs (Phase 2a: dead code kept callable) -----------------
// These exist so the old call sites keep compiling. They will be deleted
// outright in Phase 2b once the sync engine itself is gone.

export function loadSyncMeta() {
  return { lastPulledAt: {}, deletedRecords: {}, conflicts: [] };
}

export function saveSyncMeta() {
  // no-op
}

export function sanitizeSettingsForSync(settings) {
  return settings;
}

export function mergeRemoteSettings(_local, remote) {
  return remote;
}

export function ensureEntitySyncFields(entity, fallbackTimestamp = new Date().toISOString()) {
  return {
    ...entity,
    updatedAt: entity.updatedAt || fallbackTimestamp,
  };
}

// --- Active user pointer (localStorage; still useful) ----------------------

const ACTIVE_USER_KEY = 'pft-active-user';

export function getActiveUserId() {
  return localStorage.getItem(ACTIVE_USER_KEY);
}

export function setActiveUserId(id) {
  localStorage.setItem(ACTIVE_USER_KEY, id);
}

export function clearActiveUserId() {
  localStorage.removeItem(ACTIVE_USER_KEY);
}

export function clearLocalUserData() {
  localStorage.removeItem(SETTINGS_KEY);
}

// --- Seed / backup helpers --------------------------------------------------
// Seeding is now a no-op: a fresh user starts with whatever Supabase returns
// (usually empty). The onboarding flow handles first-run UX.

export async function ensureSeedData() {
  // no-op (cloud is truth)
}

const demoModules = import.meta.glob('../data/demo.json', { eager: true, import: 'default' });
const DEMO_BACKUP = Object.values(demoModules)[0] || null;

export function getDemoSettings() {
  return DEMO_BACKUP?.settings || null;
}

// Export the user's cloud state as a JSON snapshot. The optional
// `storeFilter` matches the previous behavior of per-module exports.
export async function exportDatabaseSnapshot(settings, storeFilter = null) {
  const isModule = storeFilter !== null;
  const buckets = await fetchAllForUser();
  const entries = Object.entries(buckets).filter(([storeName]) =>
    isModule ? storeFilter.includes(storeName) : storeName !== 'settings',
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...(isModule ? {} : { settings }),
    data: Object.fromEntries(entries),
  };
}

// Import a JSON snapshot: hard-replace each store's contents in Supabase.
// For now we simply upsert the records by id; existing records with ids not
// in the snapshot are left alone (callers can call clearAllStores first if
// they want a true replace).
export async function importDatabaseSnapshot(snapshot) {
  const entries = Object.entries(snapshot.data || {});
  for (const [storeName, records] of entries) {
    if (!Array.isArray(records) || records.length === 0) continue;
    await upsertMany(storeName, records);
  }
  if (snapshot.settings) {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...snapshot.settings,
      locale: DEFAULT_SETTINGS.locale,
      // Backup files don't override the active device's theme.
      theme: loadSettings().theme,
    };
    await saveSettingsToCloud(merged);
  }
}
