import { getSupabaseBrowserClient } from './supabase';

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

async function rpc(fn, args = {}) {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw error;
  return data;
}

// ── Initialization ────────────────────────────────────────────────────────────

/** Creates wallet + personal coin if they don't exist. Safe to call on every mount. */
export async function ensureWallet() {
  const rows = await rpc('cg_ensure_wallet');
  return rows?.[0] ?? null;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export async function fetchWallet(userId) {
  const { data, error } = await client()
    .from('coingame_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Coins ─────────────────────────────────────────────────────────────────────

export async function fetchCoinByOwner(ownerUserId) {
  const { data, error } = await client()
    .from('coingame_coins')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCoinById(coinId) {
  const { data, error } = await client()
    .from('coingame_coins')
    .select('*, profiles(username, display_name, avatar_url)')
    .eq('coin_id', coinId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Trending: coins with most tokens_minted, joined with owner profile. */
export async function fetchTrending(limit = 20) {
  const { data, error } = await client()
    .from('coingame_coins')
    .select('*, profiles(username, display_name, avatar_url)')
    .order('tokens_minted', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Search coins by owner username. */
export async function searchCoins(query, limit = 20) {
  const { data, error } = await client()
    .from('coingame_coins')
    .select('*, profiles!inner(username, display_name, avatar_url)')
    .ilike('profiles.username', `%${query}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Holdings ──────────────────────────────────────────────────────────────────

export async function fetchHoldings(userId) {
  const { data, error } = await client()
    .from('coingame_holdings')
    .select('*, coingame_coins(*, profiles(username, display_name, avatar_url))')
    .eq('holder_user_id', userId)
    .gt('tokens_held', 0)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Trading (via SECURITY DEFINER RPCs) ──────────────────────────────────────

/**
 * Buy `tokens` of a coin.
 * Returns { tokens, cost, fee, total_charge, spot_price, new_balance }.
 */
export async function buyCoin(coinId, tokens) {
  return rpc('cg_buy_coin', { p_coin_id: coinId, p_tokens: tokens });
}

/**
 * Sell `tokens` of a coin.
 * Returns { tokens, proceeds, fee, fee_rate, net_proceeds, realized_pnl, spot_price }.
 */
export async function sellCoin(coinId, tokens) {
  return rpc('cg_sell_coin', { p_coin_id: coinId, p_tokens: tokens });
}

// ── Daily reward ──────────────────────────────────────────────────────────────

/** Returns { reward, streak, new_balance }. Throws if already claimed today. */
export async function claimDaily() {
  return rpc('cg_claim_daily');
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function fetchTransactions(userId, { limit = 50, offset = 0 } = {}) {
  const { data, error } = await client()
    .from('coingame_transactions')
    .select('*, coingame_coins(owner_user_id, profiles(username, display_name, avatar_url))')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .in('tx_type', ['buy', 'sell', 'reward', 'starter_grant'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

/**
 * metric: 'gains_fc' | 'volume_fc' | 'trades_count'
 */
export async function fetchWeeklyLeaderboard(metric = 'gains_fc', limit = 100) {
  const allowed = ['gains_fc', 'volume_fc', 'trades_count'];
  const col = allowed.includes(metric) ? metric : 'gains_fc';

  const { data, error } = await client()
    .from('coingame_leaderboard_current_week')
    .select('*')
    .order(col, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Economy (read-only snapshot) ──────────────────────────────────────────────

export async function fetchEconomy() {
  const { data, error } = await client()
    .from('coingame_economy')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
}

// ── Pricing helpers (client-side, mirrors SQL curve) ─────────────────────────

const K_SEGMENTS = [
  { limit: 100_000, k: 2e-8 },
  { limit: 500_000, k: 1e-8 },
  { limit: 1_000_000, k: 5e-9 },
  { limit: Infinity, k: 5e-9 },
];

function kAt(t) {
  return K_SEGMENTS.find((s) => t < s.limit).k;
}

export function spotPrice(tokensMinted, basePrice = 1) {
  return basePrice + kAt(tokensMinted) * tokensMinted * tokensMinted;
}

/** FC cost to buy `delta` tokens starting at `from` (mirrors cg_curve_integral). */
export function buyCost(from, delta, basePrice = 1) {
  const boundaries = [0, 100_000, 500_000, 1_000_000, Infinity];
  const ks = [2e-8, 2e-8, 1e-8, 5e-9, 5e-9];
  let total = 0;
  const b = from + delta;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const sa = Math.max(from, boundaries[i]);
    const sb = Math.min(b, boundaries[i + 1]);
    if (sb > sa) {
      const k = ks[i + 1];
      total += basePrice * (sb - sa) + (k / 3) * (sb ** 3 - sa ** 3);
    }
  }
  return total;
}

/** Net proceeds from selling `delta` tokens ending at `to` (before fees). */
export function sellProceeds(to, delta, basePrice = 1) {
  return buyCost(to - delta, delta, basePrice);
}

/** Curve data points for chart: array of { tokens, price } from 0 to maxTokens. */
export function bondingCurvePoints(maxTokens, basePrice = 1, steps = 100) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (maxTokens / steps) * i;
    return { tokens: t, price: spotPrice(t, basePrice) };
  });
}
