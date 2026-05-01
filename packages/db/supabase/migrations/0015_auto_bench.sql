-- =====================================================================
-- Auto-fill bench from team roster in initialize_match_player_state.
--
-- Original implementation only created match_player_state rows for
-- players explicitly listed in match_lineups (starting_player_ids and
-- bench_player_ids). If the lineup picker forgot to populate
-- bench_player_ids — or if a seed only set starters — substitution
-- would have nothing to pick from.
--
-- New behaviour: after seating the explicit starters + bench, scan the
-- team's full roster and seat any remaining player as 'bench'. The
-- on-conflict clause means explicit assignments still win.
-- =====================================================================

create or replace function public.initialize_match_player_state(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m record;
  l record;
  pid uuid;
begin
  select * into m from public.matches where id = p_match_id;
  if m.id is null then return; end if;

  delete from public.match_player_state where match_id = p_match_id;

  for l in select * from public.match_lineups where match_id = p_match_id loop
    -- Explicit starters from the lineup picker
    for pid in
      select (jsonb_array_elements_text(l.starting_player_ids))::uuid
    loop
      insert into public.match_player_state (
        tenant_id, match_id, team_id, player_id, state
      )
      values (m.tenant_id, p_match_id, l.team_id, pid, 'on_mat')
      on conflict (match_id, player_id)
        do update set state = 'on_mat', out_seq = null, updated_at = now();
    end loop;

    -- Explicit bench from the lineup picker
    for pid in
      select (jsonb_array_elements_text(l.bench_player_ids))::uuid
    loop
      insert into public.match_player_state (
        tenant_id, match_id, team_id, player_id, state
      )
      values (m.tenant_id, p_match_id, l.team_id, pid, 'bench')
      on conflict (match_id, player_id)
        do update set state = 'bench', out_seq = null, updated_at = now();
    end loop;

    -- Auto-fill bench: any roster player on this team not already seated
    -- gets added as 'bench' so the substitute picker always has options.
    -- The on-conflict clause means explicit assignments above still win.
    for pid in
      select p.id
      from public.players p
      where p.team_id = l.team_id
        and p.id not in (
          select player_id from public.match_player_state
          where match_id = p_match_id and team_id = l.team_id
        )
    loop
      insert into public.match_player_state (
        tenant_id, match_id, team_id, player_id, state
      )
      values (m.tenant_id, p_match_id, l.team_id, pid, 'bench')
      on conflict (match_id, player_id) do nothing;
    end loop;

    update public.match_lineups set locked_at = coalesce(locked_at, now()) where id = l.id;
  end loop;

  update public.matches set scoring_version = 2 where id = p_match_id;
end $$;

-- Re-initialise state for every match that already has a lineup. This
-- backfills bench rows for the demo data + any existing live matches
-- without disturbing on_mat / out / suspended states from prior events
-- (the function deletes state then re-seats from lineups; subsequent
-- match_events triggers will re-derive transient state on next event).
do $$
declare
  mid uuid;
begin
  for mid in
    select distinct match_id from public.match_lineups
  loop
    perform public.initialize_match_player_state(mid);
  end loop;
end $$;
