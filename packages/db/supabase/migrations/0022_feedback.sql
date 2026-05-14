-- =====================================================================
-- Feedback / report-issue widget
-- Anyone (anonymous or authenticated) can submit. Only superadmins read.
-- =====================================================================

do $$ begin
  create type feedback_type as enum ('working', 'not_working', 'idea', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feedback_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  type feedback_type not null default 'other',
  message text not null check (char_length(message) between 5 and 5000),
  email text,
  user_id uuid references public.profiles (id) on delete set null,
  page_url text,
  user_agent text,
  status feedback_status not null default 'open',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anonymous + authenticated visitors can submit. No read access via RLS.
drop policy if exists feedback_insert_anyone on public.feedback;
create policy feedback_insert_anyone
  on public.feedback for insert to anon, authenticated
  with check (true);

-- Only superadmins see + manage feedback.
drop policy if exists feedback_read_superadmin on public.feedback;
create policy feedback_read_superadmin
  on public.feedback for select to authenticated
  using (public.is_superadmin());

drop policy if exists feedback_update_superadmin on public.feedback;
create policy feedback_update_superadmin
  on public.feedback for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status);

drop trigger if exists set_updated_at on public.feedback;
create trigger set_updated_at before update on public.feedback
  for each row execute function public.touch_updated_at();
