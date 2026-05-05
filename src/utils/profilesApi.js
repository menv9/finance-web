import { getSupabaseBrowserClient } from './supabase';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(value) {
  if (!value) return 'Username required';
  if (!USERNAME_RE.test(value)) return 'Use 3–20 lowercase letters, numbers, or underscores';
  return null;
}

// Derive a candidate username from an email's local-part.
// "erisbp.dev+test" → "erisbp_dev_test", padded with random digits if too short.
export function deriveUsername(email) {
  const local = String(email || '').split('@')[0].toLowerCase();
  let cleaned = local.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  cleaned = cleaned.slice(0, 16) || 'user';
  while (cleaned.length < 3) cleaned += String(Math.floor(Math.random() * 10));
  return cleaned;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

export async function fetchOwnProfile(userId) {
  const { data, error } = await client()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchProfilesByIds(ids) {
  if (!ids?.length) return [];
  const { data, error } = await client()
    .from('profiles')
    .select('*')
    .in('user_id', ids);
  if (error) throw error;
  return data ?? [];
}

// Insert a profile for the current user. Auto-suffix on unique conflict.
export async function createOwnProfile(userId, email) {
  const base = deriveUsername(email);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 16)}_${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await client()
      .from('profiles')
      .insert({ user_id: userId, username: candidate, social_enabled: true })
      .select('*')
      .single();
    if (!error) return data;
    // 23505 = unique violation. Retry with a suffix.
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique username — please set one manually.');
}

export async function updateOwnProfile(userId, patch) {
  const allowed = {};
  if (patch.username !== undefined) allowed.username = patch.username;
  if (patch.display_name !== undefined) allowed.display_name = patch.display_name;
  if (patch.bio !== undefined) allowed.bio = patch.bio;
  if (patch.avatar_url !== undefined) allowed.avatar_url = patch.avatar_url;
  if (patch.social_enabled !== undefined) allowed.social_enabled = patch.social_enabled;
  const { data, error } = await client()
    .from('profiles')
    .update(allowed)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function searchProfilesByUsername(query, currentUserId) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const { data, error } = await client()
    .from('profiles')
    .select('*')
    .ilike('username', `${q}%`)
    .neq('user_id', currentUserId)
    .neq('social_enabled', false)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function searchProfileByEmail(email, currentUserId) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return null;
  const { data: userId, error } = await client().rpc('find_user_by_email', { lookup_email: trimmed });
  if (error) throw error;
  if (!userId || userId === currentUserId) return null;
  const { data: profile, error: pErr } = await client()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (profile?.social_enabled === false) return null;
  return profile ?? null;
}

export async function fetchFriendships(userId) {
  const { data, error } = await client()
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return data ?? [];
}

export async function insertFriendRequest(requesterId, addresseeId) {
  const { data, error } = await client()
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  const { data, error } = await client()
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFriendship(requesterId, addresseeId) {
  const { error } = await client()
    .from('friendships')
    .delete()
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId);
  if (error) throw error;
}

const AVATAR_BUCKET = 'profile-avatars';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_LIMITS = {
  maxBytes: AVATAR_MAX_BYTES,
  acceptMime: 'image/*',
};

export function avatarPathFromUrl(url) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function extFromFile(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
}

function randomSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadAvatar(userId, file) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('Avatar must be an image.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Avatar must be 5 MB or smaller.');
  }
  const ext = extFromFile(file);
  const path = `${userId}/${randomSuffix()}.${ext}`;
  const c = client();
  const { error: uploadError } = await c.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data } = c.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removeAvatarObject(path) {
  if (!path) return;
  const { error } = await client().storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}
