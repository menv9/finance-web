-- Social layer: profiles + friendships.
-- Lives alongside finance_records (which stays user-private).
-- Run against the same Supabase project after schema.sql.

create extension if not exists citext;

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-bump updated_at on row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── friendships ─────────────────────────────────────────────────────────────
-- Directional row: one row per request. On accept, status flips to 'accepted'
-- in place — no mirror row to keep in sync. Friend list query unions both sides.
create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (requester_id, addressee_id),
  constraint no_self_friend check (requester_id <> addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships visible to both sides" on public.friendships;
create policy "friendships visible to both sides"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships insert own request" on public.friendships;
create policy "friendships insert own request"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "friendships accept by addressee" on public.friendships;
create policy "friendships accept by addressee"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);

drop policy if exists "friendships delete by either side" on public.friendships;
create policy "friendships delete by either side"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

-- ── email lookup helper ─────────────────────────────────────────────────────
-- profiles has no email column; auth.users does but isn't directly readable.
-- This SECURITY DEFINER function returns just the user_id for an email match,
-- which the client can then use to fetch the matching profile row.
create or replace function public.find_user_by_email(lookup_email text)
returns uuid
language sql security definer set search_path = public
as $$
  select id from auth.users where lower(email) = lower(lookup_email) limit 1;
$$;

grant execute on function public.find_user_by_email(text) to authenticated;
