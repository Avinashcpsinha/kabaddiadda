-- =====================================================================
-- 0028 — Coaches (team coaching staff)
--
-- A `coaches` row mirrors `players`: a person in a coaching role on a
-- team for a particular tournament. Identity (mobile / PII / photo /
-- app login) lives on `people`, so the same human can coach many teams
-- across leagues — or coach one team and play for another — under one
-- `people` record. full_name / photo_url are a per-team denormalised
-- cache, exactly like players.
--
-- Coaches live entirely outside the match engine: no jersey, lineup,
-- match_player_state, or scoring. Adding this touches none of that.
--
-- RLS + the public_coaches view mirror players (0004 / 0014): organisers
-- of the tenant + superadmins read/write the base table; anonymous and
-- authenticated clients read a non-PII, active-tenant-only view.
-- =====================================================================

-- coach_role enum (guarded so re-apply is a no-op).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'coach_role') then
    create type public.coach_role as enum ('head_coach', 'assistant_coach');
  end if;
end $$;

create table if not exists public.coaches (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  -- Links to the canonical person. NULL for guest entries without mobile.
  person_id uuid references public.people (id) on delete set null,
  full_name text not null,
  role public.coach_role not null default 'head_coach',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coaches_team on public.coaches (team_id);
create index if not exists idx_coaches_person on public.coaches (person_id);
create index if not exists idx_coaches_tenant on public.coaches (tenant_id);

-- A person can hold a coaching slot on a given team only once (mirrors
-- players_person_per_team_unique). Different teams are fine.
create unique index if not exists coaches_person_per_team_unique
  on public.coaches (person_id, team_id)
  where person_id is not null;

-- updated_at trigger
drop trigger if exists set_updated_at on public.coaches;
create trigger set_updated_at before update on public.coaches
  for each row execute function public.touch_updated_at();

-- ===================== RLS (mirror players) =========================
alter table public.coaches enable row level security;

-- Organisers of this tenant + superadmins see everything. Everyone else
-- reads through the public_coaches view below.
drop policy if exists coaches_select on public.coaches;
create policy coaches_select on public.coaches
  for select using (
    public.is_tenant_organiser(tenant_id)
  );

drop policy if exists coaches_organiser_write on public.coaches;
create policy coaches_organiser_write on public.coaches
  for all using (public.is_tenant_organiser(tenant_id))
  with check (public.is_tenant_organiser(tenant_id));

-- ===================== public-safe view =============================
-- Non-PII columns only, active tenants only. NOT security_invoker, so
-- anonymous reads run as the view owner and bypass the strict base-table
-- RLS — exactly like public_players (0014).
drop view if exists public.public_coaches;
create view public.public_coaches as
select
  c.id,
  c.tenant_id,
  c.team_id,
  c.full_name,
  c.role,
  c.photo_url,
  c.created_at
from public.coaches c
join public.tenants t on t.id = c.tenant_id
where t.status = 'active';

comment on view public.public_coaches is
  'Public-safe coaching-staff listing — name, role, photo only (no PII). Filters to active tenants. Anonymous + authenticated users can SELECT.';

grant select on public.public_coaches to anon, authenticated;
