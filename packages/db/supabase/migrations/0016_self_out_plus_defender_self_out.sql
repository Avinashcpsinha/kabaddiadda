-- =====================================================================
-- Phase 4.1 — Raider Self-Out + Defender Self-Out combined event.
--
-- A raid where one or more defenders voluntarily step off the mat AND
-- the raider also voluntarily exits is recorded as a SINGLE raid_point
-- event with details.reason = 'raider_self_out_plus_defender_self_out',
-- defender_ids = [the self-out defender(s)], raider_id = the raider,
-- points_attacker = N (per defender), points_defender = 1 (raider out).
--
-- The trigger handles this case specially:
--   • Mark all listed defenders OUT.
--   • Mark the raider OUT (attacking team).
--   • For each team, ONLY revive if there were players already OUT
--     before this event fired (FIFO from the existing out pool). When
--     both teams are at full strength, no revival happens — the new
--     outs are not used to satisfy the cross-revival.
--
-- Without this, the vanilla raid_point + tackle_point sequence would
-- revive the very player just outed, because revive_one always picks
-- the lowest out_seq and that's the player we just put out.
--
-- Rule (from product owner):
--   "In case of full strength no revival; in rest cases revival will
--    be there with the logic of first out first in."
--
-- Mirrored in the replay function used by recompute_match_player_state.
--
-- Run AFTER 0015_auto_bench.sql.
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
  -- Pre-event out counts for the SO+DSO combined-event case.
  pre_attacker_out int;
  pre_defender_out int;
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
      -- Combined "Raider self-out + Defender self-out" — one event,
      -- both teams score, both lose a player, both revive ONLY from
      -- their existing out pool (full-strength = no revival).
      if coalesce(new.details ->> 'reason', '') = 'raider_self_out_plus_defender_self_out' then
        select count(*) into pre_attacker_out
        from public.match_player_state
        where match_id = new.match_id
          and team_id = attacking_team
          and state = 'out';

        select count(*) into pre_defender_out
        from public.match_player_state
        where match_id = new.match_id
          and team_id = defending_team
          and state = 'out';

        if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(new.defender_ids)
          loop
            perform public.match_player_state_set_out(new.match_id, defending_team, d_id::uuid, new.id);
          end loop;
        end if;

        raider_used := new.raider_id;
        if raider_used is null then
          raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
        end if;
        if raider_used is not null then
          perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
        end if;

        -- Conditional FIFO revivals — only from the pool that existed
        -- BEFORE this event. When pre-count is 0 the new outs stay out.
        if pre_attacker_out > 0 then
          perform public.match_player_state_revive_one(new.match_id, attacking_team, new.id);
        end if;
        if pre_defender_out > 0 then
          perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
        end if;

        if attacking_team = m.home_team_id then
          update public.matches set home_dod_counter = 0 where id = m.id;
        elsif attacking_team = m.away_team_id then
          update public.matches set away_dod_counter = 0 where id = m.id;
        end if;
      else
        -- Vanilla raid_point / super_raid path (unchanged).
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
        if attacking_team = m.home_team_id then
          update public.matches set home_dod_counter = 0 where id = m.id;
        elsif attacking_team = m.away_team_id then
          update public.matches set away_dod_counter = 0 where id = m.id;
        end if;
      end if;

    when 'bonus_point' then
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

    when 'tackle_point', 'super_tackle' then
      raider_used := new.raider_id;
      if raider_used is null then
        raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
      end if;
      perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
      perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

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

    when 'green_card' then null;

    when 'yellow_card' then
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
      if new.raider_id is not null then
        update public.match_player_state
        set state = 'on_mat',
            suspended_until_seconds = null,
            suspended_until_half = null,
            last_event_id = new.id,
            updated_at = now()
        where match_id = new.match_id and player_id = new.raider_id and state = 'suspended';
      end if;

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

    else
      null;
  end case;

  -- AUTO-FIRE ALL-OUT --------------------------------------------------
  if new.type <> 'all_out' and attacking_team is not null then
    select count(*) into attacker_on_mat
    from public.match_player_state
    where match_id = new.match_id and team_id = attacking_team and state = 'on_mat';

    select count(*) into defender_on_mat
    from public.match_player_state
    where match_id = new.match_id and team_id = defending_team and state = 'on_mat';

    if defender_on_mat = 0 then
      insert into public.match_events (
        tenant_id, match_id, type, half, clock_seconds,
        attacking_team_id, points_attacker, points_defender, is_all_out
      ) values (
        new.tenant_id, new.match_id, 'all_out', new.half, new.clock_seconds,
        attacking_team, 2, 0, true
      );
    elsif attacker_on_mat = 0 then
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
-- Mirror in the replay function so recompute_match_player_state
-- produces the same state when events are replayed from scratch.
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
  pre_attacker_out int;
  pre_defender_out int;
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
      if coalesce(e.details ->> 'reason', '') = 'raider_self_out_plus_defender_self_out' then
        select count(*) into pre_attacker_out
        from public.match_player_state
        where match_id = e.match_id
          and team_id = attacking_team
          and state = 'out';

        select count(*) into pre_defender_out
        from public.match_player_state
        where match_id = e.match_id
          and team_id = defending_team
          and state = 'out';

        if e.defender_ids is not null and jsonb_array_length(e.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(e.defender_ids) loop
            perform public.match_player_state_set_out(e.match_id, defending_team, d_id::uuid, e.id);
          end loop;
        end if;

        raider_used := coalesce(e.raider_id, public.match_player_state_first_on_mat(e.match_id, attacking_team));
        if raider_used is not null then
          perform public.match_player_state_set_out(e.match_id, attacking_team, raider_used, e.id);
        end if;

        if pre_attacker_out > 0 then
          perform public.match_player_state_revive_one(e.match_id, attacking_team, e.id);
        end if;
        if pre_defender_out > 0 then
          perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);
        end if;

        if attacking_team = m.home_team_id then
          update public.matches set home_dod_counter = 0 where id = m.id;
        elsif attacking_team = m.away_team_id then
          update public.matches set away_dod_counter = 0 where id = m.id;
        end if;
      else
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
