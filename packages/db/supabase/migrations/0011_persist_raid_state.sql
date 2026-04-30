-- =====================================================================
-- Phase 3.4 — persist in-progress raid state on the matches row so the
-- scoring console + public live page survive a refresh:
--
--   current_raider_id          — the player currently raiding (null when no raid)
--   current_attacking_team_id  — the team they belong to (avoids a join)
--
-- Cleared whenever a raid resolves (any scoring event by the operator).
--
-- The match clock_seconds column is unchanged — but the scoring console will
-- now persist it every ~5 seconds while the clock is running, so a refresh
-- only loses at most ~5s of progress instead of resetting to the last event.
-- That part is purely a client-side change (no schema needed).
--
-- Run AFTER 0010_fix_revival_rules.sql.
-- =====================================================================

alter table public.matches
  add column if not exists current_raider_id uuid,
  add column if not exists current_attacking_team_id uuid;

create index if not exists idx_matches_current_raider on public.matches (current_raider_id)
  where current_raider_id is not null;
