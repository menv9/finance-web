import { getSupabaseBrowserClient } from './supabase';

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function insertActivity(userId, type, payload = {}) {
  const { data, error } = await client()
    .from('social_activity')
    .insert({ user_id: userId, type, payload })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchFeedForUser(userId, friendIds) {
  const allIds = [userId, ...friendIds];
  const { data, error } = await client()
    .from('social_activity')
    .select('*, activity_reactions(*), activity_comments(*, profiles(username, display_name, avatar_url))')
    .in('user_id', allIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchOwnActivity(userId) {
  const { data, error } = await client()
    .from('social_activity')
    .select('*, activity_reactions(*), activity_comments(*, profiles(username, display_name, avatar_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function deleteActivity(activityId) {
  const { error } = await client()
    .from('social_activity')
    .delete()
    .eq('id', activityId);
  if (error) throw error;
}

// ── Privacy ───────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  'goal_reached', 'debt_paid', 'savings_milestone',
  'goal_created', 'shared_goal_created', 'shared_goal_reached',
];

export { ALL_TYPES as ACTIVITY_TYPES };

export async function completeSharedGoalIfReached(goalId) {
  const { data, error } = await client()
    .rpc('complete_shared_goal_if_reached', { p_goal_id: goalId });
  if (error) throw error;
  return data; // boolean: true if this call newly completed the goal
}

export async function fetchActivityPrivacy(userId) {
  const { data, error } = await client()
    .from('activity_privacy')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  // Return defaults if no row exists yet
  return data ?? { user_id: userId, feed_enabled: true, visible_types: ALL_TYPES };
}

export async function upsertActivityPrivacy(userId, patch) {
  const { data, error } = await client()
    .from('activity_privacy')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export async function addReaction(activityId, userId, emoji) {
  const { data, error } = await client()
    .from('activity_reactions')
    .upsert({ activity_id: activityId, user_id: userId, emoji }, { onConflict: 'activity_id,user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeReaction(activityId, userId) {
  const { error } = await client()
    .from('activity_reactions')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(activityId, userId, body) {
  const { data, error } = await client()
    .from('activity_comments')
    .insert({ activity_id: activityId, user_id: userId, body })
    .select('*, profiles(username, display_name, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await client()
    .from('activity_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

// ── Shared goals ──────────────────────────────────────────────────────────────

export async function fetchSharedGoals(userId) {
  const { data, error } = await client()
    .from('shared_goal_participants')
    .select(`
      goal_id,
      joined_at,
      shared_goals (
        id, creator_id, name, target_cents, currency, description, emoji, created_at, completed_at,
        shared_goal_participants ( goal_id, user_id, joined_at, status, profiles(username, display_name, avatar_url) ),
        shared_goal_contributions ( id, goal_id, user_id, amount_cents, note, created_at )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;
  return (data ?? []).map((row) => row.shared_goals).filter(Boolean);
}

export async function fetchGoalInvitations(userId) {
  const { data, error } = await client()
    .from('shared_goal_participants')
    .select(`
      goal_id,
      shared_goals (
        id, creator_id, name, target_cents, currency, description, emoji, created_at,
        shared_goal_participants ( goal_id, user_id, status, profiles(username, display_name, avatar_url) )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'invited');
  if (error) throw error;
  return (data ?? []).map((row) => row.shared_goals).filter(Boolean);
}

export async function acceptGoalInvitation(goalId, userId) {
  const { error } = await client()
    .from('shared_goal_participants')
    .update({ status: 'accepted' })
    .eq('goal_id', goalId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createSharedGoal(creatorId, { name, targetCents, currency, description, emoji, inviteIds = [] }) {
  const c = client();

  // Generate ID client-side so we can add the creator as a participant before
  // selecting the goal back — the SELECT policy requires participant membership.
  const goalId = crypto.randomUUID();

  const { error: gErr } = await c
    .from('shared_goals')
    .insert({ id: goalId, creator_id: creatorId, name, target_cents: targetCents, currency, description, emoji });
  if (gErr) throw gErr;

  // Add creator (accepted) + invitees (invited) as participants
  const uniqueInviteIds = inviteIds.filter((id) => id !== creatorId);
  const participants = [
    { goal_id: goalId, user_id: creatorId, status: 'accepted' },
    ...uniqueInviteIds.map((uid) => ({ goal_id: goalId, user_id: uid, status: 'invited' })),
  ];
  const { error: pErr } = await c.from('shared_goal_participants').insert(participants);
  if (pErr) throw pErr;

  // Now we're a participant so the SELECT policy allows this read
  const { data: goal, error: rErr } = await c
    .from('shared_goals')
    .select('*')
    .eq('id', goalId)
    .single();
  if (rErr) throw rErr;

  return goal;
}

export async function updateSharedGoal(goalId, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.targetCents !== undefined) allowed.target_cents = patch.targetCents;
  if (patch.currency !== undefined) allowed.currency = patch.currency;
  if (patch.description !== undefined) allowed.description = patch.description;
  if (patch.emoji !== undefined) allowed.emoji = patch.emoji;
  if (patch.completedAt !== undefined) allowed.completed_at = patch.completedAt;

  const { data, error } = await client()
    .from('shared_goals')
    .update(allowed)
    .eq('id', goalId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSharedGoal(goalId) {
  const { error } = await client()
    .from('shared_goals')
    .delete()
    .eq('id', goalId);
  if (error) throw error;
}

export async function addGoalParticipant(goalId, userId) {
  const { error } = await client()
    .from('shared_goal_participants')
    .insert({ goal_id: goalId, user_id: userId, status: 'invited' });
  if (error) throw error;
}

export async function removeGoalParticipant(goalId, userId) {
  const { error } = await client()
    .from('shared_goal_participants')
    .delete()
    .eq('goal_id', goalId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function addContribution(goalId, userId, amountCents, note = '') {
  const { data, error } = await client()
    .from('shared_goal_contributions')
    .insert({ goal_id: goalId, user_id: userId, amount_cents: amountCents, note })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContribution(contributionId) {
  const { error } = await client()
    .from('shared_goal_contributions')
    .delete()
    .eq('id', contributionId);
  if (error) throw error;
}
