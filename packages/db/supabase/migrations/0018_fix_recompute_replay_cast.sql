-- =====================================================================
-- Phase 4.3 — fix `cannot cast type record to match_events` when
-- recompute_match_player_state is invoked.
--
-- The original function (0009) declared its loop variable as a generic
-- `record`, then passed it to maintain_player_state_after_event_replay
-- which expects a `public.match_events` composite. Postgres has no
-- implicit cast from anonymous record → named composite, so the call
-- fails the moment the loop body runs.
--
-- The bug was latent — recompute_match_player_state is only called when
-- events get deleted, which the scoring console only started doing as
-- of the 4 bug fixes pushed alongside this migration. The trigger path
-- (INSERT) was unaffected.
--
-- Fix: type the loop variable as match_events%rowtype so the row
-- assignment + downstream call type-match cleanly.
--
-- Run AFTER 0017_persist_raid_timer.sql.
-- =====================================================================

create or replace function public.recompute_match_player_state(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.match_events%rowtype;
begin
  perform public.initialize_match_player_state(p_match_id);
  for e in
    select * from public.match_events
    where match_id = p_match_id
    order by created_at asc
  loop
    perform public.maintain_player_state_after_event_replay(e);
  end loop;
end $$;
