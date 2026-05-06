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

function withProfile(row) {
  if (!row) return row;
  return {
    ...row,
    profiles: {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
  };
}

function holdingFromView(row) {
  return {
    holder_user_id: row.holder_user_id,
    coin_id: row.coin_id,
    tokens_held: row.tokens_held,
    avg_buy_price: row.avg_buy_price,
    first_bought_at: row.first_bought_at,
    last_buy_at: row.last_buy_at,
    updated_at: row.updated_at,
    coingame_coins: {
      coin_id: row.coin_id,
      owner_user_id: row.owner_user_id,
      coin_name: row.coin_name,
      base_price: row.base_price,
      tokens_minted: row.tokens_minted,
      status: row.status,
      created_at: row.coin_created_at,
      profiles: {
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      },
    },
  };
}

function transactionFromView(row) {
  return {
    ...row,
    coingame_coins: row.coin_id ? {
      owner_user_id: row.coin_owner_user_id,
      coin_name: row.coin_name,
      profiles: {
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      },
    } : null,
  };
}

// ── Initialization ────────────────────────────────────────────────────────────

/** Creates wallet if it doesn't exist. Coin creation is confirmed separately. */
export async function ensureWallet() {
  const rows = await rpc('cg_ensure_wallet');
  return rows?.[0] ?? null;
}

export async function createCoin(coinName) {
  const rows = await rpc('cg_create_coin', { p_coin_name: coinName });
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
    .from('coingame_market_coins')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return withProfile(data);
}

export async function fetchCoinById(coinId) {
  const { data, error } = await client()
    .from('coingame_market_coins')
    .select('*')
    .eq('coin_id', coinId)
    .maybeSingle();
  if (error) throw error;
  return withProfile(data);
}

/** Trending: coins with most tokens_minted, joined with owner profile. */
export async function fetchTrending(limit = 20) {
  const { data, error } = await client()
    .from('coingame_market_coins')
    .select('*')
    .order('tokens_minted', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(withProfile);
}

/** Search coins by owner username. */
export async function searchCoins(query, limit = 20) {
  const safeQuery = String(query || '').replace(/[%,()]/g, ' ').trim();
  if (!safeQuery) return [];
  const { data, error } = await client()
    .from('coingame_market_coins')
    .select('*')
    .or(`username.ilike.%${safeQuery}%,coin_name.ilike.%${safeQuery}%`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(withProfile);
}

// ── Holdings ──────────────────────────────────────────────────────────────────

export async function fetchHoldings(userId) {
  const { data, error } = await client()
    .from('coingame_holdings_view')
    .select('*')
    .eq('holder_user_id', userId)
    .gt('tokens_held', 0)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(holdingFromView);
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
    .from('coingame_transactions_view')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .in('tx_type', ['buy', 'sell', 'reward', 'starter_grant', 'gamble_bet', 'gamble_win', 'gamble_loss'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(transactionFromView);
}

// Casino / gambling
export async function fetchCasinoState() {
  return rpc('cg_casino_get_state');
}

export async function setCasinoHouseBalance(amount) {
  return rpc('cg_casino_set_house_balance', { p_amount: amount });
}

export async function fetchGamblingRecent(limit = 25) {
  return rpc('cg_gambling_recent', { p_limit: limit });
}

export async function gambleCoinflip(choice, wager) {
  return rpc('cg_gamble_coinflip', { p_choice: choice, p_wager: wager });
}

export async function gambleDice(target, wager) {
  return rpc('cg_gamble_dice', { p_target: target, p_wager: wager });
}

export async function fetchCoinChart(coinId, rangeMinutes = 1440) {
  let rows;
  try {
    rows = await rpc('cg_coin_chart_range', { p_coin_id: coinId, p_minutes: rangeMinutes });
  } catch (error) {
    const message = String(error?.message || '');
    if (!message.includes('cg_coin_chart_range')) throw error;
    rows = await rpc('cg_coin_chart', { p_coin_id: coinId, p_hours: Math.max(1, Math.ceil(rangeMinutes / 60)) });
  }
  return (rows ?? []).map((row) => ({
    bucketStart: row.bucket_start,
    label: new Date(row.bucket_start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    price: Number(row.price ?? 0),
    volume: Number(row.volume_tokens ?? 0),
    volumeFc: Number(row.volume_fc ?? 0),
    trades: Number(row.trades_count ?? 0),
  }));
}

export async function fetchCoinRecentTrades(coinId, limit = 25) {
  return rpc('cg_coin_recent_trades', { p_coin_id: coinId, p_limit: limit });
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

// Bot admin
export async function triggerBotTick() {
  return rpc('cg_bot_tick');
}

export async function fetchCoingameAdminStatus() {
  return rpc('cg_admin_status');
}

export async function fetchBotConfig() {
  return rpc('cg_bot_get_config');
}

export async function updateBotGlobalConfig(params = {}) {
  return rpc('cg_bot_update_global_config', {
    p_enabled: params.enabled,
    p_min_trade_pct: params.min_trade_pct,
    p_max_trade_pct: params.max_trade_pct,
    p_min_tokens_abs: params.min_tokens_abs,
    p_inactivity_threshold_h: params.inactivity_threshold_h,
    p_max_bot_daily_volume_pct: params.max_bot_daily_volume_pct,
    p_daily_volume_floor_fc: params.daily_volume_floor_fc,
    p_max_trades_per_coin_day: params.max_trades_per_coin_day,
    p_max_price_impact_pct: params.max_price_impact_pct,
    p_reserve_low_threshold_fc: params.reserve_low_threshold_fc,
    p_tick_interval_seconds: params.tick_interval_seconds,
    p_bot_profiles: params.bot_profiles,
  });
}

export async function setBotCoinEnabled(coinId, enabled) {
  return rpc('cg_bot_set_coin_enabled', { p_coin_id: coinId, p_enabled: enabled });
}

export async function fetchBotLogs(limit = 50, coinId = null) {
  return rpc('cg_bot_get_logs', { p_limit: limit, p_coin_id: coinId });
}

export async function fetchMarketHealth() {
  return rpc('cg_bot_get_market_health');
}

export async function setBotReserve(amount) {
  return rpc('cg_bot_set_reserve', { p_amount: amount });
}

export async function fetchAdminUsers() {
  return rpc('cg_admin_list_users');
}

export async function addAdminUser(userId) {
  return rpc('cg_admin_add_user', { p_target_user_id: userId });
}

export async function removeAdminUser(userId) {
  return rpc('cg_admin_remove_user', { p_target_user_id: userId });
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
