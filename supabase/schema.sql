create table if not exists public.finance_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  record_id text not null,
  payload jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  primary key (user_id, store_name, record_id)
);

create index if not exists finance_records_user_updated_idx
on public.finance_records (user_id, updated_at desc);

alter table public.finance_records enable row level security;

create policy "Users can read their own finance records"
on public.finance_records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own finance records"
on public.finance_records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own finance records"
on public.finance_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
