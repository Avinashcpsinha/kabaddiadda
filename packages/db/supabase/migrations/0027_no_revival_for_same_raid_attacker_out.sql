-- =====================================================================
-- 0027 — No revival for a same-raid ATTACKER out (symmetric to 0023/0024)
--
-- Bug (reported 2026-06-08):
--   Full strength, 7-v-7. Single raid, recorded as two button presses
--   in this order:
--     1. Raider is tackled  → tackle_point: defence +1, raider OUT.
--        Defending team tries to revive — nobody out at full strength,
--        so no revival. (attacking team now 6 on mat, defending 7)
--     2. A defender self-outs → raid_point (reason=defender_self_out):
--        attack +1, defender OUT. The raid_point handler then revives
--        `defenders_used` players from the ATTACKING team's out queue
--        via match_player_state_revive_one (lowest out_seq). At full
--        strength the attacking team's ONLY out player is the raider
--        just tackled in step 1 of THIS SAME RAID — so it wrongly
--        revives the raider. The raid should leave it 6-v-6 with NO
--        revival for either side.
--
-- Root cause:
--   Migrations 0023/0024 added the same-raid revival exclusion ONLY to
--   the tackle_point / super_tackle path (revival from the DEFENDING
--   queue) — the order "defender out first, then raider tackled". The
--   reverse order ("raider tackled first, then defender out") flows
--   through the raid_point handler's ATTACKING-queue revival, which was
--   never guarded. match_player_state_revive_one is a blind FIFO pick.
--   FIFO happens to shield the raider when a genuine prior-raid out
--   exists (lower out_seq), so the leak only bites at full strength —
--   but the operator swap feature can also reorder out_seq, so relying
--   on FIFO is not safe. We add the explicit raid-boundary guard.
--
-- Rule (unchanged, per product owner):
--   "In case of full strength no revival; in rest cases revival will be
--    there with the logic of first out first in."
--
-- Fix:
--   New helper match_player_state_revive_one_prior_raid(...) revives the
--   lowest-out_seq player whose outing event is from a PRIOR raid — i.e.
--   there IS an intervening other-team raid between that out and the
--   current event. Same raid-boundary definition as 0024, just applied
--   to the team being revived. The raid_point / super_raid branch and
--   the do_or_die success branch now loop on this helper instead of the
--   blind match_player_state_revive_one. Applied to the live trigger and
--   the replay function so recompute/undo stays consistent.
--
--   tackle_point / super_tackle and do_or_die FAILURE branches are left
--   exactly as 0024 defined them (already correct).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: revive one prior-raid out (FIFO), excluding same-raid outs.
-- "Same raid" = no other-team raid event between the candidate's outing
-- event and the current event (mirrors 0024's NOT-EXISTS boundary).
-- ---------------------------------------------------------------------
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

-- ===================================================================
-- Live INSERT trigger — based verbatim on 0024, with the attacking
-- revival in raid_point/super_raid and do_or_die-success swapped to the
-- prior-raid helper.
-- ===================================================================
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
        -- ▼▼▼ 0027 FIX: revive attackers FIFO but skip same-raid outs
        --       (e.g. a raider tackled earlier in THIS raid).
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one_prior_raid(
            new.match_id, attacking_team, new.id, new.created_at, new.attacking_team_id);
        end loop;
        -- ▲▲▲ END 0027 FIX ▲▲▲
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

      select ps.id into revive_target
      from public.match_player_state ps
      left join public.match_events oe on oe.id = ps.last_event_id
      where ps.match_id = new.match_id
        and ps.team_id = defending_team
        and ps.state = 'out'
        and (
          oe.id is null
          or exists (
            select 1 from public.match_events between_e
            where between_e.match_id = new.match_id
              and between_e.created_at > oe.created_at
              and between_e.created_at < new.created_at
              and between_e.attacking_team_id is not null
              and between_e.attacking_team_id <> new.attacking_team_id
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

      if revive_target is not null then
        update public.match_player_state
        set state = 'on_mat',
            out_seq = null,
            last_event_id = new.id,
            updated_at = now()
        where id = revive_target;
      end if;

      if attacking_team = m.home_team_id then
        update public.matches set home_dod_counter = 0 where id = m.id;
      elsif attacking_team = m.away_team_id then
        update public.matches set away_dod_counter = 0 where id = m.id;
      end if;

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
        -- ▼▼▼ 0027 FIX: same-raid-safe attacking revival (see above).
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one_prior_raid(
            new.match_id, attacking_team, new.id, new.created_at, new.attacking_team_id);
        end loop;
        -- ▲▲▲ END 0027 FIX ▲▲▲
      else
        raider_used := new.raider_id;
        if raider_used is null then
          raider_used := public.match_player_state_first_on_mat(new.match_id, attacking_team);
        end if;
        perform public.match_player_state_set_out(new.match_id, attacking_team, raider_used, new.id);

        select ps.id into revive_target
        from public.match_player_state ps
        left join public.match_events oe on oe.id = ps.last_event_id
        where ps.match_id = new.match_id
          and ps.team_id = defending_team
          and ps.state = 'out'
          and (
            oe.id is null
            or exists (
              select 1 from public.match_events between_e
              where between_e.match_id = new.match_id
                and between_e.created_at > oe.created_at
                and between_e.created_at < new.created_at
                and between_e.attacking_team_id is not null
                and between_e.attacking_team_id <> new.attacking_team_id
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
-- Replay mirror — identical fix so recompute (undo / review-revert)
-- reproduces the same state.
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
        -- ▼▼▼ 0027 FIX: same-raid-safe attacking revival (replay).
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one_prior_raid(
            e.match_id, attacking_team, e.id, e.created_at, e.attacking_team_id);
        end loop;
        -- ▲▲▲ END 0027 FIX ▲▲▲
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

      select ps.id into revive_target
      from public.match_player_state ps
      left join public.match_events oe on oe.id = ps.last_event_id
      where ps.match_id = e.match_id
        and ps.team_id = defending_team
        and ps.state = 'out'
        and (
          oe.id is null
          or exists (
            select 1 from public.match_events between_e
            where between_e.match_id = e.match_id
              and between_e.created_at > oe.created_at
              and between_e.created_at < e.created_at
              and between_e.attacking_team_id is not null
              and between_e.attacking_team_id <> e.attacking_team_id
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

      if revive_target is not null then
        update public.match_player_state
        set state = 'on_mat',
            out_seq = null,
            last_event_id = e.id,
            updated_at = now()
        where id = revive_target;
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
        -- ▼▼▼ 0027 FIX: same-raid-safe attacking revival (replay).
        to_revive := defenders_used;
        for i in 1..to_revive loop
          perform public.match_player_state_revive_one_prior_raid(
            e.match_id, attacking_team, e.id, e.created_at, e.attacking_team_id);
        end loop;
        -- ▲▲▲ END 0027 FIX ▲▲▲
      else
        raider_used := coalesce(e.raider_id, public.match_player_state_first_on_mat(e.match_id, attacking_team));
        perform public.match_player_state_set_out(e.match_id, attacking_team, raider_used, e.id);

        select ps.id into revive_target
        from public.match_player_state ps
        left join public.match_events oe on oe.id = ps.last_event_id
        where ps.match_id = e.match_id
          and ps.team_id = defending_team
          and ps.state = 'out'
          and (
            oe.id is null
            or exists (
              select 1 from public.match_events between_e
              where between_e.match_id = e.match_id
                and between_e.created_at > oe.created_at
                and between_e.created_at < e.created_at
                and between_e.attacking_team_id is not null
                and between_e.attacking_team_id <> e.attacking_team_id
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
