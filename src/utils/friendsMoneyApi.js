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

export async function createLedgerEntry({ creditorId, debtorId, amountCents, currency = 'EUR', kind = 'manual', note = '', createdBy, parentIouId = null }) {
  const { data, error } = await client()
    .from('friend_ledger')
    .insert({ creditor_id: creditorId, debtor_id: debtorId, amount_cents: amountCents, currency, kind, note, created_by: createdBy, parent_expense_id: parentIouId })
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateLedgerEntry(entryId, patch = {}) {
  const allowed = {};
  if (patch.amountCents !== undefined) allowed.amount_cents = patch.amountCents;
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.settledAt !== undefined) allowed.settled_at = patch.settledAt;
  if (patch.settledBy !== undefined) allowed.settled_by = patch.settledBy;
  const { data, error } = await client()
    .from('friend_ledger')
    .update(allowed)
    .eq('id', entryId)
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

export async function acceptLedgerEntry(entryId) {
  const { data, error } = await client()
    .from('friend_ledger')
    .update({ status: 'accepted' })
    .eq('id', entryId)
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function rejectLedgerEntry(entryId) {
  const { data, error } = await client()
    .from('friend_ledger')
    .update({ status: 'rejected' })
    .eq('id', entryId)
    .select(LEDGER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function applyPartialIouPayment(paymentId, iouId, paymentCents, settledBy) {
  const { error } = await client()
    .rpc('apply_partial_iou_payment', {
      p_payment_id: paymentId,
      p_iou_id: iouId,
      p_payment_cents: paymentCents,
      p_settled_by: settledBy,
    });
  if (error) throw error;
}

export async function deleteLedgerEntry(entryId) {
  const { error } = await client()
    .from('friend_ledger')
    .delete()
    .eq('id', entryId);
  if (error) throw error;
}
