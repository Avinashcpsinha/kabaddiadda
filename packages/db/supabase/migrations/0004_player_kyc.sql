-- =====================================================================
-- Phase 1.2 — player KYC fields, photo storage bucket, storage RLS.
-- Run this AFTER 0003_dev_friendly_trigger.sql.
--
-- ⚠️ COMPLIANCE NOTE
-- PAN and Aadhaar are sensitive PII under India's DPDP Act 2023 and UIDAI
-- regulations. Before going to production:
--   1. Encrypt these columns at rest (Supabase Vault / pgsodium).
--   2. Mask Aadhaar in the UI (show only last 4 digits).
--   3. Restrict access to organisers + the player themselves; never expose
--      via the public API or microsite.
--   4. Aadhaar should ideally NOT be stored at all — use UIDAI eKYC partners
--      (Karza, IDfy, Hyperverge) to verify and store only a verification ID.
-- For now we store as plain text but RLS keeps these rows organiser-only.
-- =====================================================================

alter table public.players
  add column if not exists mobile         text,
  add column if not exists pan            text,
  add column if not exists aadhaar        text;

-- Format checks: mobile is 10–15 digits with optional leading +;
-- PAN is 5 letters + 4 digits + 1 letter; Aadhaar is exactly 12 digits.
-- We allow NULL for all (optional fields), but enforce shape if provided.
alter table public.players
  drop constraint if exists players_mobile_format,
  drop constraint if exists players_pan_format,
  drop constraint if exists players_aadhaar_format;

alter table public.players
  add constraint players_mobile_format
    check (mobile is null or mobile ~ '^\+?[0-9]{10,15}$'),
  add constraint players_pan_format
    check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  add constraint players_aadhaar_format
    check (aadhaar is null or aadhaar ~ '^[0-9]{12}$');

-- Mobile is unique within a tenant. Cross-tenant duplicates are allowed
-- (the same person can play in multiple leagues across the platform).
create unique index if not exists players_tenant_mobile_unique
  on public.players (tenant_id, mobile)
  where mobile is not null;

-- Tighten public visibility of KYC: tournament_public_read on `players` (the
-- generic policy from 0001_init.sql) currently allows anyone to read all
-- player columns including new PII. Replace with a column-aware view + a
-- stricter RLS that limits anonymous reads to non-PII columns.
--
-- Implementation: drop the broad SELECT policy and restore one that only
-- shows PII to organisers / superadmins. Public clients SELECT through a
-- view (`public_players`) that omits the PII columns.

drop policy if exists players_public_read on public.players;
create policy players_select on public.players
  for select using (
    -- Organisers of this tenant + superadmins see everything
    public.is_tenant_organiser(tenant_id)
    -- The player themselves (if their auth user is linked) see their own row
    or user_id = auth.uid()
  );

-- Public-safe view (no PAN, no Aadhaar, masked mobile)
create or replace view public.public_players
with (security_invoker = true) as
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
from public.players p;

-- Allow public reads via the view (RLS still enforced on the underlying
-- table; the view just narrows columns).
grant select on public.public_players to anon, authenticated;

-- A separate INSERT/UPDATE/DELETE policy for organisers (re-create from 0001).
drop policy if exists players_organiser_write on public.players;
create policy players_organiser_write on public.players
  for all using (public.is_tenant_organiser(tenant_id))
  with check (public.is_tenant_organiser(tenant_id));

-- =====================================================================
-- Storage: player photos
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  2 * 1024 * 1024,                                -- 2 MB cap
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path scheme: {tenant_id}/{team_id}/{uuid}.{ext}
-- The first folder is the tenant_id; we use that to authorise writes.

drop policy if exists "player_photos_public_read" on storage.objects;
create policy "player_photos_public_read" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "player_photos_organiser_write" on storage.objects;
create policy "player_photos_organiser_write" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'player-photos'
    and public.is_tenant_organiser((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "player_photos_organiser_update" on storage.objects;
create policy "player_photos_organiser_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'player-photos'
    and public.is_tenant_organiser((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "player_photos_organiser_delete" on storage.objects;
create policy "player_photos_organiser_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'player-photos'
    and public.is_tenant_organiser((storage.foldername(name))[1]::uuid)
  );
