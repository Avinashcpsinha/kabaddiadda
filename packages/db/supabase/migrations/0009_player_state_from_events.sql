-- =====================================================================
-- Phase 3.2 — derive match_player_state from match_events.
--
-- After each match_event INSERT (on v2 matches), this trigger updates
-- match_player_state to reflect who's now on_mat / out, and maintains
-- the FIFO revival queue via out_seq. It powers the green/red on-mat
-- indicators in the scoring console and the live page.
--
-- Coverage:
--   raid_point / super_raid / do_or_die_raid (raider scored variant)
--     → defenders in defender_ids go OUT; attacking team revives N
--   bonus_point        → attacking team revives 1
--   tackle_point / super_tackle / do_or_die_raid (raider failed variant)
--     → raider goes OUT; defending team revives 1
--   all_out            → defending team's out players mass-revive to on_mat
--   empty_raid / cards / timeouts / reviews → no state change here
--
-- Fallback: if an event lacks explicit player IDs (today's UI doesn't
-- yet pick raider/defenders), the trigger picks the lowest-jersey on-mat
-- player from the appropriate team. This is scaffolding for step 4 of
-- the live-scoring rebuild — once the rebuilt console passes explicit
-- IDs, the fallback will rarely fire.
--
-- DELETE / UPDATE of events does NOT reverse state. Use
-- recompute_match_player_state(match_id) below to fully replay events.
--
-- Run AFTER 0008_lineups_and_advanced_scoring.sql.
-- =====================================================================

create or replace function public.match_player_state_set_out(
  p_match_id uuid,
  p_team_id uuid,
  p_player_id uuid,
  p_event_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  next_seq int;
begin
  if p_player_id is null then return; end if;

  select coalesce(max(out_seq), 0) + 1 into next_seq
  from public.match_player_state
  where match_id = p_match_id and team_id = p_team_id and state = 'out';

  update public.match_player_state
  set state = 'out',
      out_seq = next_seq,
      last_event_id = p_event_id,
      updated_at = now()
  where match_id = p_match_id
    and player_id = p_player_id
    and state = 'on_mat';
end $$;

create or replace function public.match_player_state_revive_one(
  p_match_id uuid,
  p_team_id uuid,
  p_event_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.match_player_state
  set state = 'on_mat',
      out_seq = null,
      last_event_id = p_event_id,
      updated_at = now()
  where id = (
    select id from public.match_player_state
    where match_id = p_match_id
      and team_id = p_team_id
      and state = 'out'
    order by out_seq asc nulls last
    limit 1
  );
end $$;

create or replace function public.match_player_state_first_on_mat(
  p_match_id uuid,
  p_team_id uuid
) returns uuid
language sql stable security definer set search_path = public as $$
  select s.player_id
  from public.match_player_state s
  join public.players p on p.id = s.player_id
  where s.match_id = p_match_id
    and s.team_id = p_team_id
    and s.state = 'on_mat'
  order by p.jersey_number nulls last, p.full_name
  limit 1;
$$;

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
    -- Raider scored against defenders --------------------------------
    when 'raid_point', 'super_raid' then
      if new.defender_ids is not null and jsonb_array_length(new.defender_ids) > 0 then
        for d_id in select jsonb_array_elements_text(new.defender_ids)
        loop
          perform public.match_player_state_set_out(new.match_id, defending_team, d_id::uuid, new.id);
          defenders_used := defenders_used + 1;
        end loop;
      end if;

      -- Fallback: no defender_ids → mark first on-mat defender out so
      -- the visual indicator still moves (scaffolding until step 4).
      if defenders_used = 0 then
        defender_player := public.match_player_state_first_on_mat(new.match_id, defending_team);
        if defender_player is not null then
          perform public.match_player_state_set_out(new.match_id, defending_team, defender_player, new.id);
        end if;
      end if;

      to_revive := coalesce(new.points_attacker, 0);
      for i in 1..to_revive loop
        perform public.match_player_state_revive_one(new.match_id, attacking_team, new.id);
      end loop;

    -- Bonus only — attacking team revives 1, no one goes out --------
    when 'bonus_point' then
      perform public.match_player_state_revive_one(new.match_id, attacking_team, new.id);

    -- Raider was tackled --------------------------------------------
    when 'tackle_point', 'super_tackle' then
      raider_used := new.raider_id;
      if raider_used is null then
        raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
      end if;
      perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);
      perform public.match_player_state_revive_one(new.match_id, defending_team, new.id);

    -- Do-or-die raid: branch on whether raider or defenders scored ---
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
          end if;
        end if;
        to_revive := coalesce(new.points_attacker, 0);
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

    -- All-out: every out player on the defending side mass-revives ---
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
      -- empty_raid, cards, timeouts, reviews, technical_point, etc.
      null;
  end case;

  return new;
end $$;

drop trigger if exists trg_maintain_player_state on public.match_events;
create trigger trg_maintain_player_state
  after insert on public.match_events
  for each row execute function public.maintain_player_state_after_event();

-- One-shot replay — re-derives match_player_state from scratch by
-- re-initialising from lineups then re-applying every event in order.
-- Use this if events are deleted or backfilled out of order.
create or replace function public.recompute_match_player_state(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e record;
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

-- Replay-mode wrapper: invokes the trigger logic without the trigger
-- machinery (used by recompute_match_player_state).
create or replace function public.maintain_player_state_after_event_replay(
  e public.match_events
) returns void
language plpgsql security definer set search_path = public as $$
declare
  fake record;
begin
  -- Build a trigger-shaped record and call the real handler via PERFORM.
  -- Easier: inline the same logic. To avoid duplication, dispatch via a
  -- temp table insert and trigger. For now: simple delegation by reusing
  -- a single insert-and-rollback pattern is overkill. Re-implement inline:
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
          end if;
        end if;
        to_revive := coalesce(e.points_attacker, 0);
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one(e.match_id, attacking_team, e.id);
        end loop;

      when 'bonus_point' then
        perform public.match_player_state_revive_one(e.match_id, attacking_team, e.id);

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
            end if;
          end if;
          to_revive := coalesce(e.points_attacker, 0);
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
  end;
end $$;
