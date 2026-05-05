-- Friend ledger: manual IOUs, money requests, and bill splits.
-- Run after social.sql. Depends on profiles + are_friends().

create table if not exists public.friend_ledger (
  id                uuid primary key default gen_random_uuid(),
  creditor_id       uuid not null,
  debtor_id         uuid not null,
  amount_cents      bigint not null check (amount_cents > 0),
  currency          text not null default 'EUR',
  kind              text not null check (kind in ('split', 'request', 'manual', 'payment')),
  status            text not null default 'pending'
                    check (status in ('pending', 'settled', 'cancelled', 'rejected')),
  note              text,
  parent_expense_id text,
  group_key         uuid,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  settled_by        uuid references auth.users(id),
  constraint friend_ledger_creditor_fkey foreign key (creditor_id) references public.profiles(user_id) on delete cascade,
  constraint friend_ledger_debtor_fkey   foreign key (debtor_id)   references public.profiles(user_id) on delete cascade,
  constraint friend_ledger_no_self       check (creditor_id <> debtor_id)
);

create index if not exists friend_ledger_creditor_idx on public.friend_ledger (creditor_id, status);
create index if not exists friend_ledger_debtor_idx   on public.friend_ledger (debtor_id, status);
create index if not exists friend_ledger_group_idx    on public.friend_ledger (group_key) where group_key is not null;

alter table public.friend_ledger enable row level security;

drop policy if exists "ledger participant read" on public.friend_ledger;
create policy "ledger participant read"
  on public.friend_ledger for select to authenticated
  using (auth.uid() in (creditor_id, debtor_id));

drop policy if exists "ledger participant insert" on public.friend_ledger;
create policy "ledger participant insert"
  on public.friend_ledger for insert to authenticated
  with check (
    auth.uid() = created_by
    and auth.uid() in (creditor_id, debtor_id)
    and public.are_friends(creditor_id, debtor_id)
  );

drop policy if exists "ledger participant update" on public.friend_ledger;
create policy "ledger participant update"
  on public.friend_ledger for update to authenticated
  using (auth.uid() in (creditor_id, debtor_id));

drop policy if exists "ledger creator delete pending" on public.friend_ledger;
create policy "ledger creator delete pending"
  on public.friend_ledger for delete to authenticated
  using (auth.uid() = created_by and status = 'pending');
