-- =====================================================================
-- Phase 3 — live scoring. Adds attacking_team_id to match_events and a
-- trigger that keeps matches.home_score / away_score in sync as events
-- are inserted, updated, or deleted.
-- Run AFTER 0005_follows.sql.
-- =====================================================================

alter table public.match_events
  add column if not exists attacking_team_id uuid references public.teams (id);

create or replace function public.apply_match_event_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  is_home_attacking boolean;
  attacker_delta int;
  defender_delta int;
begin
  -- Decide whether to use NEW (insert/update) or OLD (delete) row.
  if (tg_op = 'DELETE') then
    select * into m from public.matches where id = old.match_id;
    if m.id is null then return old; end if;
    is_home_attacking := (old.attacking_team_id = m.home_team_id);
    attacker_delta := -coalesce(old.points_attacker, 0);
    defender_delta := -coalesce(old.points_defender, 0);
  else
    select * into m from public.matches where id = new.match_id;
    if m.id is null then return new; end if;
    is_home_attacking := (new.attacking_team_id = m.home_team_id);
    attacker_delta := coalesce(new.points_attacker, 0);
    defender_delta := coalesce(new.points_defender, 0);

    if (tg_op = 'UPDATE') then
      -- Reverse the OLD row's effect first.
      declare
        was_home_attacking boolean := (old.attacking_team_id = m.home_team_id);
      begin
        if was_home_attacking then
          update public.matches set
            home_score = home_score - coalesce(old.points_attacker, 0),
            away_score = away_score - coalesce(old.points_defender, 0)
          where id = m.id;
        else
          update public.matches set
            away_score = away_score - coalesce(old.points_attacker, 0),
            home_score = home_score - coalesce(old.points_defender, 0)
          where id = m.id;
        end if;
      end;
    end if;
  end if;

  if attacker_delta <> 0 or defender_delta <> 0 then
    if is_home_attacking then
      update public.matches set
        home_score = home_score + attacker_delta,
        away_score = away_score + defender_delta,
        updated_at = now()
      where id = m.id;
    else
      update public.matches set
        away_score = away_score + attacker_delta,
        home_score = home_score + defender_delta,
        updated_at = now()
      where id = m.id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_match_event_score on public.match_events;
create trigger trg_match_event_score
  after insert or update or delete on public.match_events
  for each row execute function public.apply_match_event_score();

-- One-shot recompute (in case events exist with no attacking_team_id yet —
-- after this migration runs, all NEW events should have it set).
create or replace function public.recompute_match_score(p_match_id uuid) returns void
language plpgsql as $$
declare
  m record;
  r record;
  home_pts int := 0;
  away_pts int := 0;
begin
  select * into m from public.matches where id = p_match_id;
  if m.id is null then return; end if;
  for r in select attacking_team_id, points_attacker, points_defender
           from public.match_events where match_id = p_match_id
  loop
    if r.attacking_team_id = m.home_team_id then
      home_pts := home_pts + coalesce(r.points_attacker, 0);
      away_pts := away_pts + coalesce(r.points_defender, 0);
    elsif r.attacking_team_id = m.away_team_id then
      away_pts := away_pts + coalesce(r.points_attacker, 0);
      home_pts := home_pts + coalesce(r.points_defender, 0);
    end if;
  end loop;
  update public.matches
    set home_score = home_pts, away_score = away_pts, updated_at = now()
    where id = p_match_id;
end;
$$;
