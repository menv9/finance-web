import { getSupabaseBrowserClient, getSupabaseConfig } from './supabase';
import { useFinanceStore } from '../store/useFinanceStore';

function getConfig() {
  const settings = useFinanceStore.getState().settings;
  return getSupabaseConfig(settings);
}

function fnHeaders() {
  const { anonKey } = getConfig();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
  };
}

function fnUrl(name) {
  const { url } = getConfig();
  return `${url}/functions/v1/${name}`;
}

export async function getInstitutions(country = 'ES') {
  const res = await fetch(
    `${fnUrl('gocardless-institutions')}?country=${country}`,
    { headers: fnHeaders() },
  );
  if (!res.ok) throw new Error('Failed to load institutions');
  return res.json();
}

export async function createBankLink({ institutionId, userId }) {
  const res = await fetch(fnUrl('gocardless-link'), {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ institution_id: institutionId, user_id: userId }),
  });
  if (!res.ok) throw new Error('Failed to create bank link');
  return res.json();
}

export async function syncBankAccounts(userId) {
  const res = await fetch(fnUrl('gocardless-sync'), {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
