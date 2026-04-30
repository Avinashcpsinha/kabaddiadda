-- =====================================================================
-- Phase 3.1 — advanced live scoring foundations.
--
-- Adds the data needed to track every player's state during a match
-- (on_mat / bench / out / suspended), the starting lineup per team, and
-- the running counters the new scoring console will display
-- (do-or-die, timeouts used, reviews used, all-outs, super-tackle gating).
--
-- This migration is purely additive — existing matches continue to work
-- with `scoring_version = 1` and the legacy "tap a button" console.
-- New matches default to `scoring_version = 2` once a lineup is locked.
--
-- Run AFTER 0007_people.sql.
-- =====================================================================

-- New enum: per-match per-player state ---------------------------------
do $$ begin
  create type player_match_state as enum (
    'on_mat',
    'bench',
    'out',
    'suspended',
    'red_carded',
    'injured'
  );
exception when duplicate_object then null; end $$;

-- Extend match_event_type with cards, reviews, golden raid, etc. -------
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is supported on PG 9.6+.
alter type match_event_type add value if not exists 'green_card';
alter type match_event_type add value if not exists 'yellow_card';
alter type match_event_type add value if not exists 'red_card';
alter type match_event_type add value if not exists 'card_expired';
alter type match_event_type add value if not exists 'injury_timeout';
alter type match_event_type add value if not exists 'review_upheld';
alter type match_event_type add value if not exists 'review_overturned';
alter type match_event_type add value if not exists 'golden_raid';
alter type match_event_type add value if not exists 'match_end';
alter type match_event_type add value if not exists 'lineup_set';

-- Lineups -------------------------------------------------------------
create table if not exists public.match_lineups (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  /** Player IDs of the 7 starters on the mat at kick-off. */
  starting_player_ids jsonb not null default '[]'::jsonb,
  /** Player IDs of substitutes available on the bench. */
  bench_player_ids jsonb not null default '[]'::jsonb,
  /** Captain for this match (may differ from team's permanent captain). */
  captain_id uuid references public.players (id) on delete set null,
  /** Set when initialize_match_player_state runs; lineup is then frozen. */
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);

-- Per-player state for each match -------------------------------------
create table if not exists public.match_player_state (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  state player_match_state not null default 'bench',
  /** Position in the revival queue: lower = went out earlier, revives first. */
  out_seq integer,
  /** Yellow-card suspension end (clock seconds within the half). */
  suspended_until_seconds integer,
  suspended_until_half integer,
  last_event_id uuid,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- Match counters that drive the new console ---------------------------
alter table public.matches
  add column if not exists scoring_version integer not null default 1,
  add column if not exists current_raid_seq integer not null default 0,
  add column if not exists home_dod_counter integer not null default 0,
  add column if not exists away_dod_counter integer not null default 0,
  add column if not exists home_timeouts_used integer not null default 0,
  add column if not exists away_timeouts_used integer not null default 0,
  add column if not exists home_reviews_used integer not null default 0,
  add column if not exists away_reviews_used integer not null default 0,
  add column if not exists home_all_outs integer not null default 0,
  add column if not exists away_all_outs integer not null default 0;

-- Match-event extensions ----------------------------------------------
alter table public.match_events
  add column if not exists raid_seq integer,
  add column if not exists card_color text,
  add column if not exists revived_player_ids jsonb,
  add column if not exists details jsonb;

do $$ begin
  alter table public.match_events
    add constraint match_events_card_color_check
      check (card_color is null or card_color in ('green', 'yellow', 'red'));
exception when duplicate_object then null; end $$;

-- Indexes -------------------------------------------------------------
create index if not exists idx_match_lineups_match on public.match_lineups (match_id);
create index if not exists idx_match_lineups_tenant on public.match_lineups (tenant_id);
create index if not exists idx_match_player_state_match on public.match_player_state (match_id);
create index if not exists idx_match_player_state_team on public.match_player_state (match_id, team_id);
create index if not exists idx_match_player_state_tenant on public.match_player_state (tenant_id);
create index if not exists idx_match_events_raid_seq
  on public.match_events (match_id, raid_seq) where raid_seq is not null;

-- updated_at trigger for match_lineups --------------------------------
drop trigger if exists set_updated_at on public.match_lineups;
create trigger set_updated_at before update on public.match_lineups
  for each row execute function public.touch_updated_at();

-- Helper: initialize match_player_state from lineups -------------------
-- Idempotent. Wipes any prior state for the match, then seeds starters
-- as on_mat and the bench as bench. Locks each lineup row so it can't
-- be edited mid-match. Bumps scoring_version to 2.
create or replace function public.initialize_match_player_state(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m record;
  l record;
  pid uuid;
begin
  select * into m from public.matches where id = p_match_id;
  if m.id is null then return; end if;

  delete from public.match_player_state where match_id = p_match_id;

  for l in select * from public.match_lineups where match_id = p_match_id loop
    for pid in
      select (jsonb_array_elements_text(l.starting_player_ids))::uuid
    loop
      insert into public.match_player_state (
        tenant_id, match_id, team_id, player_id, state
      )
      values (m.tenant_id, p_match_id, l.team_id, pid, 'on_mat')
      on conflict (match_id, player_id)
        do update set state = 'on_mat', out_seq = null, updated_at = now();
    end loop;

    for pid in
      select (jsonb_array_elements_text(l.bench_player_ids))::uuid
    loop
      insert into public.match_player_state (
        tenant_id, match_id, team_id, player_id, state
      )
      values (m.tenant_id, p_match_id, l.team_id, pid, 'bench')
      on conflict (match_id, player_id)
        do update set state = 'bench', out_seq = null, updated_at = now();
    end loop;

    update public.match_lineups set locked_at = coalesce(locked_at, now()) where id = l.id;
  end loop;

  update public.matches set scoring_version = 2 where id = p_match_id;
end $$;

-- RLS for new tables --------------------------------------------------
alter table public.match_lineups enable row level security;
alter table public.match_player_state enable row level security;

drop policy if exists match_lineups_public_read on public.match_lineups;
create policy match_lineups_public_read on public.match_lineups
  for select using (true);

drop policy if exists match_lineups_organiser_write on public.match_lineups;
create policy match_lineups_organiser_write on public.match_lineups
  for all using (public.is_tenant_organiser(tenant_id))
  with check (public.is_tenant_organiser(tenant_id));

drop policy if exists match_player_state_public_read on public.match_player_state;
create policy match_player_state_public_read on public.match_player_state
  for select using (true);

drop policy if exists match_player_state_organiser_write on public.match_player_state;
create policy match_player_state_organiser_write on public.match_player_state
  for all using (public.is_tenant_organiser(tenant_id))
  with check (public.is_tenant_organiser(tenant_id));

-- Realtime ------------------------------------------------------------
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime
      add table public.match_lineups, public.match_player_state;
  end if;
exception when others then null; end $$;
