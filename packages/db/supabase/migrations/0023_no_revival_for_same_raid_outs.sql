-- =====================================================================
-- 0023 — No revival for same-raid outs in tackle_point / super_tackle
--
-- Bug:
--   Raid: 7-on-mat both sides. Defender(s) self-out (raid_point with
--   reason='defender_self_out' OR 'bonus_plus_defender_self_out' OR
--   'touch_plus_defender_self_out'), attack scores +N, defenders go OUT.
--   THEN the raider is tackled / self-outs (tackle_point or super_tackle),
--   defence scores +1, raider goes OUT.
--   The tackle_point trigger then revives 1 defender — picking the
--   lowest out_seq, which is one of the defenders JUST outed in the
--   prior event of the SAME RAID. That defender effectively never went
--   out — wrong per IKF rules.
--
-- Rule (per product owner, restated 2026-05-23):
--   "In case of full strength no revival; in rest cases revival will be
--    there with the logic of first out first in."
--
-- Migration 0016 enforced this for the single-event combo
-- (raider_self_out_plus_defender_self_out). This migration extends the
-- same protection to the more common two-event sequence (defender_out
-- raid_point → tackle_point) where the operator records the two halves
-- of the raid with separate button presses.
--
-- Fix:
--   In the tackle_point / super_tackle handler, when reviving from the
--   defending team's queue, exclude players whose OUTING event has the
--   same raider_id as the current event. That excludes same-raid outs
--   while still allowing genuine prior-raid outs to revive FIFO.
--
-- Applies to both the live INSERT trigger (maintain_player_state_after_event)
-- and the replay function (maintain_player_state_after_event_replay).
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
  pre_attacker_out int;
  pre_defender_out int;
  revive_target uuid;
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
    when 'raid_point', 'super_raid' then
      if coalesce(new.details ->> 'reason', '') = 'raider_self_out_plus_defender_self_out' then
        select count(*) into pre_attacker_out
        from public.match_player_state
        where match_id = new.match_id and team_id = attacking_team and state = 'out';

        select count(*) into pre_defender_out
        from public.match_player_state
        where match_id = new.match_id and team_id = defending_team and state = 'out';

        if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(new.defender_ids) loop
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
        if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(new.defender_ids) loop
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

    -- ▼▼▼ THE FIX ▼▼▼
    -- Tackle: raider goes OUT, defending team scores +1 (+2 for super
    -- tackle). The revival pulls the lowest out_seq from the defending
    -- queue — BUT excludes players whose outing event has the same
    -- raider_id as this event. Those are same-raid outs (the operator
    -- recorded defender_self_out then raider_tackled as two events of
    -- the same raid) and per the full-strength-no-revival rule they
    -- aren't eligible to revive in this raid.
    when 'tackle_point', 'super_tackle' then
      raider_used := new.raider_id;
      if raider_used is null then
        raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
      end if;
      perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);

      if new.raider_id is null then
        -- No raider context — fall back to vanilla FIFO revival.
        perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
      else
        select ps.id into revive_target
        from public.match_player_state ps
        left join public.match_events oe on oe.id = ps.last_event_id
        where ps.match_id = new.match_id
          and ps.team_id = defending_team
          and ps.state = 'out'
          and (oe.raider_id is null or oe.raider_id <> new.raider_id)
        order by ps.out_seq asc nulls last
        limit 1;

        if revive_target is not null then
          update public.match_player_state
          set state = 'on_mat',
              out_seq = null,
              last_event_id = new.id,
              updated_at = now()
          where id = revive_target;
        end if;
      end if;

      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;
    -- ▲▲▲ END FIX ▲▲▲

    when 'do_or_die_raid' then
      if coalesce(new.points_attacker, 0) > 0 then
        if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
          for d_id in select jsonb_array_elements_text(new.defender_ids) loop
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
        -- Same same-raid filter as tackle_point.
        if new.raider_id is null then
          perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);
        else
          select ps.id into revive_target
          from public.match_player_state ps
          left join public.match_events oe on oe.id = ps.last_event_id
          where ps.match_id = new.match_id
            and ps.team_id = defending_team
            and ps.state = 'out'
            and (oe.raider_id is null or oe.raider_id <> new.raider_id)
          order by ps.out_seq asc nulls last
          limit 1;

          if revive_target is not null then
            update public.match_player_state
            set state = 'on_mat',
                out_seq = null,
                last_event_id = new.id,
                updated_at = now()
            where id = revive_target;
          end if;
        end if;
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
      where match_id = new.match_id and team_id = defending_team and state = 'out';
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

  -- AUTO-FIRE ALL-OUT ------------------------------------------------
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
-- Mirror the same fix in the replay function so recompute produces the
-- same state when events are replayed from scratch (e.g. after undo /
-- review-revert).
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
  revive_target uuid;
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
        where match_id = e.match_id and team_id = attacking_team and state = 'out';

        select count(*) into pre_defender_out
        from public.match_player_state
        where match_id = e.match_id and team_id = defending_team and state = 'out';

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

      if e.raider_id is null then
        perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);
      else
        select ps.id into revive_target
        from public.match_player_state ps
        left join public.match_events oe on oe.id = ps.last_event_id
        where ps.match_id = e.match_id
          and ps.team_id = defending_team
          and ps.state = 'out'
          and (oe.raider_id is null or oe.raider_id <> e.raider_id)
        order by ps.out_seq asc nulls last
        limit 1;

        if revive_target is not null then
          update public.match_player_state
          set state = 'on_mat',
              out_seq = null,
              last_event_id = e.id,
              updated_at = now()
          where id = revive_target;
        end if;
      end if;

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
        if e.raider_id is null then
          perform public.match_player_state_revive_one(e.match_id, defending_team, e.id);
        else
          select ps.id into revive_target
          from public.match_player_state ps
          left join public.match_events oe on oe.id = ps.last_event_id
          where ps.match_id = e.match_id
            and ps.team_id = defending_team
            and ps.state = 'out'
            and (oe.raider_id is null or oe.raider_id <> e.raider_id)
          order by ps.out_seq asc nulls last
          limit 1;

          if revive_target is not null then
            update public.match_player_state
            set state = 'on_mat',
                out_seq = null,
                last_event_id = e.id,
                updated_at = now()
            where id = revive_target;
          end if;
        end if;
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
