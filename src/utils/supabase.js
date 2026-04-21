import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'pft-supabase-auth';

function createScopedStorage(key) {
  return {
    getItem: async () => window.localStorage.getItem(key),
    setItem: async (_, value) => window.localStorage.setItem(key, value),
    removeItem: async () => window.localStorage.removeItem(key),
  };
}

let supabaseClient = null;

export function getSupabaseConfig(settings) {
  return {
    url: settings?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: settings?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  };
}

export function createSupabaseBrowserClient(settings) {
  const { url, anonKey } = getSupabaseConfig(settings);
  if (!url || !anonKey) {
    return null;
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
      storage: createScopedStorage(STORAGE_KEY),
    },
  });

  return supabaseClient;
}

export function getSupabaseBrowserClient() {
  return supabaseClient;
}

export function clearSupabaseBrowserClient() {
  supabaseClient = null;
}

export async function upsertRemoteRecords(client, records) {
  if (!records.length) return;
  const { error } = await client.from('finance_records').upsert(records, {
    onConflict: 'user_id,store_name,record_id',
  });
  if (error) throw error;
}

export async function fetchRemoteChanges(client, userId, sinceIso) {
  let query = client
    .from('finance_records')
    .select('store_name, record_id, payload, updated_at, deleted_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (sinceIso) {
    query = query.gt('updated_at', sinceIso);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
