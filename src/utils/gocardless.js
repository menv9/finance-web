const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function fnHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

export async function getInstitutions(country = 'ES') {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gocardless-institutions?country=${country}`,
    { headers: fnHeaders() },
  );
  if (!res.ok) throw new Error('Failed to load institutions');
  return res.json();
}

export async function createBankLink({ institutionId, userId }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gocardless-link`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ institution_id: institutionId, user_id: userId }),
  });
  if (!res.ok) throw new Error('Failed to create bank link');
  return res.json();
}

export async function syncBankAccounts(userId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gocardless-sync`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
