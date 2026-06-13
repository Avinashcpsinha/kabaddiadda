-- =====================================================================
-- 0031 — Fix: successful raid does not revive a previously-out team-mate
--
-- Bug (reported 2026-06-13):
--   A raider scores a touch but the FIFO revival never fires. Revival
--   should happen on every successful raid EXCEPT at full strength.
--
-- Root cause:
--   Migration 0027 routed the ATTACKING-team revival (raid_point /
--   super_raid and do_or_die success) through
--   match_player_state_revive_one_prior_raid(). That helper marks an out
--   player eligible only when an OPPOSING-team raid event sits strictly
--   BETWEEN the player's outing event and the current event.
--
--   But in normal alternating play the attacking team's out player was put
--   out by the OPPONENT's immediately-preceding raid — there is no event
--   between that raid and the current one, so the EXISTS(...) is false and
--   the player is wrongly skipped. Net effect: no revival on a successful
--   raid (the most common case), which is exactly the reported symptom.
--
--   0027 was only trying to stop a SAME-RAID out (e.g. a raider tackled
--   earlier in THIS raid) from being revived. The correct definition of a
--   "same-raid" out is: the outing event belongs to the CURRENT raid —
--   i.e. it was attributed to the CURRENT attacking team AND no opposing
--   raid has happened since. An out that came from the OPPONENT's raid can
--   never be part of the current attacking team's raid, so it is always a
--   genuine prior-raid out and must stay eligible.
--
-- Fix:
--   Add one clause to the helper's eligibility filter:
--     oe.attacking_team_id is distinct from p_attacking_team_id
--   → an out caused by a different team's raid is always revivable. The
--   same-raid guard (own raid, no intervening opponent raid) is preserved
--   for outs attributed to the current attacking team.
--
--   Only the helper changes; the live trigger and the replay function
--   already call it for the attacking revival, so both paths are fixed at
--   once. The tackle_point / do_or_die-failure DEFENDING revivals are
--   untouched (they revive from the opponent's queue and are correct for
--   standard alternating play).
-- =====================================================================

create or replace function public.match_player_state_revive_one_prior_raid(
  p_match_id uuid,
  p_team_id uuid,
  p_event_id uuid,
  p_event_created_at timestamptz,
  p_attacking_team_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  select ps.id into target
  from public.match_player_state ps
  left join public.match_events oe on oe.id = ps.last_event_id
  where ps.match_id = p_match_id
    and ps.team_id = p_team_id
    and ps.state = 'out'
    and (
      oe.id is null
      -- ▼ 0031 FIX: an out from a DIFFERENT team's raid is, by definition,
      --   not part of the current attacking team's raid → always eligible.
      or oe.attacking_team_id is distinct from p_attacking_team_id
      -- ▲
      or exists (
        select 1 from public.match_events between_e
        where between_e.match_id = p_match_id
          and between_e.created_at > oe.created_at
          and between_e.created_at < p_event_created_at
          and between_e.attacking_team_id is not null
          and between_e.attacking_team_id <> p_attacking_team_id
          and between_e.type in (
            'raid_point', 'super_raid',
            'tackle_point', 'super_tackle',
            'bonus_point', 'do_or_die_raid',
            'empty_raid', 'all_out'
          )
      )
    )
  order by ps.out_seq asc nulls last
  limit 1;

  if target is not null then
    update public.match_player_state
    set state = 'on_mat',
        out_seq = null,
        last_event_id = p_event_id,
        updated_at = now()
    where id = target;
  end if;
end $$;
