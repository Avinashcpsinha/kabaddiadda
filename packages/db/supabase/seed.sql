-- =====================================================================
-- Optional dev seed data. Run AFTER 0001_init.sql to populate fixtures.
-- =====================================================================

insert into public.tenants (id, slug, name, status, contact_email)
values
  ('11111111-1111-1111-1111-111111111111', 'pkl', 'Pro Kabaddi League', 'active', 'admin@pkl.example'),
  ('22222222-2222-2222-2222-222222222222', 'bengal', 'Bengal Premier Kabaddi', 'active', 'admin@bengal.example')
on conflict (id) do nothing;

insert into public.tournaments (id, tenant_id, slug, name, format, status, start_date, end_date)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'season-12', 'PKL Season 12', 'group_knockout', 'live', '2026-04-01', '2026-06-15')
on conflict (id) do nothing;

insert into public.teams (id, tenant_id, tournament_id, name, short_name, city)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bengal Warriors', 'BEN', 'Kolkata'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Patna Pirates', 'PAT', 'Patna'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'U Mumba', 'MUM', 'Mumbai'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Telugu Titans', 'TEL', 'Hyderabad')
on conflict (id) do nothing;
