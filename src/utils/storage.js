import { DEFAULT_CATEGORIES, DEFAULT_DATA, DEFAULT_SETTINGS } from '../data/defaults';

const DB_NAME = 'personal-finance-tracker';
const DB_VERSION = 13;
const STORE_NAMES = ['expenses', 'fixedExpenses', 'incomes', 'investmentPortfolios', 'holdings', 'dividends', 'portfolioCashflows', 'portfolioSales', 'savings', 'savingsEntries', 'savingsGoals', 'budgets', 'rollovers', 'transfers', 'bankAccounts', 'debts', 'attachments', 'activityLog', 'portfolioSnapshots', 'attachmentBlobs'];
const SETTINGS_KEY = 'pft-settings';
const SYNC_META_KEY = 'pft-sync-meta';
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

// Per-version data migrations. Add an entry here whenever DB_VERSION is bumped.
// Each function receives the IDBDatabase and the upgrade transaction.
// Versions 1-13 predate this registry; no migrations are registered for them.
const MIGRATIONS = {
  // Example for future contributors:
  // 14: (_db, tx) => {
  //   const store = tx.objectStore('expenses');
  //   // mutate records, add indexes, etc.
  // },
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Ensure all stores exist (always safe to run)
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });

      // Run any pending migrations in order, starting after the last known version
      const fromVersion = Math.max(oldVersion, 13);
      for (let v = fromVersion + 1; v <= DB_VERSION; v++) {
        if (MIGRATIONS[v]) MIGRATIONS[v](db, event.target.transaction);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    if (request) {
      request.onerror = () => reject(request.error);
    }
  });
}

export async function getRecord(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(storeName, record) {
  await withStore(storeName, 'readwrite', (store) => store.put(record));
}

export async function putManyRecords(storeName, records) {
  await withStore(storeName, 'readwrite', (store) => {
    records.forEach((record) => store.put(record));
  });
}

export async function deleteRecord(storeName, id) {
  await withStore(storeName, 'readwrite', (store) => store.delete(id));
}

export async function clearAllStores() {
  await Promise.all(
    STORE_NAMES.map((storeName) => withStore(storeName, 'readwrite', (store) => store.clear())),
  );
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function loadSyncMeta() {
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) {
    return {
      lastPulledAt: {},
      deletedRecords: {},
      conflicts: [],
    };
  }

  try {
    return {
      lastPulledAt: {},
      deletedRecords: {},
      conflicts: [],
      ...JSON.parse(raw),
    };
  } catch {
    return {
      lastPulledAt: {},
      deletedRecords: {},
      conflicts: [],
    };
  }
}

export function saveSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

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
  localStorage.removeItem(SYNC_META_KEY);
}

// Optional demo seed. Drop a file at `src/data/demo.json` exported from
// Settings → Backup → Export JSON and it will be used as the seed for any
// fresh browser instead of the hardcoded defaults. Safe if absent.
const demoModules = import.meta.glob('../data/demo.json', { eager: true, import: 'default' });
const DEMO_BACKUP = Object.values(demoModules)[0] || null;

export function getDemoSettings() {
  return DEMO_BACKUP?.settings || null;
}

export async function ensureSeedData() {
  const seedFlag = localStorage.getItem('pft-seeded');
  if (seedFlag) return;

  const demoData = DEMO_BACKUP?.data;

  await Promise.all(
    STORE_NAMES.map((storeName) =>
      putManyRecords(storeName, (demoData?.[storeName]) || DEFAULT_DATA[storeName] || []),
    ),
  );

  if (DEMO_BACKUP?.settings) {
    const existing = localStorage.getItem(SETTINGS_KEY);
    if (!existing) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...DEMO_BACKUP.settings }));
    }
  }

  localStorage.setItem('pft-seeded', 'true');
}

export function ensureEntitySyncFields(entity, fallbackTimestamp = new Date().toISOString()) {
  return {
    ...entity,
    updatedAt: entity.updatedAt || fallbackTimestamp,
  };
}

export async function exportDatabaseSnapshot(settings, storeFilter = null) {
  const isModule = storeFilter !== null;
  const names = isModule ? STORE_NAMES.filter((n) => storeFilter.includes(n)) : STORE_NAMES;
  const stores = await Promise.all(
    names.map(async (storeName) => [storeName, await getAllRecords(storeName)]),
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    // Module backups omit settings — they're device-local and identity-managed
    ...(isModule ? {} : { settings }),
    data: Object.fromEntries(stores),
  };
}

// Fields that are intentionally per-device and must never travel through sync.
// Theme/locale are user-pickable per device; API keys and the offline toggle
// are local credentials/preferences.
const DEVICE_LOCAL_SETTINGS_KEYS = ['theme', 'locale', 'finnhubApiKey', 'alphaVantageApiKey', 'localOnlyMode'];

export function sanitizeSettingsForSync(settings) {
  const out = { ...settings };
  for (const key of DEVICE_LOCAL_SETTINGS_KEYS) delete out[key];
  return out;
}

// Apply a remote settings payload while preserving this device's local-only fields.
export function mergeRemoteSettings(localSettings, remotePayload) {
  const preserved = {};
  for (const key of DEVICE_LOCAL_SETTINGS_KEYS) {
    if (key in localSettings) preserved[key] = localSettings[key];
  }
  return { ...DEFAULT_SETTINGS, ...remotePayload, ...preserved };
}

export async function importDatabaseSnapshot(snapshot) {
  const entries = Object.entries(snapshot.data || {});
  await Promise.all(
    entries.map(async ([storeName, records]) => {
      if (!STORE_NAMES.includes(storeName)) return;
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        (records || []).forEach((record) => store.put(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    }),
  );
  if (snapshot.settings) {
    const currentSettings = loadSettings();
    saveSettings({
      ...DEFAULT_SETTINGS,
      ...snapshot.settings,
      locale: DEFAULT_SETTINGS.locale,
      // Never restore device-local / identity-managed fields from a backup
      theme: currentSettings.theme,
    });
  }
  // Reset sync state so old tombstones / cursors / conflicts don't corrupt the
  // newly imported data on the next push or pull.
  saveSyncMeta({ lastPulledAt: {}, deletedRecords: {}, conflicts: [] });
}
