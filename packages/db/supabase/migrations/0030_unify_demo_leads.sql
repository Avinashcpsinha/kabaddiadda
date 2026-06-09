-- =====================================================================
-- 0030 — Unify instant-demo visitors into the demo_requests leads inbox
--
-- Instant "Try live scoring" visitors who give a name + contact are real
-- leads. Instead of a separate demo_sessions table, fold them into the
-- existing demo_requests pipeline (status / notes / call / email) so all
-- leads — booked + instant — live in one place and are NEVER touched by
-- the demo-sandbox cleanup.
--
--   • add `source` ('booked' | 'instant')
--   • make mobile / email / organisation nullable (instant leads may give
--     only one contact and no org)
--   • migrate existing demo_sessions rows in, then drop demo_sessions
-- =====================================================================

alter table public.demo_requests
  add column if not exists source text not null default 'booked';

do $$ begin
  alter table public.demo_requests
    add constraint demo_requests_source_check check (source in ('booked', 'instant'));
exception when duplicate_object then null; end $$;

-- Instant-demo leads may lack mobile/email/organisation — relax the
-- NOT NULLs and the length CHECKs (which assumed a non-null value).
alter table public.demo_requests
  alter column mobile drop not null,
  alter column email drop not null,
  alter column organisation drop not null;

alter table public.demo_requests drop constraint if exists demo_requests_mobile_check;
alter table public.demo_requests drop constraint if exists demo_requests_email_check;
alter table public.demo_requests drop constraint if exists demo_requests_organisation_check;

-- Fold any captured instant-demo sessions into the unified inbox.
insert into public.demo_requests
  (name, mobile, email, organisation, page_url, user_agent, source, status, created_at)
select name, mobile, email, null, page_url, user_agent, 'instant', 'new', created_at
from public.demo_sessions;

drop table if exists public.demo_sessions;
