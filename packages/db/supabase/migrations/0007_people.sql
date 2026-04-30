-- =====================================================================
-- Phase 1.3 — split "person" from "player". Mobile number is the global
-- identity of a human. The same person can be rostered to multiple teams
-- in different leagues; player rows are now per-roster, not per-person.
--
--   people   = the human (one mobile = one person, globally)
--   players  = a roster entry (person + team + jersey + role)
--
-- Run AFTER 0006_match_scoring.sql.
-- =====================================================================

create table if not exists public.people (
  id uuid primary key default uuid_generate_v4(),
  mobile text not null unique,
  full_name text not null,
  photo_url text,
  email text,
  pan text,
  aadhaar text,
  dob date,
  /** Linked auth user — set when the person signs up. NULL otherwise. */
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_people_user on public.people (user_id);

alter table public.people
  add constraint people_mobile_format
    check (mobile ~ '^\+?[0-9]{10,15}$'),
  add constraint people_pan_format
    check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  add constraint people_aadhaar_format
    check (aadhaar is null or aadhaar ~ '^[0-9]{12}$');

-- updated_at trigger
drop trigger if exists set_updated_at on public.people;
create trigger set_updated_at before update on public.people
  for each row execute function public.touch_updated_at();

-- Add person_id to players (nullable — players added without mobile have no
-- global identity yet; they're just names on a roster).
alter table public.players
  add column if not exists person_id uuid references public.people (id) on delete set null;

create index if not exists idx_players_person on public.players (person_id);

-- Backfill: for every existing player with a mobile, create-or-link a person
-- and copy PII over. Players added before this migration with the same mobile
-- in different tenants will collapse into a single person record.
do $$
declare
  pl record;
  pid uuid;
begin
  for pl in
    select id, full_name, mobile, pan, aadhaar, photo_url
    from public.players
    where mobile is not null
  loop
    insert into public.people (mobile, full_name, pan, aadhaar, photo_url)
    values (pl.mobile, pl.full_name, pl.pan, pl.aadhaar, pl.photo_url)
    on conflict (mobile) do update set
      -- Prefer existing data if already populated; otherwise take the new value.
      full_name = coalesce(public.people.full_name, excluded.full_name),
      pan       = coalesce(public.people.pan, excluded.pan),
      aadhaar   = coalesce(public.people.aadhaar, excluded.aadhaar),
      photo_url = coalesce(public.people.photo_url, excluded.photo_url),
      updated_at = now()
    returning id into pid;

    update public.players set person_id = pid where id = pl.id;
  end loop;
end $$;

-- A person can be rostered to a given team only once. Different teams (which
-- are themselves scoped to a tournament) are fine — that's how the same
-- human plays in multiple leagues.
create unique index if not exists players_person_per_team_unique
  on public.players (person_id, team_id)
  where person_id is not null;

-- Drop the moved columns and their constraints/index from players.
alter table public.players
  drop constraint if exists players_mobile_format,
  drop constraint if exists players_pan_format,
  drop constraint if exists players_aadhaar_format;

drop index if exists public.players_tenant_mobile_unique;

alter table public.players
  drop column if exists mobile,
  drop column if exists pan,
  drop column if exists aadhaar;

-- ============ RLS for people ===========================================
alter table public.people enable row level security;

-- SELECT: any authenticated user can read names + photos (the directory).
-- This DOES include PII columns, so the public_people view below is the
-- safe surface for anonymous clients.
drop policy if exists people_authenticated_read on public.people;
create policy people_authenticated_read on public.people
  for select to authenticated using (true);

-- WRITE: organisers + superadmins (creating roster entries), or the linked
-- user editing their own profile.
drop policy if exists people_organiser_write on public.people;
create policy people_organiser_write on public.people
  for all to authenticated
  using (
    public.is_superadmin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organiser', 'superadmin')
    )
  )
  with check (
    public.is_superadmin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organiser', 'superadmin')
    )
  );

-- Public-safe view: name + photo only, no PII, no mobile.
drop view if exists public.public_people;
create view public.public_people with (security_invoker = true) as
select id, full_name, photo_url, dob, created_at
from public.people;

grant select on public.public_people to anon, authenticated;
