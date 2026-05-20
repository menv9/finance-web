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

export function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
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

