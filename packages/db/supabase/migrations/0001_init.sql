-- =====================================================================
-- Kabaddiadda — initial schema, helper functions, and RLS policies
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums ---------------------------------------------------------------
do $$ begin
  create type user_role as enum ('user', 'organiser', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_status as enum ('pending', 'active', 'suspended', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_format as enum ('league', 'knockout', 'group_knockout', 'double_elimination');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_status as enum ('draft', 'registration', 'scheduled', 'live', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('scheduled', 'live', 'half_time', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_event_type as enum (
    'raid_point', 'tackle_point', 'bonus_point', 'super_raid', 'super_tackle',
    'all_out', 'do_or_die_raid', 'technical_point', 'empty_raid',
    'review', 'time_out', 'substitution'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type player_role as enum ('raider', 'all_rounder', 'defender_corner', 'defender_cover');
exception when duplicate_object then null; end $$;

-- Tables --------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  custom_domain text unique,
  logo_url text,
  status tenant_status not null default 'pending',
  branding jsonb,
  owner_id uuid,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role user_role not null default 'user',
  tenant_id uuid references public.tenants (id) on delete set null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  cover_image text,
  format tournament_format not null,
  status tournament_status not null default 'draft',
  start_date date,
  end_date date,
  registration_deadline timestamptz,
  max_teams integer,
  entry_fee integer,
  prize_pool integer,
  rules jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete set null,
  name text not null,
  short_name text,
  logo_url text,
  primary_color text,
  manager_id uuid,
  captain_id uuid,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  user_id uuid,
  full_name text not null,
  jersey_number integer,
  role player_role not null default 'all_rounder',
  height_cm integer,
  weight_kg integer,
  dob text,
  is_captain boolean not null default false,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  city text,
  state text,
  address text,
  capacity integer,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  home_team_id uuid not null references public.teams (id),
  away_team_id uuid not null references public.teams (id),
  venue_id uuid references public.venues (id),
  scheduled_at timestamptz not null,
  status match_status not null default 'scheduled',
  home_score integer not null default 0,
  away_score integer not null default 0,
  current_half integer not null default 1,
  clock_seconds integer not null default 0,
  round text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  type match_event_type not null,
  half integer not null,
  clock_seconds integer not null,
  raider_id uuid,
  defender_ids jsonb,
  points_attacker integer not null default 0,
  points_defender integer not null default 0,
  is_super_raid boolean not null default false,
  is_super_tackle boolean not null default false,
  is_all_out boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid,
  tenant_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------
create index if not exists idx_profiles_tenant on public.profiles (tenant_id);
create index if not exists idx_tournaments_tenant on public.tournaments (tenant_id);
create index if not exists idx_teams_tenant on public.teams (tenant_id);
create index if not exists idx_teams_tournament on public.teams (tournament_id);
create index if not exists idx_players_tenant on public.players (tenant_id);
create index if not exists idx_players_team on public.players (team_id);
create index if not exists idx_matches_tenant on public.matches (tenant_id);
create index if not exists idx_matches_tournament on public.matches (tournament_id);
create index if not exists idx_matches_scheduled on public.matches (scheduled_at);
create index if not exists idx_match_events_match on public.match_events (match_id, half, clock_seconds);
create index if not exists idx_audit_tenant on public.audit_log (tenant_id, created_at desc);

-- Helper functions ----------------------------------------------------

-- Returns the role of the calling user (or 'user' if no profile yet).
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'user'::user_role
  );
$$;

-- Returns the tenant_id of the calling user.
create or replace function public.current_tenant_id() returns uuid
language sql stable security definer set search_path = public, auth as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- True if calling user is superadmin.
create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin');
$$;

-- True if calling user is organiser/superadmin AND owns the given tenant.
create or replace function public.is_tenant_organiser(t_id uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('organiser', 'superadmin')
      and (role = 'superadmin' or tenant_id = t_id)
  );
$$;

-- New-user trigger: insert profile from auth metadata --------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger ---------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  for t in select unnest(array['tenants','profiles','tournaments','teams','matches']) loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Enable RLS ----------------------------------------------------------
alter table public.tenants       enable row level security;
alter table public.profiles      enable row level security;
alter table public.tournaments   enable row level security;
alter table public.teams         enable row level security;
alter table public.players       enable row level security;
alter table public.venues        enable row level security;
alter table public.matches       enable row level security;
alter table public.match_events  enable row level security;
alter table public.audit_log     enable row level security;

-- ============ POLICIES ============================================
-- The general pattern:
--   * `read_public_*`  — anyone (auth or anon) can SELECT non-draft data
--   * `tenant_admin_*` — organisers of that tenant can write
--   * `superadmin_*`   — superadmins can do anything

-- TENANTS -------------------------------------------------------------
drop policy if exists tenants_read on public.tenants;
create policy tenants_read on public.tenants
  for select using (status = 'active' or public.is_superadmin() or owner_id = auth.uid());

drop policy if exists tenants_admin_write on public.tenants;
create policy tenants_admin_write on public.tenants
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists tenants_owner_update on public.tenants;
create policy tenants_owner_update on public.tenants
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- PROFILES ------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_superadmin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- TOURNAMENTS ---------------------------------------------------------
drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read on public.tournaments
  for select using (status <> 'draft' or public.is_tenant_organiser(tenant_id));

drop policy if exists tournaments_organiser_write on public.tournaments;
create policy tournaments_organiser_write on public.tournaments
  for all using (public.is_tenant_organiser(tenant_id))
  with check (public.is_tenant_organiser(tenant_id));

-- Generic "everyone can read, organisers can write" template
do $$
declare t text;
begin
  for t in select unnest(array['teams','players','venues','matches','match_events']) loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select using (true or public.is_tenant_organiser(tenant_id))',
      t || '_public_read', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_organiser_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_tenant_organiser(tenant_id)) with check (public.is_tenant_organiser(tenant_id))',
      t || '_organiser_write', t
    );
  end loop;
end $$;

-- AUDIT LOG -----------------------------------------------------------
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_superadmin());

drop policy if exists audit_insert_self on public.audit_log;
create policy audit_insert_self on public.audit_log
  for insert with check (actor_id = auth.uid() or public.is_superadmin());

-- ============ Realtime ============================================
-- Enable Realtime for live scoring. Use these channels in the client:
--   supabase.channel(`match:${matchId}`).on('postgres_changes', ...)
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    alter publication supabase_realtime add table public.matches, public.match_events;
  end if;
exception when others then null; end $$;
