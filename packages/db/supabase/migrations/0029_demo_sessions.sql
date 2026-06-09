-- =====================================================================
-- 0029 — Demo sessions
--
-- Captures WHO launches the instant "Try live scoring" demo. The instant
-- demo previously created an anonymous demo-<hex> tenant with no lead
-- info; this records the visitor's name (+ mobile/email) so they show up
-- in a superadmin "Demo sessions" page.
--
-- Distinct from demo_requests (the "Book a Demo" form). tenant_id points
-- at the ephemeral demo tenant and is ON DELETE SET NULL, so the lead
-- record SURVIVES the nightly demo-tenant cleanup (you keep the "who
-- came" history even after the sandbox is reaped).
-- =====================================================================

create table if not exists public.demo_sessions (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 1 and 200),
  mobile text check (mobile is null or char_length(mobile) between 3 and 40),
  email text check (email is null or char_length(email) between 3 and 320),
  -- Ephemeral demo tenant this visitor was given. SET NULL (not cascade)
  -- so the lead survives the nightly demo cleanup.
  tenant_id uuid references public.tenants (id) on delete set null,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists demo_sessions_created_at_idx on public.demo_sessions (created_at desc);

alter table public.demo_sessions enable row level security;

-- Anonymous + authenticated visitors can record a session (the instant
-- demo runs server-side with the service role, but allow it broadly).
drop policy if exists demo_sessions_insert_anyone on public.demo_sessions;
create policy demo_sessions_insert_anyone
  on public.demo_sessions for insert to anon, authenticated
  with check (true);

-- Only superadmins read + delete.
drop policy if exists demo_sessions_read_superadmin on public.demo_sessions;
create policy demo_sessions_read_superadmin
  on public.demo_sessions for select to authenticated
  using (public.is_superadmin());

drop policy if exists demo_sessions_delete_superadmin on public.demo_sessions;
create policy demo_sessions_delete_superadmin
  on public.demo_sessions for delete to authenticated
  using (public.is_superadmin());
