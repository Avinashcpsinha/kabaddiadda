-- ===================================================================
-- 0019: deterministic event ordering for trigger-inserted side effects
-- ===================================================================
--
-- Problem: maintain_player_state inserts an `all_out` event inside the
-- same transaction as the raid event that caused it. Both rows took
-- their `created_at` from the column default `now()`, which in
-- PostgreSQL returns the *transaction start time* — so the two rows
-- received identical timestamps. The scoring page (and downstream
-- consumers) order events by `created_at desc`; with tied values the
-- DB returns them in arbitrary order, so the all_out announcement
-- could render above OR below the touch that produced it.
--
-- Fix: switch the default to `clock_timestamp()` (statement time).
-- Calls inside a single transaction return distinct, monotonically
-- increasing values, so the all_out row inserted by the trigger is
-- always strictly later than the originating event.
--
-- Existing rows keep their original `now()`-set values; we don't
-- backfill, so historic ties stay tied. Going forward every new event
-- has a unique created_at and the log renders in the right order.

alter table public.match_events
  alter column created_at set default clock_timestamp();
