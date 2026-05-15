import { getSupabaseBrowserClient } from './supabase';

export const LAYOUT_KEYS = [
  'cg-room-static',
  'cg-walls',
  'cg-home',
  'cg-shop',
  'cg-room-size',
  'cg-room-ambient',
];

export function serializeLocalLayout(coinId) {
  const out = {};
  for (const base of LAYOUT_KEYS) {
    const v = localStorage.getItem(`${base}-${coinId}`);
    if (v != null) out[base] = v;
  }
  return out;
}

export function applyLayoutToLocal(coinId, layout) {
  if (!layout || typeof layout !== 'object') return;
  for (const base of LAYOUT_KEYS) {
    const v = layout[base];
    if (v != null) localStorage.setItem(`${base}-${coinId}`, v);
  }
}

export async function fetchRoomLayout(coinId) {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('coingame_room_layouts')
    .select('layout')
    .eq('coin_id', coinId)
    .maybeSingle();
  if (error || !data) return null;
  return data.layout || null;
}

export async function saveRoomLayout(coinId, layout) {
  const sb = getSupabaseBrowserClient();
  if (!sb) return;
  await sb
    .from('coingame_room_layouts')
    .upsert({ coin_id: coinId, layout }, { onConflict: 'coin_id' });
}
