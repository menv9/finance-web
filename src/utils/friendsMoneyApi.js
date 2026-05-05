import { getSupabaseBrowserClient } from './supabase';

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

const LEDGER_SELECT = `
  id, creditor_id, debtor_id, amount_cents, currency, kind, status,
  note, parent_expense_id, group_key, created_by, created_at, settled_at, settled_by,
  creditor:profiles!friend_ledger_creditor_fkey(user_id, username, display_name, avatar_url),
  debtor:profiles!friend_ledger_debtor_fkey(user_id, username, display_name, avatar_url)
`;

export async function fetchFriendLedger(userId) {
  const { data, error } = await client()
    .from('friend_ledger')
    .select(LEDGER_SELECT)
    .or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLedgerEntry({ creditorId, debtorId, amountCents, currency = 'EUR', kind = 'manual', note = '', createdBy }) {
  const { data, error } = await client()
    .from('friend_ledger')
    .insert({ creditor_id: creditorId, debtor_id: debtorId, amount_cents: amountCents, currency, kind, note, created_by: createdBy })
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function settleLedgerEntry(entryId, settledBy) {
  const { data, error } = await client()
    .from('friend_ledger')
    .update({ status: 'settled', settled_at: new Date().toISOString(), settled_by: settledBy })
    .eq('id', entryId)
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function cancelLedgerEntry(entryId) {
  const { data, error } = await client()
    .from('friend_ledger')
    .update({ status: 'cancelled' })
    .eq('id', entryId)
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLedgerEntry(entryId) {
  const { error } = await client()
    .from('friend_ledger')
    .delete()
    .eq('id', entryId);
  if (error) throw error;
}
