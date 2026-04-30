-- =====================================================================
-- Make public_players actually public.
--
-- Migration 0004 created public_players with security_invoker = true,
-- so anonymous reads inherited the strict players RLS policy and saw
-- nothing. Recreate without security_invoker so the view runs as the
-- view owner — and only expose columns from active tenants so a
-- soft-deleted / pending tenant's roster doesn't leak.
-- =====================================================================

drop view if exists public.public_players;

create view public.public_players as
select
  p.id,
  p.tenant_id,
  p.team_id,
  p.full_name,
  p.jersey_number,
  p.role,
  p.height_cm,
  p.weight_kg,
  p.is_captain,
  p.photo_url,
  p.created_at
from public.players p
join public.tenants t on t.id = p.tenant_id
where t.status = 'active';

comment on view public.public_players is
  'Public-safe player listing — non-PII columns only (no PAN, Aadhaar, mobile). Filters to active tenants. Anonymous + authenticated users can SELECT.';

grant select on public.public_players to anon, authenticated;
