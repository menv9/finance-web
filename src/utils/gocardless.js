import { getSupabaseBrowserClient, getSupabaseConfig } from './supabase';
import { useFinanceStore } from '../store/useFinanceStore';

async function getAuthToken() {
  const client = getSupabaseBrowserClient();
  if (client) {
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      // Refresh if token expires within the next 60 seconds
      const expiresAt = session.expires_at ?? 0;
      if (expiresAt - Date.now() / 1000 < 60) {
        const { data: refreshed } = await client.auth.refreshSession();
        if (refreshed?.session?.access_token) return refreshed.session.access_token;
      }
      return session.access_token;
    }
  }
  throw new Error('Not authenticated — sign in to use GoCardless.');
}

function getBaseUrl() {
  const settings = useFinanceStore.getState().settings;
  return getSupabaseConfig(settings).url;
}

export async function getInstitutions(country = 'ES') {
  const token = await getAuthToken();
  const res = await fetch(
    `${getBaseUrl()}/functions/v1/gocardless-institutions?country=${country}`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Failed to load institutions');
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.results ?? data?.institutions ?? []);
}

export async function createBankLink({ institutionId, userId }) {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}/functions/v1/gocardless-link`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ institution_id: institutionId, user_id: userId }),
  });
  if (!res.ok) throw new Error('Failed to create bank link');
  return res.json();
}

export async function syncBankAccounts(userId) {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}/functions/v1/gocardless-sync`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
