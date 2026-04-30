-- =====================================================================
-- Phase 2 — follows. Lets a logged-in user follow tournaments, teams, and
-- players, then see their followed entities in /feed/following.
-- Run AFTER 0004_player_kyc.sql.
-- =====================================================================

do $$ begin
  create type follow_target_type as enum ('tournament', 'team', 'player');
exception when duplicate_object then null; end $$;

create table if not exists public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type follow_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index if not exists idx_follows_user on public.follows (user_id, created_at desc);
create index if not exists idx_follows_target on public.follows (target_type, target_id);

alter table public.follows enable row level security;

drop policy if exists follows_self_read on public.follows;
create policy follows_self_read on public.follows
  for select using (user_id = auth.uid() or public.is_superadmin());

drop policy if exists follows_self_write on public.follows;
create policy follows_self_write on public.follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
