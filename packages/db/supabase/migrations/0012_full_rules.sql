-- =====================================================================
-- Phase 3.5 — full PKL rules in the trigger.
--
-- Adds:
--   1. Auto-fire all-out when on_mat reaches 0 after any non-all_out event.
--   2. Do-or-die counter — increment on empty_raid, reset on any scoring
--      event (touch / bonus / super raid / tackle / super tackle).
--   3. Card state changes:
--        green_card → no state change (warning only)
--        yellow_card → mark player 'suspended' until current_half + 2 min
--        red_card → mark player 'red_carded' (out for the match)
--   4. Substitution: swap on_mat ↔ bench (player_in / player_out via details).
--   5. Technical point — score updates via existing apply_match_event_score
--      trigger; no player-state change here.
--
-- Same logic mirrored in maintain_player_state_after_event_replay() for
-- recompute_match_player_state().
--
-- Run AFTER 0011_persist_raid_state.sql.
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
  attacker_on_mat int;
  defender_on_mat int;
  yellow_until int;
  player_in_id uuid;
  player_out_id uuid;
begin
  if (tg_op <> 'INSERT') then return new; end if;

  select * into m from public.matches where id = new.match_id;
  if m.id is null or m.scoring_version <> 2 then return new; end if;

  attacking_team := new.attacking_team_id;

  if attacking_team is not null then
    if attacking_team = m.home_team_id then
      defending_team := m.away_team_id;
    elsif attacking_team = m.away_team_id then
      defending_team := m.home_team_id;
    else
      return new;
    end if;
  end if;

  case new.type
    -- Raider scored against defenders ----------------------------------
    when 'raid_point', 'super_raid' then
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
      -- Reset do-or-die counter for the attacking team (they scored).
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    -- Bonus only — +1 point, no state change, no revival, resets dod.
    when 'bonus_point' then
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    -- Raider was tackled ---------------------------------------------
    when 'tackle_point', 'super_tackle' then
      raider_used := new.raider_id;
      if raider_used is null then
        raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
      end if;
      perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
      perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
      -- Tackle resets the dod counter for the raiding team (raid wasn't empty).
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    -- Do-or-die raid: branch on outcome ------------------------------
    when 'do_or_die_raid' then
      if coalesce(new.points_attacker, 0) > 0 then
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
        raider_used := new.raider_id;
        if raider_used is null then
          raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
        end if;
        perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
        perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
      end if;
      -- Either way, do-or-die resolves the counter.
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    -- Empty raid — increment do-or-die counter for the attacking team.
    when 'empty_raid' then
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = home_dod_counter + 1 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = away_dod_counter + 1 where id = m.id;
      end if;

    -- All-out: defending team's out players mass-revive ---------------
    when 'all_out' then
      update public.match_player_state
      set state = 'on_mat',
          out_seq = null,
          last_event_id = new.id,
          updated_at = now()
      where match_id = new.match_id
        and team_id = defending_team
        and state = 'out';
      if defending_team = m.home_team_id then
        update public.matches set home_all_outs = home_all_outs + 1 where id = m.id;
      else
        update public.matches set away_all_outs = away_all_outs + 1 where id = m.id;
      end if;

    -- Cards ----------------------------------------------------------
    when 'green_card' then
      -- Warning only, no state change.
      null;

    when 'yellow_card' then
      -- 2-minute suspension. Compute target time within the half;
      -- if it overflows the half, it expires at half end.
      if new.raider_id is not null then
        yellow_until := least(new.clock_seconds + 120, 30 * 60);
        update public.match_player_state
        set state = 'suspended',
            suspended_until_seconds = yellow_until,
            suspended_until_half = new.half,
            last_event_id = new.id,
            updated_at = now()
        where match_id = new.match_id and player_id = new.raider_id;
      end if;

    when 'red_card' then
      if new.raider_id is not null then
        update public.match_player_state
        set state = 'red_carded',
            last_event_id = new.id,
            updated_at = now()
        where match_id = new.match_id and player_id = new.raider_id;
      end if;

    when 'card_expired' then
      -- Yellow card expired — return the player to on_mat.
      if new.raider_id is not null then
        update public.match_player_state
        set state = 'on_mat',
            suspended_until_seconds = null,
            suspended_until_half = null,
            last_event_id = new.id,
            updated_at = now()
        where match_id = new.match_id and player_id = new.raider_id and state = 'suspended';
      end if;

    -- Substitution: details = { "in": <player_in_uuid>, "out": <player_out_uuid> }
    when 'substitution' then
      if new.details is not null then
        player_in_id := (new.details ->> 'in')::uuid;
        player_out_id := (new.details ->> 'out')::uuid;
        if player_out_id is not null then
          update public.match_player_state
          set state = 'bench',
              last_event_id = new.id,
              updated_at = now()
          where match_id = new.match_id and player_id = player_out_id;
        end if;
        if player_in_id is not null then
          update public.match_player_state
          set state = 'on_mat',
              out_seq = null,
              last_event_id = new.id,
              updated_at = now()
          where match_id = new.match_id and player_id = player_in_id;
        end if;
      end if;

    -- technical_point / time_out / review / review_upheld /
    -- review_overturned / golden_raid / match_end / lineup_set:
    --   no player-state change here. Score updates via the existing
    --   apply_match_event_score trigger.
    else
      null;
  end case;

  -- AUTO-FIRE ALL-OUT --------------------------------------------------
  -- After any non-all_out event, check whether either team's on_mat is now 0.
  -- If so, the OTHER team gets +2 bonus and the cleared team mass-revives.
  -- The recursive insert is safe because the new event is type='all_out',
  -- which short-circuits this check on the recursive call.
  if new.type <> 'all_out' and attacking_team is not null then
    select count(*) into attacker_on_mat
    from public.match_player_state
    where match_id = new.match_id and team_id = attacking_team and state = 'on_mat';

    select count(*) into defender_on_mat
    from public.match_player_state
    where match_id = new.match_id and team_id = defending_team and state = 'on_mat';

    if defender_on_mat = 0 then
      -- Attacker cleared defender's mat → attacker gets +2.
      insert into public.match_events (
        tenant_id, match_id, type, half, clock_seconds,
        attacking_team_id, points_attacker, points_defender, is_all_out
      ) values (
        new.tenant_id, new.match_id, 'all_out', new.half, new.clock_seconds,
        attacking_team, 2, 0, true
      );
    elsif attacker_on_mat = 0 then
      -- Defender cleared attacker's mat → defender gets +2.
      insert into public.match_events (
        tenant_id, match_id, type, half, clock_seconds,
        attacking_team_id, points_attacker, points_defender, is_all_out
      ) values (
        new.tenant_id, new.match_id, 'all_out', new.half, new.clock_seconds,
        defending_team, 2, 0, true
      );
    end if;
  end if;

  return new;
end $$;

-- ===================================================================
-- Same logic in the replay function (used by recompute_match_player_state).
-- ===================================================================
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
  yellow_until int;
  player_in_id uuid;
  player_out_id uuid;
begin
  select * into m from public.matches where id = e.match_id;
  if m.id is null or m.scoring_version <> 2 then return; end if;

  attacking_team := e.attacking_team_id;
  if attacking_team is not null then
    if attacking_team = m.home_team_id then
      defending_team := m.away_team_id;
    elsif attacking_team = m.away_team_id then
      defending_team := m.home_team_id;
    else
      return;
    end if;
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
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    when 'bonus_point' then
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    when 'tackle_point', 'super_tackle' then
      raider_used := coalesce(e.raider_id, public.match_player_state_first_on_mat(e.match_id, attacking_team));
      perform public.match_player_state_set_out(e.match_id, attacking_team, raider_used, e.id);
      perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

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
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    when 'empty_raid' then
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = home_dod_counter + 1 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = away_dod_counter + 1 where id = m.id;
      end if;

    when 'all_out' then
      update public.match_player_state
      set state = 'on_mat', out_seq = null, last_event_id = e.id, updated_at = now()
      where match_id = e.match_id and team_id = defending_team and state = 'out';

    when 'green_card' then null;

    when 'yellow_card' then
      if e.raider_id is not null then
        yellow_until := least(e.clock_seconds + 120, 30 * 60);
        update public.match_player_state
        set state = 'suspended', suspended_until_seconds = yellow_until,
            suspended_until_half = e.half, last_event_id = e.id, updated_at = now()
        where match_id = e.match_id and player_id = e.raider_id;
      end if;

    when 'red_card' then
      if e.raider_id is not null then
        update public.match_player_state
        set state = 'red_carded', last_event_id = e.id, updated_at = now()
        where match_id = e.match_id and player_id = e.raider_id;
      end if;

    when 'card_expired' then
      if e.raider_id is not null then
        update public.match_player_state
        set state = 'on_mat', suspended_until_seconds = null,
            suspended_until_half = null, last_event_id = e.id, updated_at = now()
        where match_id = e.match_id and player_id = e.raider_id and state = 'suspended';
      end if;

    when 'substitution' then
      if e.details is not null then
        player_in_id := (e.details ->> 'in')::uuid;
        player_out_id := (e.details ->> 'out')::uuid;
        if player_out_id is not null then
          update public.match_player_state
          set state = 'bench', last_event_id = e.id, updated_at = now()
          where match_id = e.match_id and player_id = player_out_id;
        end if;
        if player_in_id is not null then
          update public.match_player_state
          set state = 'on_mat', out_seq = null, last_event_id = e.id, updated_at = now()
          where match_id = e.match_id and player_id = player_in_id;
        end if;
      end if;

    else
      null;
  end case;
end $$;
