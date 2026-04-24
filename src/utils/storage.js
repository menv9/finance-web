import { DEFAULT_DATA, DEFAULT_SETTINGS } from '../data/defaults';

const DB_NAME = 'personal-finance-tracker';
const DB_VERSION = 3;
const STORE_NAMES = ['expenses', 'fixedExpenses', 'incomes', 'holdings', 'dividends', 'portfolioCashflows', 'savings', 'savingsEntries'];
const SETTINGS_KEY = 'pft-settings';
const SYNC_META_KEY = 'pft-sync-meta';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
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
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
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

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
      const { supabaseUrl: _u, supabaseAnonKey: _k, ...safeSettings } = DEMO_BACKUP.settings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...safeSettings }));
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

export async function exportDatabaseSnapshot(settings) {
  const stores = await Promise.all(
    STORE_NAMES.map(async (storeName) => [storeName, await getAllRecords(storeName)]),
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    data: Object.fromEntries(stores),
  };
}

export function sanitizeSettingsForSync(settings) {
  return {
    ...settings,
    supabaseUrl: '',
    supabaseAnonKey: '',
  };
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
      supabaseUrl: currentSettings.supabaseUrl || '',
      supabaseAnonKey: currentSettings.supabaseAnonKey || '',
    });
  }
}
