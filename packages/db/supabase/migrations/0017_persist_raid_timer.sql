-- =====================================================================
-- Phase 4.2 — persist the raid-timer remaining seconds.
--
-- Adds raid_seconds_left to public.matches so a browser refresh during
-- an active raid restores the raid clock from where it was, instead of
-- arming fresh at 30s.
--
-- The scoring console flushes this value along with clock_seconds /
-- current_raider_id every ~5 seconds while the match is running, so
-- worst-case loss on hard refresh is ~5 raid-seconds.
--
-- Run AFTER 0016_self_out_plus_defender_self_out.sql.
-- =====================================================================

alter table public.matches
  add column if not exists raid_seconds_left int not null default 0;

comment on column public.matches.raid_seconds_left is
  'Remaining seconds on the in-progress raid timer (0 when no raid is active). Persisted by the scoring console so a refresh resumes from the same point.';
