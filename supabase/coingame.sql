-- Coingame: virtual social economy (FingesCoin / FC).
-- Run after profiles.sql. Fully virtual â€” no link to real money/finance_records.
-- All economy mutations go through SECURITY DEFINER RPCs so invariants
-- (supply and fees) cannot be bypassed by clients.

-- â”€â”€ constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  using (auth.uid() = coingame_wallets.user_id);

-- No insert/update/delete policies: all mutations go through SECURITY DEFINER RPCs.

drop trigger if exists coingame_wallets_set_updated_at on public.coingame_wallets;
create trigger coingame_wallets_set_updated_at
  before update on public.coingame_wallets
  for each row execute function public.set_updated_at();

-- One personal coin per user (1:1). Public â€” anyone can browse the market.
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
      select c.owner_user_id from public.coingame_coins c where c.coin_id = coingame_holdings.coin_id
    )
  );

drop trigger if exists coingame_holdings_set_updated_at on public.coingame_holdings;
create trigger coingame_holdings_set_updated_at
  before update on public.coingame_holdings
  for each row execute function public.set_updated_at();

-- Transactions log. Append-only.
create table if not exists public.coingame_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_type text not null check (tx_type in ('buy', 'sell', 'fee_burn', 'fee_pool', 'reward', 'starter_grant', 'gamble_bet', 'gamble_win', 'gamble_loss')),
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

alter table public.coingame_transactions
  drop constraint if exists coingame_transactions_tx_type_check;
alter table public.coingame_transactions
  add constraint coingame_transactions_tx_type_check
  check (tx_type in ('buy', 'sell', 'fee_burn', 'fee_pool', 'reward', 'starter_grant', 'gamble_bet', 'gamble_win', 'gamble_loss'));

drop policy if exists "transactions visible to participants" on public.coingame_transactions;
create policy "transactions visible to participants"
  on public.coingame_transactions for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Casino bankroll. Mutations go through RPCs only.
create table if not exists public.coingame_casino (
  id integer primary key default 1 check (id = 1),
  house_balance_fc numeric not null default 0,
  house_edge numeric not null default 0.02,
  enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_casino enable row level security;

drop policy if exists "casino readable by authenticated" on public.coingame_casino;
create policy "casino readable by authenticated"
  on public.coingame_casino for select to authenticated using (true);

insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;

create table if not exists public.coingame_gambling_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('coinflip', 'dice')),
  wager_fc numeric not null check (wager_fc > 0),
  choice text,
  target integer,
  roll integer not null,
  result text not null check (result in ('win', 'loss')),
  multiplier numeric not null,
  payout_fc numeric not null default 0,
  net_fc numeric not null,
  created_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists coingame_gambling_bets_user_idx
  on public.coingame_gambling_bets (user_id, created_at desc);

alter table public.coingame_gambling_bets enable row level security;

drop policy if exists "gambling bets readable by owner" on public.coingame_gambling_bets;
create policy "gambling bets readable by owner"
  on public.coingame_gambling_bets for select to authenticated
  using (auth.uid() = user_id);

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

-- â”€â”€ pricing helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Bonding curve: spot_price(T) = base + k(T) * T^2  with segmented k:
--   [0,        100_000):    k1 = 2e-8
--   [100_000,  500_000):    k2 = 1e-8
--   [500_000, 1_000_000):   k3 = 5e-9
--   [1_000_000, +âˆž):        k3 (clamped â€” segments only go to 1M in PRD)
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

-- â”€â”€ lazy wallet/coin initialization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Called by clients on first Coingame access. Creates wallet (10k FC) only.
-- Idempotent â€” safe to call repeatedly.
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
    on conflict on constraint coingame_wallets_pkey do nothing;
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
    on conflict on constraint coingame_wallets_pkey do nothing;
  if found then granted := true; end if;

  if granted then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('starter_grant', uid, public.cg_const_starter_fc(),
              jsonb_build_object('reason', 'initial_signup'));
  end if;

  insert into public.coingame_coins (owner_user_id, coin_name)
    values (uid, clean_name)
    on conflict on constraint coingame_coins_owner_user_id_key do update
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

-- â”€â”€ status promotion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ leaderboard helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  on conflict on constraint coingame_leaderboard_weekly_pkey do update
    set gains_fc = public.coingame_leaderboard_weekly.gains_fc + excluded.gains_fc,
        volume_fc = public.coingame_leaderboard_weekly.volume_fc + excluded.volume_fc,
        trades_count = public.coingame_leaderboard_weekly.trades_count + 1,
        updated_at = timezone('utc', now());
end;
$$;

-- â”€â”€ BUY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Buyer specifies how many tokens to buy. We compute FC cost via curve integral,
-- apply 1% fee (0.5% burn / 0.5% prize pool), mint tokens, update holdings,
-- and log the transaction.
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
  spot numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'tokens must be positive'; end if;

  select coin.coin_id, coin.owner_user_id, coin.base_price, coin.tokens_minted, coin.created_at
    into c
    from public.coingame_coins coin where coin.coin_id = p_coin_id for update;
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
    from public.coingame_wallets w where w.user_id = uid for update;
  if not found then raise exception 'wallet not initialized â€” call cg_ensure_wallet first'; end if;
  if current_balance < total_charge then
    raise exception 'insufficient balance (need %, have %)', total_charge, current_balance;
  end if;

  -- Mutations.
  update public.coingame_wallets w
    set fc_balance = fc_balance - total_charge
    where w.user_id = uid;

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

-- â”€â”€ SELL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  update public.coingame_wallets w
    set fc_balance = fc_balance + net_proceeds
    where w.user_id = uid;

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

-- â”€â”€ DAILY CLAIM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  select wallet.user_id, wallet.fc_balance, wallet.login_streak, wallet.last_daily_claim_at into w
    from public.coingame_wallets wallet where wallet.user_id = uid for update;
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

  update public.coingame_wallets wallet
    set fc_balance = fc_balance + reward,
        login_streak = new_streak,
        last_daily_claim_at = timezone('utc', now()),
        last_login_at = timezone('utc', now())
    where wallet.user_id = uid;

  insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
    values ('reward', uid, reward,
            jsonb_build_object('reason', 'daily_claim', 'streak', new_streak));

  return jsonb_build_object('reward', reward, 'streak', new_streak, 'new_balance', w.fc_balance + reward);
end;
$$;

grant execute on function public.cg_claim_daily() to authenticated;

-- â”€â”€ MARKET / PORTFOLIO READ VIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ LEADERBOARD VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Real chart data derived from coin buy/sell transactions.
create or replace function public.cg_coin_chart(p_coin_id uuid, p_hours integer default 24)
returns table (
  bucket_start timestamptz,
  price numeric,
  volume_tokens numeric,
  volume_fc numeric,
  trades_count integer
)
language sql stable security definer set search_path = public as $$
  with params as (
    select greatest(1, least(coalesce(p_hours, 24), 168))::integer as hours_back
  ),
  selected_coin as (
    select c.coin_id,
           c.base_price,
           c.tokens_minted,
           public.cg_spot_price(c.tokens_minted, c.base_price) as current_price
      from public.coingame_coins c
     where c.coin_id = p_coin_id
  ),
  buckets as (
    select generate_series(
             date_trunc('hour', now()) - ((params.hours_back - 1) * interval '1 hour'),
             date_trunc('hour', now()),
             interval '1 hour'
           ) as bucket_start
      from params
  ),
  bucket_trades as (
    select date_trunc('hour', t.created_at) as bucket_start,
           coalesce(sum(abs(t.tokens)), 0) as volume_tokens,
           coalesce(sum(abs(t.fc_amount)), 0) as volume_fc,
           count(*)::integer as trades_count
      from public.coingame_transactions t
     where t.coin_id = p_coin_id
       and t.tx_type in ('buy', 'sell')
       and t.created_at >= date_trunc('hour', now()) - ((select (hours_back - 1) from params) * interval '1 hour')
     group by date_trunc('hour', t.created_at)
  )
  select b.bucket_start,
         coalesce(last_trade.spot_price, sc.base_price, 0) as price,
         coalesce(bt.volume_tokens, 0) as volume_tokens,
         coalesce(bt.volume_fc, 0) as volume_fc,
         coalesce(bt.trades_count, 0) as trades_count
    from buckets b
    cross join selected_coin sc
    left join bucket_trades bt on bt.bucket_start = b.bucket_start
    left join lateral (
      select t.spot_price
        from public.coingame_transactions t
       where t.coin_id = sc.coin_id
         and t.tx_type in ('buy', 'sell')
         and t.spot_price is not null
         and t.created_at < b.bucket_start + interval '1 hour'
       order by t.created_at desc
       limit 1
    ) last_trade on true
   order by b.bucket_start;
$$;

grant execute on function public.cg_coin_chart(uuid, integer) to authenticated;

create or replace function public.cg_coin_chart_range(p_coin_id uuid, p_minutes integer default 1440)
returns table (
  bucket_start timestamptz,
  price numeric,
  volume_tokens numeric,
  volume_fc numeric,
  trades_count integer
)
language sql stable security definer set search_path = public as $$
  with params as (
    select greatest(1, least(coalesce(p_minutes, 1440), 10080))::integer as minutes_back
  ),
  bucket_params as (
    select params.minutes_back,
           case
             when params.minutes_back <= 60 then interval '1 minute'
             when params.minutes_back <= 240 then interval '5 minutes'
             when params.minutes_back <= 1440 then interval '15 minutes'
             else interval '1 hour'
           end as bucket_interval,
           case
             when params.minutes_back <= 60 then 60
             when params.minutes_back <= 240 then 300
             when params.minutes_back <= 1440 then 900
             else 3600
           end::numeric as bucket_seconds
      from params
  ),
  bounds as (
    select bp.minutes_back,
           bp.bucket_interval,
           bp.bucket_seconds,
           to_timestamp(floor(extract(epoch from now()) / bp.bucket_seconds) * bp.bucket_seconds) as end_bucket
      from bucket_params bp
  ),
  selected_coin as (
    select c.coin_id,
           c.base_price,
           c.tokens_minted,
           public.cg_spot_price(c.tokens_minted, c.base_price) as current_price
      from public.coingame_coins c
     where c.coin_id = p_coin_id
  ),
  buckets as (
    select generate_series(
             bounds.end_bucket - (bounds.minutes_back * interval '1 minute'),
             bounds.end_bucket,
             bounds.bucket_interval
           ) as bucket_start,
           bounds.bucket_interval
      from bounds
  ),
  bucket_trades as (
    select to_timestamp(floor(extract(epoch from t.created_at) / bounds.bucket_seconds) * bounds.bucket_seconds) as bucket_start,
           coalesce(sum(abs(t.tokens)), 0) as volume_tokens,
           coalesce(sum(abs(t.fc_amount)), 0) as volume_fc,
           count(*)::integer as trades_count
      from public.coingame_transactions t
      cross join bounds
     where t.coin_id = p_coin_id
       and t.tx_type in ('buy', 'sell')
       and t.created_at >= bounds.end_bucket - (bounds.minutes_back * interval '1 minute')
     group by to_timestamp(floor(extract(epoch from t.created_at) / bounds.bucket_seconds) * bounds.bucket_seconds)
  )
  select b.bucket_start,
         coalesce(last_trade.spot_price, sc.base_price, 0) as price,
         coalesce(bt.volume_tokens, 0) as volume_tokens,
         coalesce(bt.volume_fc, 0) as volume_fc,
         coalesce(bt.trades_count, 0) as trades_count
    from buckets b
    cross join selected_coin sc
    left join bucket_trades bt on bt.bucket_start = b.bucket_start
    left join lateral (
      select t.spot_price
        from public.coingame_transactions t
       where t.coin_id = sc.coin_id
         and t.tx_type in ('buy', 'sell')
         and t.spot_price is not null
         and t.created_at < b.bucket_start + b.bucket_interval
       order by t.created_at desc
       limit 1
    ) last_trade on true
   order by b.bucket_start;
$$;

grant execute on function public.cg_coin_chart_range(uuid, integer) to authenticated;

-- Coingame NPC liquidity bot system.
-- Client-triggered because Supabase Free has no pg_cron. All admin reads/writes go
-- through SECURITY DEFINER RPCs; regular users only get a lightweight admin status.

create table if not exists public.coingame_bot_config (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  min_trade_pct numeric not null default 0.0005,
  max_trade_pct numeric not null default 0.002,
  min_tokens_abs numeric not null default 10,
  inactivity_threshold_h integer not null default 3,
  max_bot_daily_volume_pct numeric not null default 0.10,
  daily_volume_floor_fc numeric not null default 5000,
  max_trades_per_coin_day integer not null default 3,
  max_price_impact_pct numeric not null default 0.05,
  reserve_fc numeric not null default 1000000,
  reserve_low_threshold_fc numeric not null default 10000,
  tick_interval_seconds integer not null default 1800,
  last_tick_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_bot_config enable row level security;

alter table public.coingame_bot_config
  add column if not exists tick_interval_seconds integer not null default 1800;

create table if not exists public.coingame_bot_profiles (
  bot_id text primary key,
  bot_name text not null,
  enabled boolean not null default true,
  min_trade_pct numeric not null,
  max_trade_pct numeric not null,
  min_tokens_abs numeric not null,
  tick_interval_seconds integer not null default 60,
  max_trades_per_coin_day integer not null default 3,
  max_price_impact_pct numeric not null default 0.05,
  last_tick_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_bot_profiles enable row level security;

insert into public.coingame_bot_profiles
  (bot_id, bot_name, enabled, min_trade_pct, max_trade_pct, min_tokens_abs, tick_interval_seconds, max_trades_per_coin_day, max_price_impact_pct)
values
  ('cautious', 'System Cautious', true, 0.0005, 0.002, 50, 60, 3, 0.05),
  ('balanced', 'System Balanced', true, 0.002, 0.010, 250, 30, 12, 0.12),
  ('aggressive', 'System Aggressive', true, 0.005, 0.025, 500, 10, 30, 0.25)
on conflict (bot_id) do nothing;

insert into public.coingame_bot_config (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.coingame_bot_coin_config (
  coin_id uuid primary key references public.coingame_coins(coin_id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_bot_coin_config enable row level security;

create table if not exists public.coingame_bot_log (
  id uuid primary key default gen_random_uuid(),
  tick_at timestamptz not null default timezone('utc', now()),
  bot_id text references public.coingame_bot_profiles(bot_id) on delete set null,
  coin_id uuid references public.coingame_coins(coin_id) on delete set null,
  action text not null check (action in ('buy', 'sell', 'skip', 'disabled', 'throttle', 'reserve_low', 'error')),
  reason text,
  tokens numeric,
  fc_amount numeric,
  spot_price numeric,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists coingame_bot_log_tick_idx on public.coingame_bot_log (tick_at desc);
create index if not exists coingame_bot_log_coin_tick_idx on public.coingame_bot_log (coin_id, tick_at desc);

alter table public.coingame_bot_log enable row level security;

alter table public.coingame_bot_log
  add column if not exists bot_id text references public.coingame_bot_profiles(bot_id) on delete set null;

create table if not exists public.coingame_bot_daily_volume (
  trade_date date primary key,
  bot_volume_fc numeric not null default 0,
  market_volume_fc numeric not null default 0
);

alter table public.coingame_bot_daily_volume enable row level security;

create table if not exists public.coingame_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id),
  added_at timestamptz not null default timezone('utc', now())
);

alter table public.coingame_admin_users enable row level security;

create or replace function public.cg_bot_track_market_volume()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tx_type in ('buy', 'sell')
     and new.from_user_id is not null
     and (new.metadata is null or new.metadata->>'bot' is null) then
    insert into public.coingame_bot_daily_volume (trade_date, market_volume_fc)
    values ((new.created_at at time zone 'UTC')::date, abs(coalesce(new.fc_amount, 0)))
    on conflict (trade_date) do update
      set market_volume_fc = public.coingame_bot_daily_volume.market_volume_fc + abs(coalesce(new.fc_amount, 0));
  end if;
  return new;
end;
$$;

drop trigger if exists coingame_bot_market_volume_trigger on public.coingame_transactions;
create trigger coingame_bot_market_volume_trigger
  after insert on public.coingame_transactions
  for each row execute function public.cg_bot_track_market_volume();

create or replace function public.cg_is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.coingame_admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.cg_is_admin() to authenticated;

create or replace function public.cg_admin_status()
returns boolean language sql security definer set search_path = public as $$
  select public.cg_is_admin();
$$;

grant execute on function public.cg_admin_status() to authenticated;


-- Multi-profile version. Kept after the original definition so re-running this
-- file upgrades existing projects without requiring a manual drop.
create or replace function public.cg_bot_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg public.coingame_bot_config%rowtype;
  bot public.coingame_bot_profiles%rowtype;
  c record;
  today date := (timezone('utc', now()))::date;
  daily_bot_volume numeric := 0;
  daily_market_volume numeric := 0;
  reserve_low boolean := false;
  is_new_coin boolean;
  last_real_trade timestamptz;
  bot_trades_today integer;
  recent_buys integer;
  recent_total integer;
  action_name text;
  pct numeric;
  v_tokens numeric;
  current_spot numeric;
  post_spot numeric;
  delta_pct numeric;
  amount_fc numeric;
  reduction_guard integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('coingame_bot_tick')) then
    return;
  end if;

  select * into cfg from public.coingame_bot_config where id = 1 for update;
  if not found then
    insert into public.coingame_bot_config (id) values (1)
    on conflict (id) do nothing;
    select * into cfg from public.coingame_bot_config where id = 1 for update;
  end if;

  if not cfg.enabled then
    update public.coingame_bot_config
      set last_tick_at = timezone('utc', now()), updated_at = timezone('utc', now())
      where id = 1;
    insert into public.coingame_bot_log (action, reason) values ('disabled', 'global_disabled');
    return;
  end if;

  select coalesce(bot_volume_fc, 0),
         coalesce(market_volume_fc, 0)
    into daily_bot_volume, daily_market_volume
    from public.coingame_bot_daily_volume
    where trade_date = today;

  daily_bot_volume := coalesce(daily_bot_volume, 0);
  daily_market_volume := coalesce(daily_market_volume, 0);

  if cfg.max_bot_daily_volume_pct > 0
     and daily_market_volume > 0
     and daily_bot_volume >= cfg.daily_volume_floor_fc
     and daily_bot_volume >= cfg.max_bot_daily_volume_pct * daily_market_volume then
    update public.coingame_bot_config
      set last_tick_at = timezone('utc', now()), updated_at = timezone('utc', now())
      where id = 1;
    insert into public.coingame_bot_log (action, reason, metadata)
    values ('throttle', 'daily_cap', jsonb_build_object('bot_volume_fc', daily_bot_volume, 'market_volume_fc', daily_market_volume));
    return;
  end if;

  for bot in
    select *
      from public.coingame_bot_profiles
      where enabled = true
        and (
          last_tick_at is null
          or last_tick_at <= timezone('utc', now()) - make_interval(secs => greatest(tick_interval_seconds, 1))
        )
      order by tick_interval_seconds asc, bot_id asc
      for update
  loop
    reserve_low := cfg.reserve_fc < cfg.reserve_low_threshold_fc;
    if reserve_low then
      insert into public.coingame_bot_log (bot_id, action, reason, metadata)
      values (bot.bot_id, 'reserve_low', 'buy_disabled', jsonb_build_object('reserve_fc', cfg.reserve_fc));
    end if;

    for c in
      select coin.coin_id, coin.base_price, coin.tokens_minted, coin.status, coin.created_at
        from public.coingame_coins coin
        left join public.coingame_bot_coin_config bcc on bcc.coin_id = coin.coin_id
        where coalesce(bcc.enabled, true) = true
          and (coin.status in ('active', 'strong', 'starter') or coin.created_at >= timezone('utc', now()) - interval '24 hours')
        order by random()
    loop
      begin
        select coin_id, base_price, tokens_minted, status, created_at
          into c
          from public.coingame_coins
          where coin_id = c.coin_id
          for update;

        is_new_coin := c.created_at >= timezone('utc', now()) - interval '24 hours';

        select count(*) into bot_trades_today
          from public.coingame_bot_log
          where coin_id = c.coin_id
            and bot_id = bot.bot_id
            and action in ('buy', 'sell')
            and (tick_at at time zone 'UTC')::date = today;
        if bot_trades_today >= bot.max_trades_per_coin_day then
          insert into public.coingame_bot_log (bot_id, coin_id, action, reason)
          values (bot.bot_id, c.coin_id, 'skip', 'coin_daily_limit');
          continue;
        end if;

        select max(created_at) into last_real_trade
          from public.coingame_transactions
          where coin_id = c.coin_id
            and tx_type in ('buy', 'sell')
            and from_user_id is not null
            and (metadata is null or metadata->>'bot' is null);
        if not is_new_coin and last_real_trade is not null
           and last_real_trade > timezone('utc', now()) - make_interval(hours => cfg.inactivity_threshold_h) then
          continue;
        end if;

        if c.tokens_minted <= 0 or c.tokens_minted < bot.min_tokens_abs * 2 then
          action_name := 'buy';
        elsif reserve_low then
          action_name := 'sell';
        else
          select count(*) filter (where action = 'buy'), count(*)
            into recent_buys, recent_total
            from (
              select action
                from public.coingame_bot_log
                where coin_id = c.coin_id
                  and bot_id = bot.bot_id
                  and action in ('buy', 'sell')
                order by tick_at desc
                limit 10
            ) recent;

          if recent_total > 0 and recent_buys::numeric / recent_total > 0.6 then
            action_name := 'sell';
          elsif recent_total > 0 and recent_buys::numeric / recent_total < 0.4 then
            action_name := 'buy';
          elsif random() < 0.5 then
            action_name := 'buy';
          else
            action_name := 'sell';
          end if;

          if random() < 0.30 then
            action_name := case when action_name = 'buy' then 'sell' else 'buy' end;
          end if;
        end if;

        if reserve_low and action_name = 'buy' then
          continue;
        end if;
        if action_name = 'sell' and c.tokens_minted <= 0 then
          continue;
        end if;

        pct := bot.min_trade_pct + random() * greatest(bot.max_trade_pct - bot.min_trade_pct, 0);
        v_tokens := greatest(bot.min_tokens_abs, c.tokens_minted * pct);
        if action_name = 'sell' then
          v_tokens := least(v_tokens, c.tokens_minted * 0.5);
        end if;

        current_spot := public.cg_spot_price(c.tokens_minted, c.base_price);
        reduction_guard := 0;
        loop
          if action_name = 'buy' then
            post_spot := public.cg_spot_price(c.tokens_minted + v_tokens, c.base_price);
          else
            post_spot := public.cg_spot_price(c.tokens_minted - v_tokens, c.base_price);
          end if;
          delta_pct := abs(post_spot - current_spot) / nullif(current_spot, 0);
          exit when coalesce(delta_pct, 0) <= bot.max_price_impact_pct or v_tokens < bot.min_tokens_abs or reduction_guard >= 8;
          v_tokens := v_tokens * 0.5;
          reduction_guard := reduction_guard + 1;
        end loop;

        if v_tokens < bot.min_tokens_abs then
          insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens)
          values (bot.bot_id, c.coin_id, 'skip', 'price_impact_min_tokens', v_tokens);
          continue;
        end if;

        if coalesce(delta_pct, 0) > bot.max_price_impact_pct then
          insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens, metadata)
          values (bot.bot_id, c.coin_id, 'skip', 'price_impact_limit', v_tokens, jsonb_build_object('delta_pct', delta_pct));
          continue;
        end if;

        if action_name = 'buy' then
          if c.tokens_minted + v_tokens > public.cg_const_total_supply_cap() then
            insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens)
            values (bot.bot_id, c.coin_id, 'skip', 'supply_cap', v_tokens);
            continue;
          end if;
          amount_fc := public.cg_curve_integral(c.tokens_minted, c.tokens_minted + v_tokens, c.base_price);
          if amount_fc > cfg.reserve_fc then
            insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens, fc_amount)
            values (bot.bot_id, c.coin_id, 'skip', 'reserve_insufficient', v_tokens, amount_fc);
            continue;
          end if;

          update public.coingame_bot_config
            set reserve_fc = reserve_fc - amount_fc, updated_at = timezone('utc', now())
            where id = 1
            returning * into cfg;
          update public.coingame_coins
            set tokens_minted = tokens_minted + v_tokens
            where coin_id = c.coin_id;
          update public.coingame_economy
            set total_supply_minted = total_supply_minted + v_tokens,
                updated_at = timezone('utc', now())
            where id = 1;

          insert into public.coingame_transactions
            (tx_type, from_user_id, to_user_id, coin_id, tokens, fc_amount, spot_price, metadata)
          values
            ('buy', null, null, c.coin_id, v_tokens, amount_fc, post_spot,
             jsonb_build_object('bot', true, 'bot_id', bot.bot_id, 'label', bot.bot_name));
        else
          if c.tokens_minted < v_tokens then
            insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens)
            values (bot.bot_id, c.coin_id, 'skip', 'minted_below_sell', v_tokens);
            continue;
          end if;
          amount_fc := public.cg_curve_integral(c.tokens_minted - v_tokens, c.tokens_minted, c.base_price);

          update public.coingame_bot_config
            set reserve_fc = reserve_fc + amount_fc, updated_at = timezone('utc', now())
            where id = 1
            returning * into cfg;
          update public.coingame_coins
            set tokens_minted = tokens_minted - v_tokens
            where coin_id = c.coin_id;
          update public.coingame_economy
            set total_supply_minted = greatest(0, total_supply_minted - v_tokens),
                updated_at = timezone('utc', now())
            where id = 1;

          insert into public.coingame_transactions
            (tx_type, from_user_id, to_user_id, coin_id, tokens, fc_amount, spot_price, metadata)
          values
            ('sell', null, null, c.coin_id, v_tokens, amount_fc, post_spot,
             jsonb_build_object('bot', true, 'bot_id', bot.bot_id, 'label', bot.bot_name));
        end if;

        perform public.cg_recompute_status(c.coin_id);

        insert into public.coingame_bot_log (bot_id, coin_id, action, reason, tokens, fc_amount, spot_price)
        values (bot.bot_id, c.coin_id, action_name, 'inactivity_liquidity', v_tokens, amount_fc, post_spot);

        insert into public.coingame_bot_daily_volume (trade_date, bot_volume_fc)
        values (today, abs(amount_fc))
        on conflict (trade_date) do update
          set bot_volume_fc = public.coingame_bot_daily_volume.bot_volume_fc + abs(amount_fc);
      exception when others then
        insert into public.coingame_bot_log (bot_id, coin_id, action, reason, metadata)
        values (bot.bot_id, c.coin_id, 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
      end;
    end loop;

    update public.coingame_bot_profiles
      set last_tick_at = timezone('utc', now()), updated_at = timezone('utc', now())
      where bot_id = bot.bot_id;
  end loop;

  update public.coingame_bot_config
    set last_tick_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = 1;
end;
$$;

grant execute on function public.cg_bot_tick() to authenticated;

create or replace function public.cg_coin_recent_trades(p_coin_id uuid, p_limit integer default 25)
returns table (
  id uuid,
  tx_type text,
  tokens numeric,
  fc_amount numeric,
  spot_price numeric,
  created_at timestamptz,
  is_bot boolean,
  actor_username text
) language sql security definer set search_path = public as $$
  select t.id,
         t.tx_type,
         t.tokens,
         t.fc_amount,
         t.spot_price,
         t.created_at,
         coalesce((t.metadata->>'bot')::boolean, false) as is_bot,
         case
           when coalesce((t.metadata->>'bot')::boolean, false) then coalesce(t.metadata->>'label', 'System Liquidity')
           else p.username::text
         end as actor_username
    from public.coingame_transactions t
    left join public.profiles p on p.user_id = t.from_user_id
    where t.coin_id = p_coin_id
      and t.tx_type in ('buy', 'sell')
    order by t.created_at desc
    limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

grant execute on function public.cg_coin_recent_trades(uuid, integer) to authenticated;

create or replace function public.cg_bot_get_config()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  bots jsonb;
  coins jsonb;
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;

  select to_jsonb(c) into cfg
    from public.coingame_bot_config c
    where id = 1;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.tick_interval_seconds desc), '[]'::jsonb)
    into bots
    from public.coingame_bot_profiles b;

  select coalesce(jsonb_agg(jsonb_build_object(
    'coin_id', coin.coin_id,
    'coin_name', coalesce(nullif(trim(coin.coin_name), ''), p.username, 'Unnamed coin'),
    'status', coin.status,
    'tokens_minted', coin.tokens_minted,
    'bot_enabled', coalesce(bcc.enabled, true),
    'last_bot_trade_at', (
      select max(l.tick_at) from public.coingame_bot_log l
      where l.coin_id = coin.coin_id and l.action in ('buy', 'sell')
    ),
    'bot_trades_today', (
      select count(*) from public.coingame_bot_log l
      where l.coin_id = coin.coin_id
        and l.action in ('buy', 'sell')
        and (l.tick_at at time zone 'UTC')::date = (timezone('utc', now()))::date
    )
  ) order by coin.created_at desc), '[]'::jsonb)
    into coins
    from public.coingame_coins coin
    left join public.profiles p on p.user_id = coin.owner_user_id
    left join public.coingame_bot_coin_config bcc on bcc.coin_id = coin.coin_id;

  return jsonb_build_object('global', cfg, 'bots', bots, 'coins', coins);
end;
$$;

grant execute on function public.cg_bot_get_config() to authenticated;

drop function if exists public.cg_bot_update_global_config(boolean, numeric, numeric, numeric, integer, numeric, numeric, integer, numeric, numeric, integer);

create or replace function public.cg_bot_update_global_config(
  p_enabled boolean default null,
  p_min_trade_pct numeric default null,
  p_max_trade_pct numeric default null,
  p_min_tokens_abs numeric default null,
  p_inactivity_threshold_h integer default null,
  p_max_bot_daily_volume_pct numeric default null,
  p_daily_volume_floor_fc numeric default null,
  p_max_trades_per_coin_day integer default null,
  p_max_price_impact_pct numeric default null,
  p_reserve_low_threshold_fc numeric default null,
  p_tick_interval_seconds integer default null,
  p_bot_profiles jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  profile jsonb;
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;

  update public.coingame_bot_config
    set enabled = coalesce(p_enabled, enabled),
        min_trade_pct = coalesce(p_min_trade_pct, min_trade_pct),
        max_trade_pct = coalesce(p_max_trade_pct, max_trade_pct),
        min_tokens_abs = coalesce(p_min_tokens_abs, min_tokens_abs),
        inactivity_threshold_h = coalesce(p_inactivity_threshold_h, inactivity_threshold_h),
        max_bot_daily_volume_pct = coalesce(p_max_bot_daily_volume_pct, max_bot_daily_volume_pct),
        daily_volume_floor_fc = coalesce(p_daily_volume_floor_fc, daily_volume_floor_fc),
        max_trades_per_coin_day = coalesce(p_max_trades_per_coin_day, max_trades_per_coin_day),
        max_price_impact_pct = coalesce(p_max_price_impact_pct, max_price_impact_pct),
        reserve_low_threshold_fc = coalesce(p_reserve_low_threshold_fc, reserve_low_threshold_fc),
        tick_interval_seconds = greatest(coalesce(p_tick_interval_seconds, tick_interval_seconds), 1),
        updated_at = timezone('utc', now())
    where id = 1;

  if p_bot_profiles is not null then
    for profile in select * from jsonb_array_elements(p_bot_profiles)
    loop
      update public.coingame_bot_profiles
        set bot_name = coalesce(nullif(profile->>'bot_name', ''), bot_name),
            enabled = coalesce((profile->>'enabled')::boolean, enabled),
            min_trade_pct = coalesce((profile->>'min_trade_pct')::numeric, min_trade_pct),
            max_trade_pct = coalesce((profile->>'max_trade_pct')::numeric, max_trade_pct),
            min_tokens_abs = coalesce((profile->>'min_tokens_abs')::numeric, min_tokens_abs),
            tick_interval_seconds = greatest(coalesce((profile->>'tick_interval_seconds')::integer, tick_interval_seconds), 1),
            max_trades_per_coin_day = greatest(coalesce((profile->>'max_trades_per_coin_day')::integer, max_trades_per_coin_day), 1),
            max_price_impact_pct = coalesce((profile->>'max_price_impact_pct')::numeric, max_price_impact_pct),
            updated_at = timezone('utc', now())
        where bot_id = profile->>'bot_id';
    end loop;
  end if;

  return public.cg_bot_get_config();
end;
$$;

grant execute on function public.cg_bot_update_global_config(boolean, numeric, numeric, numeric, integer, numeric, numeric, integer, numeric, numeric, integer, jsonb) to authenticated;

create or replace function public.cg_bot_set_coin_enabled(p_coin_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  insert into public.coingame_bot_coin_config (coin_id, enabled, updated_at)
  values (p_coin_id, p_enabled, timezone('utc', now()))
  on conflict (coin_id) do update
    set enabled = excluded.enabled,
        updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.cg_bot_set_coin_enabled(uuid, boolean) to authenticated;

drop function if exists public.cg_bot_get_logs(integer, uuid);

create or replace function public.cg_bot_get_logs(p_limit integer default 50, p_coin_id uuid default null)
returns table (
  id uuid,
  tick_at timestamptz,
  bot_id text,
  bot_name text,
  coin_id uuid,
  coin_name text,
  action text,
  reason text,
  tokens numeric,
  fc_amount numeric,
  spot_price numeric,
  metadata jsonb
) language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  return query
    select l.id,
           l.tick_at,
           l.bot_id,
           coalesce(bp.bot_name, 'System Liquidity')::text as bot_name,
           l.coin_id,
           coalesce(nullif(trim(c.coin_name), ''), p.username, 'System')::text as coin_name,
           l.action,
           l.reason,
           l.tokens,
           l.fc_amount,
           l.spot_price,
           l.metadata
      from public.coingame_bot_log l
      left join public.coingame_bot_profiles bp on bp.bot_id = l.bot_id
      left join public.coingame_coins c on c.coin_id = l.coin_id
      left join public.profiles p on p.user_id = c.owner_user_id
      where p_coin_id is null or l.coin_id = p_coin_id
      order by l.tick_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

grant execute on function public.cg_bot_get_logs(integer, uuid) to authenticated;

create or replace function public.cg_bot_get_market_health()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bot_24h numeric;
  v_market_24h numeric;
  v_inactive integer;
  cfg public.coingame_bot_config%rowtype;
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  select * into cfg from public.coingame_bot_config where id = 1;

  select coalesce(sum(abs(fc_amount)) filter (where coalesce((metadata->>'bot')::boolean, false)), 0),
         coalesce(sum(abs(fc_amount)) filter (where from_user_id is not null and (metadata is null or metadata->>'bot' is null)), 0)
    into v_bot_24h, v_market_24h
    from public.coingame_transactions
    where tx_type in ('buy', 'sell')
      and created_at >= timezone('utc', now()) - interval '24 hours';

  select count(*) into v_inactive
    from public.coingame_coins c
    where not exists (
      select 1 from public.coingame_transactions t
      where t.coin_id = c.coin_id
        and t.tx_type in ('buy', 'sell')
        and t.from_user_id is not null
        and (t.metadata is null or t.metadata->>'bot' is null)
        and t.created_at >= timezone('utc', now()) - make_interval(hours => cfg.inactivity_threshold_h)
    );

  return jsonb_build_object(
    'bot_volume_24h', v_bot_24h,
    'market_volume_24h', v_market_24h,
    'bot_volume_pct', case when v_market_24h > 0 then v_bot_24h / v_market_24h else null end,
    'inactive_coins', v_inactive,
    'reserve_fc', cfg.reserve_fc,
    'reserve_low_threshold_fc', cfg.reserve_low_threshold_fc,
    'last_tick_at', cfg.last_tick_at
  );
end;
$$;

grant execute on function public.cg_bot_get_market_health() to authenticated;

create or replace function public.cg_bot_set_reserve(p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'reserve must be non-negative'; end if;
  update public.coingame_bot_config
    set reserve_fc = p_amount,
        updated_at = timezone('utc', now())
    where id = 1;
  return p_amount;
end;
$$;

grant execute on function public.cg_bot_set_reserve(numeric) to authenticated;

create or replace function public.cg_admin_list_users()
returns table (
  user_id uuid,
  username text,
  display_name text,
  email text,
  added_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  return query
    select a.user_id,
           p.username::text,
           p.display_name,
           u.email::text,
           a.added_at
      from public.coingame_admin_users a
      left join public.profiles p on p.user_id = a.user_id
      left join auth.users u on u.id = a.user_id
      order by a.added_at asc;
end;
$$;

grant execute on function public.cg_admin_list_users() to authenticated;

create or replace function public.cg_admin_add_user(p_target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'user not found';
  end if;
  insert into public.coingame_admin_users (user_id, added_by)
  values (p_target_user_id, auth.uid())
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.cg_admin_add_user(uuid) to authenticated;

create or replace function public.cg_admin_remove_user(p_target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot remove yourself';
  end if;
  delete from public.coingame_admin_users where user_id = p_target_user_id;
end;
$$;

grant execute on function public.cg_admin_remove_user(uuid) to authenticated;

create or replace function public.cg_bot_list_coins()
returns table (
  coin_id uuid,
  coin_name text,
  status text,
  tokens_minted numeric,
  bot_enabled boolean,
  last_bot_trade_at timestamptz,
  bot_trades_today bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  return query
    select c.coin_id,
           coalesce(nullif(trim(c.coin_name), ''), p.username, 'Unnamed coin')::text as coin_name,
           c.status,
           c.tokens_minted,
           coalesce(bcc.enabled, true) as bot_enabled,
           (
             select max(l.tick_at) from public.coingame_bot_log l
             where l.coin_id = c.coin_id and l.action in ('buy', 'sell')
           ) as last_bot_trade_at,
           (
             select count(*) from public.coingame_bot_log l
             where l.coin_id = c.coin_id
               and l.action in ('buy', 'sell')
               and (l.tick_at at time zone 'UTC')::date = (timezone('utc', now()))::date
           ) as bot_trades_today
      from public.coingame_coins c
      left join public.profiles p on p.user_id = c.owner_user_id
      left join public.coingame_bot_coin_config bcc on bcc.coin_id = c.coin_id
      order by c.created_at desc;
end;
$$;

grant execute on function public.cg_bot_list_coins() to authenticated;

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

-- Coingame Casino / Gambling v1.
create or replace function public.cg_casino_get_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.coingame_casino%rowtype;
begin
  insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;
  select * into c from public.coingame_casino where id = 1;
  return to_jsonb(c);
end;
$$;

grant execute on function public.cg_casino_get_state() to authenticated;

create or replace function public.cg_casino_set_house_balance(p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.coingame_casino%rowtype;
begin
  if not public.cg_is_admin() then raise exception 'unauthorized'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'house balance must be non-negative'; end if;

  insert into public.coingame_casino (id, house_balance_fc)
  values (1, p_amount)
  on conflict (id) do update
    set house_balance_fc = excluded.house_balance_fc,
        updated_at = timezone('utc', now());

  select * into c from public.coingame_casino where id = 1;
  return to_jsonb(c);
end;
$$;

grant execute on function public.cg_casino_set_house_balance(numeric) to authenticated;

create or replace function public.cg_gambling_recent(p_limit integer default 25)
returns table (
  id uuid,
  game text,
  wager_fc numeric,
  choice text,
  target integer,
  roll integer,
  result text,
  multiplier numeric,
  payout_fc numeric,
  net_fc numeric,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  return query
    select b.id,
           b.game,
           b.wager_fc,
           b.choice,
           b.target,
           b.roll,
           b.result,
           b.multiplier,
           b.payout_fc,
           b.net_fc,
           b.created_at
      from public.coingame_gambling_bets b
     where b.user_id = uid
     order by b.created_at desc
     limit safe_limit;
end;
$$;

grant execute on function public.cg_gambling_recent(integer) to authenticated;

create or replace function public.cg_gamble_coinflip(p_choice text, p_wager numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  wallet public.coingame_wallets%rowtype;
  casino public.coingame_casino%rowtype;
  clean_choice text := lower(trim(coalesce(p_choice, '')));
  roll integer;
  outcome text;
  won boolean;
  multiplier numeric;
  payout numeric;
  house_risk numeric;
  bet_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if clean_choice not in ('heads', 'tails') then raise exception 'choice must be heads or tails'; end if;
  if p_wager is null or p_wager <= 0 then raise exception 'wager must be positive'; end if;

  insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;
  select * into casino from public.coingame_casino where id = 1 for update;
  if not casino.enabled then raise exception 'casino is disabled'; end if;

  multiplier := 2 * (1 - casino.house_edge);
  payout := p_wager * multiplier;
  house_risk := payout - p_wager;
  if casino.house_balance_fc < house_risk then raise exception 'casino reserve cannot cover this payout'; end if;

  select * into wallet from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not found'; end if;
  if wallet.fc_balance < p_wager then raise exception 'insufficient FC balance'; end if;

  roll := floor(random() * 2)::integer + 1;
  outcome := case when roll = 1 then 'heads' else 'tails' end;
  won := outcome = clean_choice;

  update public.coingame_wallets
     set fc_balance = fc_balance - p_wager + case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where user_id = uid;

  update public.coingame_casino
     set house_balance_fc = house_balance_fc + p_wager - case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where id = 1;

  insert into public.coingame_gambling_bets
    (user_id, game, wager_fc, choice, roll, result, multiplier, payout_fc, net_fc, metadata)
  values
    (uid, 'coinflip', p_wager, clean_choice, roll,
     case when won then 'win' else 'loss' end,
     multiplier, case when won then payout else 0 end,
     case when won then payout - p_wager else -p_wager end,
     jsonb_build_object('outcome', outcome, 'house_edge', casino.house_edge))
  returning id into bet_id;

  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
    values ('gamble_bet', uid, p_wager, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'choice', clean_choice));

  if won then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('gamble_win', uid, payout, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'roll', outcome));
  else
    insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
      values ('gamble_loss', uid, 0, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'roll', outcome, 'lost_wager', p_wager));
  end if;

  return jsonb_build_object(
    'id', bet_id,
    'game', 'coinflip',
    'wager_fc', p_wager,
    'choice', clean_choice,
    'roll', outcome,
    'result', case when won then 'win' else 'loss' end,
    'multiplier', multiplier,
    'payout_fc', case when won then payout else 0 end,
    'net_fc', case when won then payout - p_wager else -p_wager end,
    'new_balance', wallet.fc_balance - p_wager + case when won then payout else 0 end
  );
end;
$$;

grant execute on function public.cg_gamble_coinflip(text, numeric) to authenticated;

create or replace function public.cg_gamble_dice(p_target integer, p_wager numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  wallet public.coingame_wallets%rowtype;
  casino public.coingame_casino%rowtype;
  roll integer;
  won boolean;
  multiplier numeric;
  payout numeric;
  house_risk numeric;
  bet_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_target is null or p_target < 1 or p_target > 95 then raise exception 'target must be between 1 and 95'; end if;
  if p_wager is null or p_wager <= 0 then raise exception 'wager must be positive'; end if;

  insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;
  select * into casino from public.coingame_casino where id = 1 for update;
  if not casino.enabled then raise exception 'casino is disabled'; end if;

  multiplier := (100.0 / p_target) * (1 - casino.house_edge);
  payout := p_wager * multiplier;
  house_risk := payout - p_wager;
  if casino.house_balance_fc < house_risk then raise exception 'casino reserve cannot cover this payout'; end if;

  select * into wallet from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not found'; end if;
  if wallet.fc_balance < p_wager then raise exception 'insufficient FC balance'; end if;

  roll := floor(random() * 100)::integer + 1;
  won := roll <= p_target;

  update public.coingame_wallets
     set fc_balance = fc_balance - p_wager + case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where user_id = uid;

  update public.coingame_casino
     set house_balance_fc = house_balance_fc + p_wager - case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where id = 1;

  insert into public.coingame_gambling_bets
    (user_id, game, wager_fc, target, roll, result, multiplier, payout_fc, net_fc, metadata)
  values
    (uid, 'dice', p_wager, p_target, roll,
     case when won then 'win' else 'loss' end,
     multiplier, case when won then payout else 0 end,
     case when won then payout - p_wager else -p_wager end,
     jsonb_build_object('house_edge', casino.house_edge))
  returning id into bet_id;

  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
    values ('gamble_bet', uid, p_wager, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'target', p_target));

  if won then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('gamble_win', uid, payout, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'roll', roll, 'target', p_target));
  else
    insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
      values ('gamble_loss', uid, 0, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'roll', roll, 'target', p_target, 'lost_wager', p_wager));
  end if;

  return jsonb_build_object(
    'id', bet_id,
    'game', 'dice',
    'wager_fc', p_wager,
    'target', p_target,
    'roll', roll,
    'result', case when won then 'win' else 'loss' end,
    'multiplier', multiplier,
    'payout_fc', case when won then payout else 0 end,
    'net_fc', case when won then payout - p_wager else -p_wager end,
    'new_balance', wallet.fc_balance - p_wager + case when won then payout else 0 end
  );
end;
$$;

grant execute on function public.cg_gamble_dice(integer, numeric) to authenticated;

-- ── Collectables & Rewards ─────────────────────────────────────────────────────

create table if not exists public.coingame_collectables (
  id                    text primary key,
  label                 text not null,
  icon                  text not null,
  rarity                text not null check (rarity in ('legendary', 'epic', 'rare', 'uncommon', 'common')),
  color                 text not null,
  rbg                   text not null,
  rb                    text not null,
  unlock_description    text not null,
  min_tokens_minted     numeric,
  require_strong_status boolean not null default false,
  owner_min_streak      integer,
  owner_min_casino_bets integer,
  sort_order            integer not null default 0
);

alter table public.coingame_collectables enable row level security;

drop policy if exists "collectables readable by all" on public.coingame_collectables;
create policy "collectables readable by all"
  on public.coingame_collectables for select to authenticated using (true);

insert into public.coingame_collectables
  (id, label, icon, rarity, color, rbg, rb, unlock_description, min_tokens_minted, require_strong_status, owner_min_streak, owner_min_casino_bets, sort_order)
values
  ('chart',   'Candle Chart',    'TrendingUp', 'common',    '#22c55e', 'rgba(34,197,94,0.08)',   'rgba(34,197,94,0.25)',   'First buy happens on this coin',                    1,     false, null, null, 70),
  ('moon',    'Moon Lamp',       'Moon',       'common',    '#94a3b8', 'rgba(148,163,184,0.08)', 'rgba(148,163,184,0.25)', 'Owner logs in 3 days in a row',                     null,  false, 3,    null, 60),
  ('desk',    'Trading Desk',    'Monitor',    'uncommon',  '#22c55e', 'rgba(34,197,94,0.1)',    'rgba(34,197,94,0.3)',    'Coin reaches 100 tokens minted',                    100,   false, null, null, 50),
  ('nft',     'NFT Frame',       'Frame',      'uncommon',  '#34d399', 'rgba(52,211,153,0.1)',   'rgba(52,211,153,0.3)',   'Owner makes 3 casino bets',                         null,  false, null, 3,   40),
  ('diamond', 'Diamond Display', 'Gem',        'rare',      '#38bdf8', 'rgba(56,189,248,0.1)',   'rgba(56,189,248,0.3)',   'Coin reaches 1,000 tokens minted',                  1000,  false, null, null, 30),
  ('rocket',  'Rocket Statue',   'Rocket',     'rare',      '#818cf8', 'rgba(129,140,248,0.1)',  'rgba(129,140,248,0.3)',  'Coin reaches 5,000 tokens minted',                  5000,  false, null, null, 20),
  ('gold',    'Gold Pile',       'Coins',      'epic',      '#c084fc', 'rgba(192,132,252,0.12)', 'rgba(192,132,252,0.35)', 'Coin reaches 10,000 tokens minted',                 10000, false, null, null, 10),
  ('throne',  'Coin Throne',     'Crown',      'legendary', '#f59e0b', 'rgba(245,158,11,0.12)',  'rgba(245,158,11,0.35)',  'Coin reaches Strong status (market cap >= 75k FC)', null,  true,  null, null, 0)
on conflict (id) do update set
  label = excluded.label, icon = excluded.icon, rarity = excluded.rarity,
  color = excluded.color, rbg = excluded.rbg, rb = excluded.rb,
  unlock_description = excluded.unlock_description,
  min_tokens_minted = excluded.min_tokens_minted,
  require_strong_status = excluded.require_strong_status,
  owner_min_streak = excluded.owner_min_streak,
  owner_min_casino_bets = excluded.owner_min_casino_bets,
  sort_order = excluded.sort_order;

create table if not exists public.coingame_coin_rewards (
  coin_id        uuid not null references public.coingame_coins(coin_id) on delete cascade,
  collectable_id text not null references public.coingame_collectables(id) on delete cascade,
  unlocked_at    timestamptz not null default timezone('utc', now()),
  primary key (coin_id, collectable_id)
);

alter table public.coingame_coin_rewards enable row level security;

drop policy if exists "coin rewards readable by all" on public.coingame_coin_rewards;
create policy "coin rewards readable by all"
  on public.coingame_coin_rewards for select to authenticated using (true);

-- Internal helper: evaluate all unlock conditions for a coin and insert any
-- newly earned rewards. Called by buy, daily claim, and gamble RPCs.
create or replace function public.cg_grant_rewards_for_coin(p_coin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_coin        public.coingame_coins%rowtype;
  v_wallet      public.coingame_wallets%rowtype;
  v_casino_bets integer;
  v_col         record;
  v_met         boolean;
begin
  select * into v_coin from public.coingame_coins where coin_id = p_coin_id;
  if not found then return; end if;

  select * into v_wallet from public.coingame_wallets where user_id = v_coin.owner_user_id;

  select count(*) into v_casino_bets
    from public.coingame_gambling_bets where user_id = v_coin.owner_user_id;

  for v_col in select * from public.coingame_collectables loop
    v_met := true;

    if v_col.min_tokens_minted is not null and v_coin.tokens_minted < v_col.min_tokens_minted then
      v_met := false;
    end if;
    if v_col.require_strong_status and coalesce(v_coin.status, 'starter') <> 'strong' then
      v_met := false;
    end if;
    if v_col.owner_min_streak is not null and coalesce(v_wallet.login_streak, 0) < v_col.owner_min_streak then
      v_met := false;
    end if;
    if v_col.owner_min_casino_bets is not null and v_casino_bets < v_col.owner_min_casino_bets then
      v_met := false;
    end if;

    if v_met then
      insert into public.coingame_coin_rewards (coin_id, collectable_id)
      values (p_coin_id, v_col.id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- Public-facing: grants any new rewards then returns the full collectable list
-- with unlocked status. Called by the room page on open.
create or replace function public.cg_check_rewards(p_coin_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.cg_grant_rewards_for_coin(p_coin_id);

  return (
    select jsonb_agg(
      jsonb_build_object(
        'id',                 c.id,
        'label',              c.label,
        'icon',               c.icon,
        'rarity',             c.rarity,
        'color',              c.color,
        'rbg',                c.rbg,
        'rb',                 c.rb,
        'unlock_description', c.unlock_description,
        'unlocked',           (r.coin_id is not null),
        'unlocked_at',        r.unlocked_at
      ) order by c.sort_order
    )
    from public.coingame_collectables c
    left join public.coingame_coin_rewards r
      on r.coin_id = p_coin_id and r.collectable_id = c.id
  );
end;
$$;

grant execute on function public.cg_check_rewards(uuid) to authenticated;

-- Updated cg_buy_coin: grants rewards after every buy (tokens milestone)
create or replace function public.cg_buy_coin(p_coin_id uuid, p_tokens numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid             uuid := auth.uid();
  c               record;
  cost            numeric;
  fee             numeric;
  burn_amt        numeric;
  pool_amt        numeric;
  total_charge    numeric;
  current_balance numeric;
  spot            numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'tokens must be positive'; end if;

  select coin.coin_id, coin.owner_user_id, coin.base_price, coin.tokens_minted, coin.created_at
    into c
    from public.coingame_coins coin where coin.coin_id = p_coin_id for update;
  if not found then raise exception 'coin not found'; end if;
  if c.owner_user_id = uid then raise exception 'cannot buy your own coin'; end if;

  if c.tokens_minted + p_tokens > public.cg_const_total_supply_cap() then
    raise exception 'would exceed total supply cap';
  end if;

  cost := public.cg_curve_integral(c.tokens_minted, c.tokens_minted + p_tokens, c.base_price);
  if cost < public.cg_const_min_trade_fc() then
    raise exception 'trade below minimum (%)', public.cg_const_min_trade_fc();
  end if;
  fee      := cost * 0.01;
  burn_amt := fee * 0.5;
  pool_amt := fee * 0.5;
  total_charge := cost + fee;

  select fc_balance into current_balance
    from public.coingame_wallets w where w.user_id = uid for update;
  if not found then raise exception 'wallet not initialized — call cg_ensure_wallet first'; end if;
  if current_balance < total_charge then
    raise exception 'insufficient balance (need %, have %)', total_charge, current_balance;
  end if;

  update public.coingame_wallets w set fc_balance = fc_balance - total_charge where w.user_id = uid;

  update public.coingame_coins set tokens_minted = tokens_minted + p_tokens where coin_id = p_coin_id;

  insert into public.coingame_holdings (holder_user_id, coin_id, tokens_held, avg_buy_price, last_buy_at)
    values (uid, p_coin_id, p_tokens, cost / nullif(p_tokens, 0), timezone('utc', now()))
    on conflict (holder_user_id, coin_id) do update
      set tokens_held   = public.coingame_holdings.tokens_held + p_tokens,
          avg_buy_price = (
            (public.coingame_holdings.tokens_held * public.coingame_holdings.avg_buy_price) + cost
          ) / (public.coingame_holdings.tokens_held + p_tokens),
          last_buy_at   = timezone('utc', now());

  update public.coingame_economy
    set total_supply_minted = total_supply_minted + p_tokens,
        total_burned        = total_burned + burn_amt,
        prize_pool_fc       = prize_pool_fc + pool_amt,
        updated_at          = timezone('utc', now())
    where id = 1;

  spot := public.cg_spot_price(c.tokens_minted + p_tokens, c.base_price);

  insert into public.coingame_transactions
    (tx_type, from_user_id, to_user_id, coin_id, tokens, fc_amount, spot_price, metadata)
  values ('buy', uid, c.owner_user_id, p_coin_id, p_tokens, cost, spot,
          jsonb_build_object('fee', fee, 'burn', burn_amt, 'pool', pool_amt));
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id, metadata)
    values ('fee_burn', uid, burn_amt, p_coin_id, null);
  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, coin_id, metadata)
    values ('fee_pool', uid, pool_amt, p_coin_id, null);

  perform public.cg_recompute_status(p_coin_id);
  perform public.cg_record_leaderboard(uid, total_charge, -fee);
  perform public.cg_grant_rewards_for_coin(p_coin_id);

  return jsonb_build_object(
    'tokens', p_tokens, 'cost', cost, 'fee', fee,
    'total_charge', total_charge, 'spot_price', spot,
    'new_balance', current_balance - total_charge
  );
end;
$$;

grant execute on function public.cg_buy_coin(uuid, numeric) to authenticated;

-- Updated cg_claim_daily: grants rewards after streak update
create or replace function public.cg_claim_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid           uuid := auth.uid();
  w             record;
  today         date := (timezone('utc', now()))::date;
  last_day      date;
  reward        numeric;
  new_streak    integer;
  v_own_coin_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select wallet.user_id, wallet.fc_balance, wallet.login_streak, wallet.last_daily_claim_at into w
    from public.coingame_wallets wallet where wallet.user_id = uid for update;
  if not found then raise exception 'wallet not initialized'; end if;

  last_day := (w.last_daily_claim_at at time zone 'UTC')::date;
  if last_day = today then raise exception 'already claimed today'; end if;

  new_streak := case when last_day = today - 1 then w.login_streak + 1 else 1 end;
  reward     := 50 + 10 * least(new_streak, 30);

  update public.coingame_wallets wallet
    set fc_balance          = fc_balance + reward,
        login_streak        = new_streak,
        last_daily_claim_at = timezone('utc', now()),
        last_login_at       = timezone('utc', now())
    where wallet.user_id = uid;

  insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
    values ('reward', uid, reward, jsonb_build_object('reason', 'daily_claim', 'streak', new_streak));

  select coin_id into v_own_coin_id from public.coingame_coins where owner_user_id = uid;
  if v_own_coin_id is not null then
    perform public.cg_grant_rewards_for_coin(v_own_coin_id);
  end if;

  return jsonb_build_object('reward', reward, 'streak', new_streak, 'new_balance', w.fc_balance + reward);
end;
$$;

grant execute on function public.cg_claim_daily() to authenticated;

-- Updated cg_gamble_coinflip: grants rewards after each bet (casino milestone)
create or replace function public.cg_gamble_coinflip(p_choice text, p_wager numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid           uuid := auth.uid();
  wallet        public.coingame_wallets%rowtype;
  casino        public.coingame_casino%rowtype;
  clean_choice  text := lower(trim(coalesce(p_choice, '')));
  roll          integer;
  outcome       text;
  won           boolean;
  multiplier    numeric;
  payout        numeric;
  house_risk    numeric;
  bet_id        uuid;
  v_own_coin_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if clean_choice not in ('heads', 'tails') then raise exception 'choice must be heads or tails'; end if;
  if p_wager is null or p_wager <= 0 then raise exception 'wager must be positive'; end if;

  insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;
  select * into casino from public.coingame_casino where id = 1 for update;
  if not casino.enabled then raise exception 'casino is disabled'; end if;

  multiplier := 2 * (1 - casino.house_edge);
  payout     := p_wager * multiplier;
  house_risk := payout - p_wager;
  if casino.house_balance_fc < house_risk then raise exception 'casino reserve cannot cover this payout'; end if;

  select * into wallet from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not found'; end if;
  if wallet.fc_balance < p_wager then raise exception 'insufficient FC balance'; end if;

  roll    := floor(random() * 2)::integer + 1;
  outcome := case when roll = 1 then 'heads' else 'tails' end;
  won     := outcome = clean_choice;

  update public.coingame_wallets
     set fc_balance = fc_balance - p_wager + case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where user_id = uid;

  update public.coingame_casino
     set house_balance_fc = house_balance_fc + p_wager - case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where id = 1;

  insert into public.coingame_gambling_bets
    (user_id, game, wager_fc, choice, roll, result, multiplier, payout_fc, net_fc, metadata)
  values (uid, 'coinflip', p_wager, clean_choice, roll,
          case when won then 'win' else 'loss' end,
          multiplier, case when won then payout else 0 end,
          case when won then payout - p_wager else -p_wager end,
          jsonb_build_object('outcome', outcome, 'house_edge', casino.house_edge))
  returning id into bet_id;

  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
    values ('gamble_bet', uid, p_wager, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'choice', clean_choice));

  if won then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('gamble_win', uid, payout, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'roll', outcome));
  else
    insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
      values ('gamble_loss', uid, 0, jsonb_build_object('game', 'coinflip', 'bet_id', bet_id, 'roll', outcome, 'lost_wager', p_wager));
  end if;

  select coin_id into v_own_coin_id from public.coingame_coins where owner_user_id = uid;
  if v_own_coin_id is not null then
    perform public.cg_grant_rewards_for_coin(v_own_coin_id);
  end if;

  return jsonb_build_object(
    'id', bet_id, 'game', 'coinflip', 'wager_fc', p_wager,
    'choice', clean_choice, 'roll', outcome,
    'result', case when won then 'win' else 'loss' end,
    'multiplier', multiplier,
    'payout_fc', case when won then payout else 0 end,
    'net_fc', case when won then payout - p_wager else -p_wager end,
    'new_balance', wallet.fc_balance - p_wager + case when won then payout else 0 end
  );
end;
$$;

grant execute on function public.cg_gamble_coinflip(text, numeric) to authenticated;

-- Updated cg_gamble_dice: grants rewards after each bet (casino milestone)
create or replace function public.cg_gamble_dice(p_target integer, p_wager numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid           uuid := auth.uid();
  wallet        public.coingame_wallets%rowtype;
  casino        public.coingame_casino%rowtype;
  roll          integer;
  won           boolean;
  multiplier    numeric;
  payout        numeric;
  house_risk    numeric;
  bet_id        uuid;
  v_own_coin_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_target is null or p_target < 1 or p_target > 95 then raise exception 'target must be between 1 and 95'; end if;
  if p_wager is null or p_wager <= 0 then raise exception 'wager must be positive'; end if;

  insert into public.coingame_casino (id) values (1) on conflict (id) do nothing;
  select * into casino from public.coingame_casino where id = 1 for update;
  if not casino.enabled then raise exception 'casino is disabled'; end if;

  multiplier := (100.0 / p_target) * (1 - casino.house_edge);
  payout     := p_wager * multiplier;
  house_risk := payout - p_wager;
  if casino.house_balance_fc < house_risk then raise exception 'casino reserve cannot cover this payout'; end if;

  select * into wallet from public.coingame_wallets where user_id = uid for update;
  if not found then raise exception 'wallet not found'; end if;
  if wallet.fc_balance < p_wager then raise exception 'insufficient FC balance'; end if;

  roll := floor(random() * 100)::integer + 1;
  won  := roll <= p_target;

  update public.coingame_wallets
     set fc_balance = fc_balance - p_wager + case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where user_id = uid;

  update public.coingame_casino
     set house_balance_fc = house_balance_fc + p_wager - case when won then payout else 0 end,
         updated_at = timezone('utc', now())
   where id = 1;

  insert into public.coingame_gambling_bets
    (user_id, game, wager_fc, target, roll, result, multiplier, payout_fc, net_fc, metadata)
  values (uid, 'dice', p_wager, p_target, roll,
          case when won then 'win' else 'loss' end,
          multiplier, case when won then payout else 0 end,
          case when won then payout - p_wager else -p_wager end,
          jsonb_build_object('house_edge', casino.house_edge))
  returning id into bet_id;

  insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
    values ('gamble_bet', uid, p_wager, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'target', p_target));

  if won then
    insert into public.coingame_transactions (tx_type, to_user_id, fc_amount, metadata)
      values ('gamble_win', uid, payout, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'roll', roll, 'target', p_target));
  else
    insert into public.coingame_transactions (tx_type, from_user_id, fc_amount, metadata)
      values ('gamble_loss', uid, 0, jsonb_build_object('game', 'dice', 'bet_id', bet_id, 'roll', roll, 'target', p_target, 'lost_wager', p_wager));
  end if;

  select coin_id into v_own_coin_id from public.coingame_coins where owner_user_id = uid;
  if v_own_coin_id is not null then
    perform public.cg_grant_rewards_for_coin(v_own_coin_id);
  end if;

  return jsonb_build_object(
    'id', bet_id, 'game', 'dice', 'wager_fc', p_wager, 'target', p_target, 'roll', roll,
    'result', case when won then 'win' else 'loss' end,
    'multiplier', multiplier,
    'payout_fc', case when won then payout else 0 end,
    'net_fc', case when won then payout - p_wager else -p_wager end,
    'new_balance', wallet.fc_balance - p_wager + case when won then payout else 0 end
  );
end;
$$;

grant execute on function public.cg_gamble_dice(integer, numeric) to authenticated;
