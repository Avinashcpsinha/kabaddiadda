-- =====================================================================
-- Demo requests — leads captured by the "Book a Demo" marketing FAB.
-- Anyone (anonymous or authenticated) can submit. Only superadmins read.
-- =====================================================================

do $$ begin
  create type demo_request_status as enum ('new', 'contacted', 'qualified', 'won', 'lost', 'spam');
exception when duplicate_object then null; end $$;

create table if not exists public.demo_requests (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 2 and 200),
  mobile text not null check (char_length(mobile) between 5 and 40),
  email text not null check (char_length(email) between 3 and 320),
  organisation text not null check (char_length(organisation) between 1 and 200),
  social_link text check (social_link is null or char_length(social_link) <= 500),
  page_url text,
  user_agent text,
  user_id uuid references public.profiles (id) on delete set null,
  status demo_request_status not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;

-- Anonymous + authenticated visitors can submit. No read access via RLS.
drop policy if exists demo_requests_insert_anyone on public.demo_requests;
create policy demo_requests_insert_anyone
  on public.demo_requests for insert to anon, authenticated
  with check (true);

-- Only superadmins see + manage demo requests.
drop policy if exists demo_requests_read_superadmin on public.demo_requests;
create policy demo_requests_read_superadmin
  on public.demo_requests for select to authenticated
  using (public.is_superadmin());

drop policy if exists demo_requests_update_superadmin on public.demo_requests;
create policy demo_requests_update_superadmin
  on public.demo_requests for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create index if not exists demo_requests_created_at_idx on public.demo_requests (created_at desc);
create index if not exists demo_requests_status_idx on public.demo_requests (status);

drop trigger if exists set_updated_at on public.demo_requests;
create trigger set_updated_at before update on public.demo_requests
  for each row execute function public.touch_updated_at();
