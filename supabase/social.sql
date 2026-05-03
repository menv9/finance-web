-- Social expansion: activity feed + shared goals.
-- Run after profiles.sql. Depends on friendships table for RLS.

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Returns true if two users are confirmed friends (either direction).
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Bypasses RLS to check goal participation — used in shared_goal_participants
-- policies to avoid infinite recursion from self-referential RLS.
create or replace function public.is_goal_participant(p_goal_id uuid, p_user_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  return exists (
    select 1 from public.shared_goal_participants
    where goal_id = p_goal_id and user_id = p_user_id
  );
end;
$$;

grant execute on function public.is_goal_participant(uuid, uuid) to authenticated;

-- ── activity_privacy ─────────────────────────────────────────────────────────
-- Defined before social_activity so the friend-read policy can reference it.
create table if not exists public.activity_privacy (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  feed_enabled  boolean not null default true,
  visible_types text[] not null default array[
    'goal_reached', 'debt_paid', 'savings_milestone',
    'goal_created', 'shared_goal_created', 'shared_goal_reached'
  ]
);

alter table public.activity_privacy enable row level security;

drop policy if exists "privacy own read" on public.activity_privacy;
create policy "privacy own read"
  on public.activity_privacy for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "privacy own write" on public.activity_privacy;
create policy "privacy own write"
  on public.activity_privacy for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "privacy own update" on public.activity_privacy;
create policy "privacy own update"
  on public.activity_privacy for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── social_activity ───────────────────────────────────────────────────────────
-- One row per milestone event. Friends can read based on privacy settings.
create table if not exists public.social_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default timezone('utc', now()),
  constraint activity_type_check check (type in (
    'goal_reached', 'debt_paid', 'savings_milestone',
    'goal_created', 'shared_goal_created', 'shared_goal_reached'
  ))
);

create index if not exists social_activity_user_idx on public.social_activity (user_id, created_at desc);

alter table public.social_activity enable row level security;

drop policy if exists "activity own read" on public.social_activity;
create policy "activity own read"
  on public.social_activity for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "activity friend read" on public.social_activity;
create policy "activity friend read"
  on public.social_activity for select to authenticated
  using (
    auth.uid() <> user_id
    and public.are_friends(auth.uid(), user_id)
    and exists (
      select 1 from public.activity_privacy ap
      where ap.user_id = social_activity.user_id
        and ap.feed_enabled = true
        and social_activity.type = any(ap.visible_types)
    )
  );

drop policy if exists "activity own insert" on public.social_activity;
create policy "activity own insert"
  on public.social_activity for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "activity own delete" on public.social_activity;
create policy "activity own delete"
  on public.social_activity for delete to authenticated
  using (auth.uid() = user_id);

-- ── activity_reactions ────────────────────────────────────────────────────────
-- Emoji reactions on feed items. One reaction per user per activity.
create table if not exists public.activity_reactions (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.social_activity(id) on delete cascade,
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (activity_id, user_id)
);

create index if not exists reactions_activity_idx on public.activity_reactions (activity_id);

alter table public.activity_reactions enable row level security;

drop policy if exists "reactions read by activity participants" on public.activity_reactions;
create policy "reactions read by activity participants"
  on public.activity_reactions for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.social_activity sa
      where sa.id = activity_id
        and (sa.user_id = auth.uid() or public.are_friends(auth.uid(), sa.user_id))
    )
  );

drop policy if exists "reactions own insert" on public.activity_reactions;
create policy "reactions own insert"
  on public.activity_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reactions own delete" on public.activity_reactions;
create policy "reactions own delete"
  on public.activity_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- ── activity_comments ─────────────────────────────────────────────────────────
create table if not exists public.activity_comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.social_activity(id) on delete cascade,
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists comments_activity_idx on public.activity_comments (activity_id, created_at);

alter table public.activity_comments enable row level security;

drop policy if exists "comments read by activity participants" on public.activity_comments;
create policy "comments read by activity participants"
  on public.activity_comments for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.social_activity sa
      where sa.id = activity_id
        and (sa.user_id = auth.uid() or public.are_friends(auth.uid(), sa.user_id))
    )
  );

drop policy if exists "comments own insert" on public.activity_comments;
create policy "comments own insert"
  on public.activity_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comments own delete" on public.activity_comments;
create policy "comments own delete"
  on public.activity_comments for delete to authenticated
  using (auth.uid() = user_id);

-- ── shared_goals ─────────────────────────────────────────────────────────────
create table if not exists public.shared_goals (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  target_cents  bigint not null check (target_cents > 0),
  currency      text not null default 'EUR',
  description   text,
  emoji         text,
  created_at    timestamptz not null default timezone('utc', now()),
  completed_at  timestamptz
);

alter table public.shared_goals enable row level security;

-- ── shared_goal_participants ──────────────────────────────────────────────────
-- Created before shared_goals policies so the select policy can reference it.
create table if not exists public.shared_goal_participants (
  goal_id    uuid not null references public.shared_goals(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default timezone('utc', now()),
  primary key (goal_id, user_id)
);

create index if not exists sgp_user_idx on public.shared_goal_participants (user_id);

alter table public.shared_goal_participants enable row level security;

drop policy if exists "sgp read by participants" on public.shared_goal_participants;
create policy "sgp read by participants"
  on public.shared_goal_participants for select to authenticated
  using (public.is_goal_participant(goal_id, auth.uid()));

drop policy if exists "sgp insert by creator" on public.shared_goal_participants;
create policy "sgp insert by creator"
  on public.shared_goal_participants for insert to authenticated
  with check (
    exists (
      select 1 from public.shared_goals sg
      where sg.id = goal_id and sg.creator_id = auth.uid()
    )
  );

drop policy if exists "sgp delete by creator or self" on public.shared_goal_participants;
create policy "sgp delete by creator or self"
  on public.shared_goal_participants for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.shared_goals sg
      where sg.id = goal_id and sg.creator_id = auth.uid()
    )
  );

-- ── shared_goals policies (after participants table exists) ───────────────────
drop policy if exists "shared_goals read by participants" on public.shared_goals;
create policy "shared_goals read by participants"
  on public.shared_goals for select to authenticated
  using (
    exists (
      select 1 from public.shared_goal_participants sgp
      where sgp.goal_id = id and sgp.user_id = auth.uid()
    )
  );

drop policy if exists "shared_goals insert by creator" on public.shared_goals;
create policy "shared_goals insert by creator"
  on public.shared_goals for insert to authenticated
  with check (auth.uid() = creator_id);

drop policy if exists "shared_goals update by creator" on public.shared_goals;
create policy "shared_goals update by creator"
  on public.shared_goals for update to authenticated
  using (auth.uid() = creator_id);

drop policy if exists "shared_goals delete by creator" on public.shared_goals;
create policy "shared_goals delete by creator"
  on public.shared_goals for delete to authenticated
  using (auth.uid() = creator_id);

-- ── shared_goal_contributions ─────────────────────────────────────────────────
create table if not exists public.shared_goal_contributions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.shared_goals(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  note         text,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists sgc_goal_idx on public.shared_goal_contributions (goal_id, created_at desc);

alter table public.shared_goal_contributions enable row level security;

drop policy if exists "sgc read by participants" on public.shared_goal_contributions;
create policy "sgc read by participants"
  on public.shared_goal_contributions for select to authenticated
  using (public.is_goal_participant(goal_id, auth.uid()));

drop policy if exists "sgc insert by participant" on public.shared_goal_contributions;
create policy "sgc insert by participant"
  on public.shared_goal_contributions for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_goal_participant(goal_id, auth.uid())
  );

drop policy if exists "sgc delete own" on public.shared_goal_contributions;
create policy "sgc delete own"
  on public.shared_goal_contributions for delete to authenticated
  using (auth.uid() = user_id);
