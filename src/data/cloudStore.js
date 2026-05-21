import { getSupabaseBrowserClient } from '../utils/supabase';

// All finance_records store_name values. Mirrors the zustand entity names.
// `settings` and `savings` are singletons (one row per user).
export const CLOUD_STORES = [
  'expenses',
  'fixedExpenses',
  'incomes',
  'investmentPortfolios',
  'holdings',
  'dividends',
  'portfolioCashflows',
  'portfolioSales',
  'savings',
  'savingsEntries',
  'savingsGoals',
  'budgets',
  'rollovers',
  'transfers',
  'bankAccounts',
  'debts',
  'attachments',
  'activityLog',
  'portfolioSnapshots',
  'settings',
];

export const SETTINGS_RECORD_ID = 'singleton';
export const SAVINGS_RECORD_ID = 'savings-config';

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error('cloudStore: Supabase client not initialized');
  return c;
}

async function requireUserId() {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  const id = data?.user?.id;
  if (!id) throw new Error('cloudStore: not authenticated');
  return id;
}

function nowIso() {
  return new Date().toISOString();
}

function resolveRecordId(storeName, record, explicitId) {
  if (explicitId) return explicitId;
  if (storeName === 'settings') return SETTINGS_RECORD_ID;
  if (storeName === 'savings') return SAVINGS_RECORD_ID;
  const id = record?.id;
  if (!id) throw new Error(`cloudStore.upsert(${storeName}): record has no id`);
  return id;
}

export async function fetchStore(storeName) {
  const uid = await requireUserId();
  const { data, error } = await client()
    .from('finance_records')
    .select('record_id, payload, updated_at')
    .eq('user_id', uid)
    .eq('store_name', storeName);
  if (error) throw error;
  return (data || []).filter((row) => row.payload).map((row) => row.payload);
}

// Pull everything for the current user in one round-trip. Returns
// `{ [storeName]: payload[] }` keyed by every entry in CLOUD_STORES.
export async function fetchAllForUser() {
  const uid = await requireUserId();
  const { data, error } = await client()
    .from('finance_records')
    .select('store_name, record_id, payload, updated_at')
    .eq('user_id', uid);
  if (error) throw error;

  const buckets = Object.fromEntries(CLOUD_STORES.map((s) => [s, []]));
  for (const row of data || []) {
    if (!row.payload) continue;
    if (!buckets[row.store_name]) buckets[row.store_name] = [];
    buckets[row.store_name].push(row.payload);
  }
  return buckets;
}

export async function fetchSingleton(storeName, recordId) {
  const uid = await requireUserId();
  const { data, error } = await client()
    .from('finance_records')
    .select('payload, updated_at')
    .eq('user_id', uid)
    .eq('store_name', storeName)
    .eq('record_id', recordId)
    .maybeSingle();
  if (error) throw error;
  return data?.payload ?? null;
}

export async function fetchSettings() {
  return fetchSingleton('settings', SETTINGS_RECORD_ID);
}

export async function upsertRecord(storeName, record, { recordId } = {}) {
  const uid = await requireUserId();
  const id = resolveRecordId(storeName, record, recordId);
  const updatedAt = nowIso();
  const payload = { ...record, updatedAt };
  const { error } = await client()
    .from('finance_records')
    .upsert(
      {
        user_id: uid,
        store_name: storeName,
        record_id: id,
        payload,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,store_name,record_id' },
    );
  if (error) throw error;
  return payload;
}

export async function upsertMany(storeName, records) {
  if (!records?.length) return [];
  const uid = await requireUserId();
  const updatedAt = nowIso();
  const rows = records.map((record) => ({
    user_id: uid,
    store_name: storeName,
    record_id: resolveRecordId(storeName, record),
    payload: { ...record, updatedAt },
    updated_at: updatedAt,
  }));
  const { error } = await client()
    .from('finance_records')
    .upsert(rows, { onConflict: 'user_id,store_name,record_id' });
  if (error) throw error;
  return rows.map((row) => row.payload);
}

export async function saveSettings(settings) {
  return upsertRecord('settings', settings, { recordId: SETTINGS_RECORD_ID });
}

export async function removeRecord(storeName, recordId) {
  const uid = await requireUserId();
  const { error } = await client()
    .from('finance_records')
    .delete()
    .eq('user_id', uid)
    .eq('store_name', storeName)
    .eq('record_id', recordId);
  if (error) throw error;
}

export async function removeMany(storeName, recordIds) {
  if (!recordIds?.length) return;
  const uid = await requireUserId();
  const { error } = await client()
    .from('finance_records')
    .delete()
    .eq('user_id', uid)
    .eq('store_name', storeName)
    .in('record_id', recordIds);
  if (error) throw error;
}

// Wipe every finance_records row for the current user. Used by the
// "Erase all data" action and by the IndexedDB-cleanup migration.
export async function wipeAllForUser() {
  const uid = await requireUserId();
  const { error } = await client()
    .from('finance_records')
    .delete()
    .eq('user_id', uid);
  if (error) throw error;
}

// Subscribe to realtime changes for the current user's finance_records.
// Callback receives `{ event: 'INSERT'|'UPDATE'|'DELETE', storeName, recordId, payload }`.
// Returns an unsubscribe function.
export function subscribeAll(userId, onChange) {
  const channel = client()
    .channel(`finance_records:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'finance_records',
        filter: `user_id=eq.${userId}`,
      },
      (msg) => {
        const row = msg.new && Object.keys(msg.new).length ? msg.new : msg.old;
        if (!row) return;
        onChange({
          event: msg.eventType,
          storeName: row.store_name,
          recordId: row.record_id,
          payload: msg.new?.payload ?? null,
        });
      },
    )
    .subscribe();

  return () => {
    client().removeChannel(channel);
  };
}
