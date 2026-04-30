-- =====================================================================
-- Phase 3.3 — fix revival counts to match PKL rules.
--
-- Source: International Kabaddi Federation rulebook + PKL Season rules.
--
-- Two bugs in 0009's trigger:
--
--  1) BONUS POINT — was reviving 1 player. Per PKL rules a bonus point
--     awards +1 to the score but DOES NOT trigger a revival. Only points
--     scored by touch or by tackle yield revivals.
--
--  2) TOUCH + BONUS / SUPER RAID — used `points_attacker` as the revival
--     count, which over-revives by 1 whenever a bonus is included.
--     Correct rule: revivals = number of defenders touched (NOT total
--     points). So 2 touches + bonus = 3 points but 2 revivals.
--
-- Same fixes applied to the replay function used by recompute_match_player_state.
--
-- Run AFTER 0009_player_state_from_events.sql.
-- =====================================================================

create or replace function public.maintain_player_state_after_event()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  attacking_team uuid;
  defending_team uuid;
  d_id text;
  defender_player uuid;
  raider_used uuid;
  to_revive int;
  i int;
  defenders_used int := 0;
begin
  if (tg_op <> 'INSERT') then return new; end if;

  select * into m from public.matches where id = new.match_id;
  if m.id is null or m.scoring_version <> 2 then return new; end if;

  attacking_team := new.attacking_team_id;
  if attacking_team is null then return new; end if;

  if attacking_team = m.home_team_id then
    defending_team := m.away_team_id;
  elsif attacking_team = m.away_team_id then
    defending_team := m.home_team_id;
  else
    return new;
  end if;

  case new.type
    -- Raider scored against defenders. One defender out per touch, one
    -- revival on attacking side per touch. Bonus contributes 0 revivals.
    when 'raid_point', 'super_raid' then
      if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
        for d_id in select jsonb_array_elements_text(new.defender_ids)
        loop
          perform public.match_player_state_set_out(new.match_id, defending_team, d_id::uuid, new.id);
          defenders_used := defenders_used + 1;
        end loop;
      end if;

      -- Fallback: no defender_ids → mark first on-mat defender out
      if defenders_used = 0 then
        defender_player := public.match_player_state_first_on_mat(new.match_id, defending_team);
        if defender_player is not null then
          perform public.match_player_state_set_out(new.match_id, defending_team, defender_player, new.id);
          defenders_used := 1;
        end if;
      end if;

      -- Revivals = number of defenders touched (NOT points_attacker —
      -- because that includes the bonus point which yields 0 revivals).
      to_revive := defenders_used;
      for i in 1..to_revive loop
        perform public.match_player_state_revive_one(new.match_id, attacking_team, new.id);
      end loop;

    -- Bonus only — +1 point to attacker, NO state change, NO revival.
    -- Per IKF Rule on bonus points.
    when 'bonus_point' then
      null;

    -- Raider was tackled. Raider out, defending team revives 1.
    -- Super-tackle = +2 points but still only 1 revival.
    when 'tackle_point', 'super_tackle' then
      raider_used := new.raider_id;
      if raider_used is null then
        raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
      end if;
      perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
      perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);

    -- Do-or-die raid: branch on outcome.
    when 'do_or_die_raid' then
      if coalesce(new.points_attacker, 0) > 0 then
        -- Raider scored — same logic as raid_point.
        if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(new.defender_ids)
          loop
            perform public.match_player_state_set_out(new.match_id, defending_team, d_id::uuid, new.id);
            defenders_used := defenders_used + 1;
          end loop;
        end if;
        if defenders_used = 0 then
          defender_player := public.match_player_state_first_on_mat(new.match_id, defending_team);
          if defender_player is not null then
            perform public.match_player_state_set_out(new.match_id, defending_team, defender_player, new.id);
            defenders_used := 1;
          end if;
        end if;
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one(new.match_id, attacking_team, new.id);
        end loop;
      else
        -- Raider failed — raider out, defenders revive 1.
        raider_used := new.raider_id;
        if raider_used is null then
          raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
        end if;
        perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
        perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
      end if;

    -- All-out: defending team's out players mass-revive to on_mat.
    when 'all_out' then
      update public.match_player_state
      set state = 'on_mat',
          out_seq = null,
          last_event_id = new.id,
          updated_at = now()
      where match_id = new.match_id
        and team_id = defending_team
        and state = 'out';

    else
      -- empty_raid, cards, timeouts, reviews, technical_point — no state change here.
      null;
  end case;

  return new;
end $$;

-- Same logic in the replay wrapper used by recompute_match_player_state.
create or replace function public.maintain_player_state_after_event_replay(
  e public.match_events
) returns void
language plpgsql security definer set search_path = public as $$
declare
  m record;
  attacking_team uuid;
  defending_team uuid;
  d_id text;
  defender_player uuid;
  raider_used uuid;
  to_revive int;
  i int;
  defenders_used int := 0;
begin
  select * into m from public.matches where id = e.match_id;
  if m.id is null or m.scoring_version <> 2 then return; end if;

  attacking_team := e.attacking_team_id;
  if attacking_team is null then return; end if;

  if attacking_team = m.home_team_id then
    defending_team := m.away_team_id;
  elsif attacking_team = m.away_team_id then
    defending_team := m.home_team_id;
  else
    return;
  end if;

  case e.type
    when 'raid_point', 'super_raid' then
      if e.defender_ids is not null and jsonb_array_length(e.defender_ids) > 0 then
        for d_id in select jsonb_array_elements_text(e.defender_ids) loop
          perform public.match_player_state_set_out(e.match_id, defending_team, d_id::uuid, e.id);
          defenders_used := defenders_used + 1;
        end loop;
      end if;
      if defenders_used = 0 then
        defender_player := public.match_player_state_first_on_mat(e.match_id, defending_team);
        if defender_player is not null then
          perform public.match_player_state_set_out(e.match_id, defending_team, defender_player, e.id);
          defenders_used := 1;
        end if;
      end if;
      to_revive := defenders_used;
      for i in 1..to_revive loop
        perform public.match_player_state_revive_one(e.match_id, attacking_team, e.id);
      end loop;

    when 'bonus_point' then
      null;

    when 'tackle_point', 'super_tackle' then
      raider_used := coalesce(e.raider_id, public.match_player_state_first_on_mat(e.match_id, attacking_team));
      perform public.match_player_state_set_out(e.match_id, attacking_team, raider_used, e.id);
      perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);

    when 'do_or_die_raid' then
      if coalesce(e.points_attacker, 0) > 0 then
        if e.defender_ids is not null and jsonb_array_length(e.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(e.defender_ids) loop
            perform public.match_player_state_set_out(e.match_id, defending_team, d_id::uuid, e.id);
            defenders_used := defenders_used + 1;
          end loop;
        end if;
        if defenders_used = 0 then
          defender_player := public.match_player_state_first_on_mat(e.match_id, defending_team);
          if defender_player is not null then
            perform public.match_player_state_set_out(e.match_id, defending_team, defender_player, e.id);
            defenders_used := 1;
          end if;
        end if;
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one(e.match_id, attacking_team, e.id);
        end loop;
      else
        raider_used := coalesce(e.raider_id, public.match_player_state_first_on_mat(e.match_id, attacking_team));
        perform public.match_player_state_set_out(e.match_id, attacking_team, raider_used, e.id);
        perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);
      end if;

    when 'all_out' then
      update public.match_player_state
      set state = 'on_mat', out_seq = null, last_event_id = e.id, updated_at = now()
      where match_id = e.match_id and team_id = defending_team and state = 'out';

    else
      null;
  end case;
end $$;
