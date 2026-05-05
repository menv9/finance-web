-- Coingame: virtual social economy (FingesCoin / FC).
-- Run after profiles.sql. Fully virtual — no link to real money/finance_records.
-- All economy mutations go through SECURITY DEFINER RPCs so invariants
-- (supply, fees, ownership caps) cannot be bypassed by clients.

-- ── constants ────────────────────────────────────────────────────────────────
-- Encoded as immutable SQL functions so they can be referenced from policies
-- and other functions without a config table.

create or replace function public.cg_const_starter_fc()
returns numeric language sql immutable as $$ select 10000::numeric $$;

create or replace function public.cg_const_total_supply_cap()
returns numeric language sql immutable as $$ select 10000000::numeric $$;

create or replace function public.cg_const_strong_market_cap()
returns numeric language sql immutable as $$ select 75000::numeric $$;

create or replace function public.cg_const_min_trade_fc()
returns numeric language sql immutable as $$ select 10::numeric $$;

create or replace function public.cg_const_max_first_day_ownership()
returns numeric language sql immutable as $$ select 0.05::numeric $$;

-- ── tables ───────────────────────────────────────────────────────────────────

-- Singleton row tracking global economy counters.
create table if not exists public.coingame_economy (
  id smallint primary key default 1 check (id = 1),
  total_supply_minted numeric not null default 0,
  total_burned numeric not null default 0,
  prize_pool_fc numeric not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.coingame_economy enable row level security;

drop policy if exists "economy readable by authenticated" on public.coingame_economy;
create policy "economy readable by authenticated"
  on public.coingame_economy for select to authenticated using (true);

-- No insert/update/delete policies: all mutations via SECURITY DEFINER RPCs.

insert into public.coingame_economy (id) values (1) on conflict (id) do nothing;

-- One wallet per user. Created lazily by cg_ensure_wallet on first access.
create table if not exists public.coingame_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fc_balance numeric not null default 0 check (fc_balance >= 0),
  last_login_at timestamptz,
  login_streak integer not null default 0,
  last_daily_claim_at timestamptz,
  multiplier_base numeric not null default 1.0,
  multiplier_updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_wallets enable row level security;

drop policy if exists "wallets readable by owner" on public.coingame_wallets;
create policy "wallets readable by owner"
  on public.coingame_wallets for select to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies: all mutations go through SECURITY DEFINER RPCs.

drop trigger if exists coingame_wallets_set_updated_at on public.coingame_wallets;
create trigger coingame_wallets_set_updated_at
  before update on public.coingame_wallets
  for each row execute function public.set_updated_at();

-- One personal coin per user (1:1). Public — anyone can browse the market.
create table if not exists public.coingame_coins (
  coin_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  coin_name text,
  base_price numeric not null default 1,
  tokens_minted numeric not null default 0 check (tokens_minted >= 0),
  status text not null default 'starter' check (status in ('starter', 'active', 'strong')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_coins
  add column if not exists coin_name text;

alter table public.coingame_coins
  drop constraint if exists coingame_coin_name_length;
alter table public.coingame_coins
  add constraint coingame_coin_name_length
  check (coin_name is null or length(trim(coin_name)) between 2 and 32);

create index if not exists coingame_coins_owner_idx on public.coingame_coins (owner_user_id);
create index if not exists coingame_coins_status_idx on public.coingame_coins (status);

alter table public.coingame_coins enable row level security;

drop policy if exists "coins readable by authenticated" on public.coingame_coins;
create policy "coins readable by authenticated"
  on public.coingame_coins for select to authenticated using (true);

drop trigger if exists coingame_coins_set_updated_at on public.coingame_coins;
create trigger coingame_coins_set_updated_at
  before update on public.coingame_coins
  for each row execute function public.set_updated_at();

-- Holdings: who owns how many tokens of which coin.
create table if not exists public.coingame_holdings (
  holder_user_id uuid not null references auth.users(id) on delete cascade,
  coin_id uuid not null references public.coingame_coins(coin_id) on delete cascade,
  tokens_held numeric not null default 0 check (tokens_held >= 0),
  avg_buy_price numeric not null default 0,
  first_bought_at timestamptz not null default timezone('utc', now()),
  last_buy_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (holder_user_id, coin_id)
);

create index if not exists coingame_holdings_coin_idx on public.coingame_holdings (coin_id);

alter table public.coingame_holdings enable row level security;

drop policy if exists "holdings readable by holder or coin owner" on public.coingame_holdings;
create policy "holdings readable by holder or coin owner"
  on public.coingame_holdings for select to authenticated
  using (
    auth.uid() = holder_user_id
    or auth.uid() in (
      select owner_user_id from public.coingame_coins where coin_id = coingame_holdings.coin_id
    )
  );

drop trigger if exists coingame_holdings_set_updated_at on public.coingame_holdings;
create trigger coingame_holdings_set_updated_at
  before update on public.coingame_holdings
  for each row execute function public.set_updated_at();

-- Transactions log. Append-only.
create table if not exists public.coingame_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_type text not null check (tx_type in ('buy', 'sell', 'fee_burn', 'fee_pool', 'reward', 'starter_grant')),
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  coin_id uuid references public.coingame_coins(coin_id) on delete set null,
  tokens numeric,
  fc_amount numeric not null,
  spot_price numeric,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists coingame_tx_from_idx on public.coingame_transactions (from_user_id, created_at desc);
create index if not exists coingame_tx_to_idx on public.coingame_transactions (to_user_id, created_at desc);
create index if not exists coingame_tx_coin_idx on public.coingame_transactions (coin_id, created_at desc);

alter table public.coingame_transactions enable row level security;

drop policy if exists "transactions visible to participants" on public.coingame_transactions;
create policy "transactions visible to participants"
  on public.coingame_transactions for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Weekly leaderboard. Each buy/sell upserts the current week's row for the actor.
-- Past weeks are kept for history; the UI only queries the current week.
create table if not exists public.coingame_leaderboard_weekly (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  gains_fc numeric not null default 0,
  volume_fc numeric not null default 0,
  trades_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_start_date)
);

create index if not exists coingame_leaderboard_week_idx
  on public.coingame_leaderboard_weekly (week_start_date, gains_fc desc);

alter table public.coingame_leaderboard_weekly enable row level security;

drop policy if exists "leaderboard readable by authenticated" on public.coingame_leaderboard_weekly;
create policy "leaderboard readable by authenticated"
  on public.coingame_leaderboard_weekly for select to authenticated using (true);

-- ── pricing helpers ──────────────────────────────────────────────────────────
-- Bonding curve: spot_price(T) = base + k(T) * T^2  with segmented k:
--   [0,        100_000):    k1 = 2e-8
--   [100_000,  500_000):    k2 = 1e-8
--   [500_000, 1_000_000):   k3 = 5e-9
--   [1_000_000, +∞):        k3 (clamped — segments only go to 1M in PRD)
-- Cost to buy `delta` tokens starting at `T` is integral of spot_price from T to T+delta.
-- Each segment contributes:  base*(b - a) + (k/3) * (b^3 - a^3)

create or replace function public.cg_spot_price(tokens_minted numeric, base_price numeric)
returns numeric language plpgsql immutable as $$
declare k numeric;
begin
  if tokens_minted < 100000 then k := 2e-8;
  elsif tokens_minted < 500000 then k := 1e-8;
  else k := 5e-9;
  end if;
  return base_price + k * (tokens_minted * tokens_minted);
end;
$$;

-- Integrate the bonding curve from a to b. Splits across k segments.
create or replace function public.cg_curve_integral(a numeric, b numeric, base_price numeric)
returns numeric language plpgsql immutable as $$
declare
  total numeric := 0;
  seg_a numeric;
  seg_b numeric;
  k numeric;
  boundaries numeric[] := array[0, 100000, 500000, 1000000, 1e18];
  ks numeric[] := array[2e-8, 2e-8, 1e-8, 5e-9, 5e-9];
  i integer;
begin
  if b <= a then return 0; end if;
  for i in 1..(array_length(boundaries, 1) - 1) loop
    seg_a := greatest(a, boundaries[i]);
    seg_b := least(b, boundaries[i + 1]);
    if seg_b > seg_a then
      k := ks[i + 1];
      total := total + base_price * (seg_b - seg_a)
             + (k / 3.0) * (seg_b * seg_b * seg_b - seg_a * seg_a * seg_a);
    end if;
  end loop;
  return total;
end;
$$;

-- ── lazy wallet/coin initialization ──────────────────────────────────────────
-- Called by clients on first Coingame access. Creates wallet (10k FC) only.
-- Idempotent — safe to call repeatedly.
create or replace function public.cg_ensure_wallet()
returns table (
  user_id uuid,
  fc_balance numeric,
  coin_id uuid,
  status text,
  tokens_minted numeric
)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_coin_id uuid;
  v_status text;
  v_tokens numeric;
  v_balance numeric;
  granted boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Wallet
  insert into public.coingame_wallets (user_id, fc_balance)
    values (uid, public.cg_const_starter_fc())
    on conflict (user_id) do nothing;
  if found then granted := true; end if;

  if granted then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('starter_grant', uid, public.cg_const_starter_fc(),
              jsonb_build_object('reason', 'initial_signup'));
  end if;

  select w.fc_balance, c.coin_id, c.status, c.tokens_minted
    into v_balance, v_coin_id, v_status, v_tokens
    from public.coingame_wallets w
    left join public.coingame_coins c on c.owner_user_id = w.user_id
    where w.user_id = uid;

  return query select uid, v_balance, v_coin_id, v_status, v_tokens;
end;
$$;

grant execute on function public.cg_ensure_wallet() to authenticated;

-- Creates the caller's personal coin after they confirm the setup modal.
create or replace function public.cg_create_coin(p_coin_name text)
returns table (
  coin_id uuid,
  owner_user_id uuid,
  coin_name text,
  base_price numeric,
  tokens_minted numeric,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean_name text := nullif(trim(p_coin_name), '');
  created_coin public.coingame_coins%rowtype;
  granted boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if clean_name is null or length(clean_name) < 2 or length(clean_name) > 32 then
    raise exception 'coin name must be 2-32 characters';
  end if;

  insert into public.coingame_wallets (user_id, fc_balance)
    values (uid, public.cg_const_starter_fc())
    on conflict (user_id) do nothing;
  if found then granted := true; end if;

  if granted then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('starter_grant', uid, public.cg_const_starter_fc(),
              jsonb_build_object('reason', 'initial_signup'));
  end if;

  insert into public.coingame_coins (owner_user_id, coin_name)
    values (uid, clean_name)
    on conflict (owner_user_id) do update
      set coin_name = excluded.coin_name
    returning * into created_coin;

  return query
    select created_coin.coin_id,
           created_coin.owner_user_id,
           created_coin.coin_name,
           created_coin.base_price,
           created_coin.tokens_minted,
           created_coin.status,
           created_coin.created_at,
           created_coin.updated_at;
end;
$$;

grant execute on function public.cg_create_coin(text) to authenticated;

-- ── status promotion ────────────────────────────────────────────────────────
-- A coin becomes "strong" once its market cap (tokens_minted * spot_price) crosses 75k FC.
create or replace function public.cg_recompute_status(p_coin_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  c record;
  cap numeric;
  new_status text;
begin
  select coin_id, base_price, tokens_minted, status into c
    from public.coingame_coins where coin_id = p_coin_id for update;
  if not found then return null; end if;

  cap := c.tokens_minted * public.cg_spot_price(c.tokens_minted, c.base_price);

  if cap >= public.cg_const_strong_market_cap() then new_status := 'strong';
  elsif c.tokens_minted > 0 then new_status := 'active';
  else new_status := 'starter';
  end if;

  if new_status <> c.status then
    update public.coingame_coins set status = new_status where coin_id = p_coin_id;
  end if;
  return new_status;
end;
$$;

-- ── leaderboard helper ──────────────────────────────────────────────────────
create or replace function public.cg_current_week_start()
returns date language sql stable as $$
  select (date_trunc('week', timezone('utc', now())))::date
$$;

create or replace function public.cg_record_leaderboard(p_user uuid, p_volume numeric, p_gain numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.coingame_leaderboard_weekly
    (user_id, week_start_date, gains_fc, volume_fc, trades_count)
  values
    (p_user, public.cg_current_week_start(), p_gain, p_volume, 1)
  on conflict (user_id, week_start_date) do update
    set gains_fc = public.coingame_leaderboard_weekly.gains_fc + excluded.gains_fc,
        volume_fc = public.coingame_leaderboard_weekly.volume_fc + excluded.volume_fc,
        trades_count = public.coingame_leaderboard_weekly.trades_count + 1,
        updated_at = timezone('utc', now());
end;
$$;

-- ── BUY ──────────────────────────────────────────────────────────────────────
-- Buyer specifies how many tokens to buy. We compute FC cost via curve integral,
-- apply 1% fee (0.5% burn / 0.5% prize pool), enforce 5% ownership cap during
-- the coin's first 24h, mint tokens, update holdings, log the transaction.
create or replace function public.cg_buy_coin(p_coin_id uuid, p_tokens numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c record;
  cost numeric;
  fee numeric;
  burn_amt numeric;
  pool_amt numeric;
  total_charge numeric;
  current_balance numeric;
  current_held numeric;
  new_total numeric;
  ownership_ratio numeric;
  coin_age_hours numeric;
  spot numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'tokens must be positive'; end if;

  select coin_id, owner_user_id, base_price, tokens_minted, created_at
    into c
    from public.coingame_coins where coin_id = p_coin_id for update;
  if not found then raise exception 'coin not found'; end if;
  if c.owner_user_id = uid then raise exception 'cannot buy your own coin'; end if;

  -- Total supply cap.
  if c.tokens_minted + p_tokens > public.cg_const_total_supply_cap() then
    raise exception 'would exceed total supply cap';
  end if;

  cost := public.cg_curve_integral(c.tokens_minted, c.tokens_minted + p_tokens, c.base_price);
  if cost < public.cg_const_min_trade_fc() then
    raise exception 'trade below minimum (%)', public.cg_const_min_trade_fc();
  end if;
  fee := cost * 0.01;
  burn_amt := fee * 0.5;
  pool_amt := fee * 0.5;
  total_charge := cost + fee;

  -- Lock buyer wallet.
  select fc_balance into current_balance
    from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not initialized — call cg_ensure_wallet first'; end if;
  if current_balance < total_charge then
    raise exception 'insufficient balance (need %, have %)', total_charge, current_balance;
  end if;

  -- 5% ownership cap during first 24h since coin creation.
  coin_age_hours := extract(epoch from (timezone('utc', now()) - c.created_at)) / 3600.0;
  if coin_age_hours < 24 then
    select coalesce(tokens_held, 0) into current_held
      from public.coingame_holdings
      where holder_user_id = uid and coin_id = p_coin_id;
    new_total := coalesce(current_held, 0) + p_tokens;
    if (c.tokens_minted + p_tokens) > 0 then
      ownership_ratio := new_total / (c.tokens_minted + p_tokens);
      if ownership_ratio > public.cg_const_max_first_day_ownership() then
        raise exception 'first-24h ownership cap (5%%) exceeded';
      end if;
    end if;
  end if;

  -- Mutations.
  update public.coingame_wallets
    set fc_balance = fc_balance - total_charge
    where user_id = uid;

  update public.coingame_coins
    set tokens_minted = tokens_minted + p_tokens
    where coin_id = p_coin_id;

  insert into public.coingame_holdings (holder_user_id, coin_id, tokens_held, avg_buy_price, last_buy_at)
    values (uid, p_coin_id, p_tokens, cost / nullif(p_tokens, 0), timezone('utc', now()))
    on conflict (holder_user_id, coin_id) do update
      set tokens_held = public.coingame_holdings.tokens_held + p_tokens,
          avg_buy_price = (
            (public.coingame_holdings.tokens_held * public.coingame_holdings.avg_buy_price)
            + cost
          ) / (public.coingame_holdings.tokens_held + p_tokens),
          last_buy_at = timezone('utc', now());

  update public.coingame_economy
    set total_supply_minted = total_supply_minted + p_tokens,
        total_burned = total_burned + burn_amt,
        prize_pool_fc = prize_pool_fc + pool_amt,
        updated_at = timezone('utc', now())
    where id = 1;

  spot := public.cg_spot_price(c.tokens_minted + p_tokens, c.base_price);

  -- Log.
  insert into public.coingame_transactions
    (tx_type, from_user_id, to_user_id, coin_id, tokens, fc_amount, spot_price, metadata)
  values
    ('buy', uid, c.owner_user_id, p_coin_id, p_tokens, cost, spot,
     jsonb_build_object('fee', fee, 'burn', burn_amt, 'pool', pool_amt));
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id, metadata)
    values ('fee_burn', uid, burn_amt, p_coin_id, null);
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id, metadata)
    values ('fee_pool', uid, pool_amt, p_coin_id, null);

  perform public.cg_recompute_status(p_coin_id);
  perform public.cg_record_leaderboard(uid, total_charge, -fee);

  return jsonb_build_object(
    'tokens', p_tokens,
    'cost', cost,
    'fee', fee,
    'total_charge', total_charge,
    'spot_price', spot,
    'new_balance', current_balance - total_charge
  );
end;
$$;

grant execute on function public.cg_buy_coin(uuid, numeric) to authenticated;

-- ── SELL ─────────────────────────────────────────────────────────────────────
-- Sells `p_tokens` from the caller's holdings. Fee: 5% if last buy was <1h ago
-- (anti-flip), otherwise 1%. Same 0.5/0.5 split into burn/pool.
create or replace function public.cg_sell_coin(p_coin_id uuid, p_tokens numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c record;
  h record;
  proceeds numeric;
  fee_rate numeric;
  fee numeric;
  burn_amt numeric;
  pool_amt numeric;
  net_proceeds numeric;
  hours_since_buy numeric;
  spot numeric;
  realized numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'tokens must be positive'; end if;

  select coin_id, base_price, tokens_minted into c
    from public.coingame_coins where coin_id = p_coin_id for update;
  if not found then raise exception 'coin not found'; end if;

  select tokens_held, avg_buy_price, last_buy_at into h
    from public.coingame_holdings
    where holder_user_id = uid and coin_id = p_coin_id for update;
  if not found or h.tokens_held < p_tokens then
    raise exception 'insufficient holdings';
  end if;

  if c.tokens_minted < p_tokens then
    raise exception 'invariant violated: minted < sell amount';
  end if;

  proceeds := public.cg_curve_integral(c.tokens_minted - p_tokens, c.tokens_minted, c.base_price);
  if proceeds < public.cg_const_min_trade_fc() then
    raise exception 'trade below minimum (%)', public.cg_const_min_trade_fc();
  end if;

  hours_since_buy := extract(epoch from (timezone('utc', now()) - h.last_buy_at)) / 3600.0;
  fee_rate := case when hours_since_buy < 1 then 0.05 else 0.01 end;
  fee := proceeds * fee_rate;
  burn_amt := fee * 0.5;
  pool_amt := fee * 0.5;
  net_proceeds := proceeds - fee;
  realized := proceeds - (h.avg_buy_price * p_tokens);

  -- Mutations.
  update public.coingame_wallets
    set fc_balance = fc_balance + net_proceeds
    where user_id = uid;

  update public.coingame_coins
    set tokens_minted = tokens_minted - p_tokens
    where coin_id = p_coin_id;

  if h.tokens_held = p_tokens then
    delete from public.coingame_holdings
      where holder_user_id = uid and coin_id = p_coin_id;
  else
    update public.coingame_holdings
      set tokens_held = tokens_held - p_tokens
      where holder_user_id = uid and coin_id = p_coin_id;
  end if;

  update public.coingame_economy
    set total_supply_minted = total_supply_minted - p_tokens,
        total_burned = total_burned + burn_amt,
        prize_pool_fc = prize_pool_fc + pool_amt,
        updated_at = timezone('utc', now())
    where id = 1;

  spot := public.cg_spot_price(c.tokens_minted - p_tokens, c.base_price);

  insert into public.coingame_transactions
    (tx_type, from_user_id, coin_id, tokens, fc_amount, spot_price, metadata)
  values
    ('sell', uid, p_coin_id, p_tokens, proceeds, spot,
     jsonb_build_object('fee', fee, 'fee_rate', fee_rate, 'burn', burn_amt, 'pool', pool_amt,
                        'realized_pnl', realized));
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id)
    values ('fee_burn', uid, burn_amt, p_coin_id);
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id)
    values ('fee_pool', uid, pool_amt, p_coin_id);

  perform public.cg_recompute_status(p_coin_id);
  perform public.cg_record_leaderboard(uid, proceeds, realized - fee);

  return jsonb_build_object(
    'tokens', p_tokens,
    'proceeds', proceeds,
    'fee', fee,
    'fee_rate', fee_rate,
    'net_proceeds', net_proceeds,
    'realized_pnl', realized,
    'spot_price', spot
  );
end;
$$;

grant execute on function public.cg_sell_coin(uuid, numeric) to authenticated;

-- ── DAILY CLAIM ──────────────────────────────────────────────────────────────
-- Login streak reward. Once per UTC day. Streak resets if a day was missed.
create or replace function public.cg_claim_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  w record;
  today date := (timezone('utc', now()))::date;
  last_day date;
  reward numeric;
  new_streak integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select user_id, fc_balance, login_streak, last_daily_claim_at into w
    from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not initialized'; end if;

  last_day := (w.last_daily_claim_at at time zone 'UTC')::date;
  if last_day = today then
    raise exception 'already claimed today';
  end if;

  if last_day = today - 1 then
    new_streak := w.login_streak + 1;
  else
    new_streak := 1;
  end if;

  -- Reward scales mildly with streak, capped: 50 + 10*min(streak, 30).
  reward := 50 + 10 * least(new_streak, 30);

  update public.coingame_wallets
    set fc_balance = fc_balance + reward,
        login_streak = new_streak,
        last_daily_claim_at = timezone('utc', now()),
        last_login_at = timezone('utc', now())
    where user_id = uid;

  insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
    values ('reward', uid, reward,
            jsonb_build_object('reason', 'daily_claim', 'streak', new_streak));

  return jsonb_build_object('reward', reward, 'streak', new_streak, 'new_balance', w.fc_balance + reward);
end;
$$;

grant execute on function public.cg_claim_daily() to authenticated;

-- ── MARKET / PORTFOLIO READ VIEWS ────────────────────────────────────────────
create or replace view public.coingame_market_coins
with (security_invoker = true) as
  select c.coin_id,
         c.owner_user_id,
         coalesce(nullif(trim(c.coin_name), ''), p.username, 'Unnamed coin') as coin_name,
         c.base_price,
         c.tokens_minted,
         c.status,
         c.created_at,
         c.updated_at,
         p.username,
         p.display_name,
         p.avatar_url
    from public.coingame_coins c
    left join public.profiles p on p.user_id = c.owner_user_id;

grant select on public.coingame_market_coins to authenticated;

create or replace view public.coingame_holdings_view
with (security_invoker = true) as
  select h.holder_user_id,
         h.coin_id,
         h.tokens_held,
         h.avg_buy_price,
         h.first_bought_at,
         h.last_buy_at,
         h.updated_at,
         c.owner_user_id,
         coalesce(nullif(trim(c.coin_name), ''), p.username, 'Unnamed coin') as coin_name,
         c.base_price,
         c.tokens_minted,
         c.status,
         c.created_at as coin_created_at,
         p.username,
         p.display_name,
         p.avatar_url
    from public.coingame_holdings h
    join public.coingame_coins c on c.coin_id = h.coin_id
    left join public.profiles p on p.user_id = c.owner_user_id;

grant select on public.coingame_holdings_view to authenticated;

create or replace view public.coingame_transactions_view
with (security_invoker = true) as
  select t.id,
         t.tx_type,
         t.from_user_id,
         t.to_user_id,
         t.coin_id,
         t.tokens,
         t.fc_amount,
         t.spot_price,
         t.metadata,
         t.created_at,
         c.owner_user_id as coin_owner_user_id,
         coalesce(nullif(trim(c.coin_name), ''), p.username, 'Unnamed coin') as coin_name,
         p.username,
         p.display_name,
         p.avatar_url
    from public.coingame_transactions t
    left join public.coingame_coins c on c.coin_id = t.coin_id
    left join public.profiles p on p.user_id = c.owner_user_id;

grant select on public.coingame_transactions_view to authenticated;

-- ── LEADERBOARD VIEW ─────────────────────────────────────────────────────────
create or replace view public.coingame_leaderboard_current_week
with (security_invoker = true) as
  select lw.user_id,
         p.username,
         p.display_name,
         p.avatar_url,
         lw.gains_fc,
         lw.volume_fc,
         lw.trades_count,
         lw.updated_at
    from public.coingame_leaderboard_weekly lw
    left join public.profiles p on p.user_id = lw.user_id
    where lw.week_start_date = public.cg_current_week_start();

grant select on public.coingame_leaderboard_current_week to authenticated;
