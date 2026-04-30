-- =====================================================================
-- Phase 6/7 — Stats foundation + player rankings
--
-- Three layers, all derived from match_events at read time:
--   1) player_match_stats  — one row per (player, match)
--   2) player_season_stats — aggregated per (player, tournament)
--   3) player_rankings     — per-role leaderboard within (tournament|all-time)
--
-- Implemented as VIEWS (not materialized) so they stay synced as events
-- arrive. Postgres handles the aggregations comfortably at expected scale
-- (~80 events/match × hundreds of matches). If we need to scale beyond
-- that, swap to materialized views or a trigger-maintained fact table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. player_match_stats — granular per-match contribution
-- ---------------------------------------------------------------------
-- Note on tackle credit: when N defenders tackle a raider, each defender
-- gets full credit for 1 tackle point. PKL stats follow the same rule.

create or replace view public.player_match_stats as
with raid_events as (
  -- Events where this player was the raider
  select
    e.tenant_id,
    e.match_id,
    m.tournament_id,
    e.raider_id as player_id,
    e.points_attacker,
    e.type,
    e.is_super_raid
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.raider_id is not null
    and e.type in ('raid_point', 'super_raid', 'bonus_point', 'empty_raid', 'do_or_die_raid')
),
tackle_events as (
  -- Each defender gets a row for each tackle they participated in
  select
    e.tenant_id,
    e.match_id,
    m.tournament_id,
    (jsonb_array_elements_text(e.defender_ids))::uuid as player_id,
    e.points_defender,
    e.type,
    e.is_super_tackle,
    jsonb_array_length(e.defender_ids) as defenders_count
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.defender_ids is not null
    and jsonb_array_length(e.defender_ids) > 0
    and e.type in ('tackle_point', 'super_tackle')
),
raid_agg as (
  select
    player_id,
    match_id,
    tenant_id,
    tournament_id,
    sum(points_attacker)                                                   as raid_points,
    count(*) filter (where type = 'super_raid' or is_super_raid)           as super_raids,
    count(*) filter (where type = 'bonus_point')                           as bonus_points,
    count(*) filter (where type = 'empty_raid')                            as empty_raids,
    count(*) filter (where type = 'do_or_die_raid' and points_attacker > 0) as dod_conversions,
    count(*) filter (where type = 'do_or_die_raid')                        as dod_attempts,
    count(*)                                                               as total_raids,
    count(*) filter (where points_attacker > 0)                            as successful_raids
  from raid_events
  group by player_id, match_id, tenant_id, tournament_id
),
tackle_agg as (
  select
    player_id,
    match_id,
    tenant_id,
    tournament_id,
    -- Each participating defender gets 1 point per tackle (or 2 for super)
    count(*) filter (where type = 'tackle_point')                          as tackle_points,
    count(*) filter (where type = 'super_tackle' or is_super_tackle)       as super_tackles,
    count(*)                                                               as total_tackles_participated
  from tackle_events
  group by player_id, match_id, tenant_id, tournament_id
)
select
  coalesce(r.player_id, t.player_id)         as player_id,
  coalesce(r.match_id, t.match_id)           as match_id,
  coalesce(r.tenant_id, t.tenant_id)         as tenant_id,
  coalesce(r.tournament_id, t.tournament_id) as tournament_id,
  coalesce(r.raid_points, 0)                 as raid_points,
  coalesce(r.super_raids, 0)                 as super_raids,
  coalesce(r.bonus_points, 0)                as bonus_points,
  coalesce(r.empty_raids, 0)                 as empty_raids,
  coalesce(r.dod_conversions, 0)             as dod_conversions,
  coalesce(r.dod_attempts, 0)                as dod_attempts,
  coalesce(r.total_raids, 0)                 as total_raids,
  coalesce(r.successful_raids, 0)            as successful_raids,
  coalesce(t.tackle_points, 0)               as tackle_points,
  coalesce(t.super_tackles, 0)               as super_tackles,
  coalesce(t.total_tackles_participated, 0)  as total_tackles
from raid_agg r
full outer join tackle_agg t
  on r.player_id = t.player_id and r.match_id = t.match_id;

comment on view public.player_match_stats is
  'Per-player per-match aggregation derived from match_events. One row per (player, match) where the player either raided or participated in a tackle. Computed live — no maintenance.';

-- ---------------------------------------------------------------------
-- 2. player_season_stats — aggregated per (player, tournament)
-- ---------------------------------------------------------------------
create or replace view public.player_season_stats as
select
  pms.player_id,
  pms.tournament_id,
  pms.tenant_id,
  p.team_id,
  p.full_name,
  p.role,
  p.jersey_number,
  count(distinct pms.match_id)        as matches_played,
  sum(pms.raid_points)                as raid_points,
  sum(pms.tackle_points)              as tackle_points,
  sum(pms.bonus_points)               as bonus_points,
  sum(pms.super_raids)                as super_raids,
  sum(pms.super_tackles)              as super_tackles,
  sum(pms.empty_raids)                as empty_raids,
  sum(pms.dod_conversions)            as dod_conversions,
  sum(pms.dod_attempts)               as dod_attempts,
  sum(pms.total_raids)                as total_raids,
  sum(pms.successful_raids)           as successful_raids,
  sum(pms.total_tackles)              as total_tackles,
  -- Derived percentages, null-safe (avoid divide by zero)
  case when sum(pms.total_raids) > 0
       then round(100.0 * sum(pms.successful_raids)::numeric / sum(pms.total_raids), 1)
       else null
  end as raid_success_pct,
  case when sum(pms.dod_attempts) > 0
       then round(100.0 * sum(pms.dod_conversions)::numeric / sum(pms.dod_attempts), 1)
       else null
  end as dod_conversion_pct,
  -- Total points contributed (raid + tackle + bonus)
  sum(pms.raid_points + pms.tackle_points)  as total_points
from public.player_match_stats pms
join public.players p on p.id = pms.player_id
group by pms.player_id, pms.tournament_id, pms.tenant_id,
         p.team_id, p.full_name, p.role, p.jersey_number;

comment on view public.player_season_stats is
  'Per-player per-tournament aggregation. Joins player metadata so the rankings UI does not need a second query.';

-- ---------------------------------------------------------------------
-- 3. player_career_stats — aggregated per player across all tournaments
-- ---------------------------------------------------------------------
create or replace view public.player_career_stats as
select
  pms.player_id,
  p.tenant_id,                          -- the player's home tenant
  p.team_id,
  p.full_name,
  p.role,
  p.jersey_number,
  count(distinct pms.match_id)          as matches_played,
  count(distinct pms.tournament_id)     as tournaments_played,
  sum(pms.raid_points)                  as raid_points,
  sum(pms.tackle_points)                as tackle_points,
  sum(pms.bonus_points)                 as bonus_points,
  sum(pms.super_raids)                  as super_raids,
  sum(pms.super_tackles)                as super_tackles,
  sum(pms.empty_raids)                  as empty_raids,
  sum(pms.dod_conversions)              as dod_conversions,
  sum(pms.dod_attempts)                 as dod_attempts,
  sum(pms.total_raids)                  as total_raids,
  sum(pms.successful_raids)             as successful_raids,
  sum(pms.total_tackles)                as total_tackles,
  case when sum(pms.total_raids) > 0
       then round(100.0 * sum(pms.successful_raids)::numeric / sum(pms.total_raids), 1)
       else null
  end as raid_success_pct,
  case when sum(pms.dod_attempts) > 0
       then round(100.0 * sum(pms.dod_conversions)::numeric / sum(pms.dod_attempts), 1)
       else null
  end as dod_conversion_pct,
  sum(pms.raid_points + pms.tackle_points) as total_points
from public.player_match_stats pms
join public.players p on p.id = pms.player_id
group by pms.player_id, p.tenant_id, p.team_id, p.full_name, p.role, p.jersey_number;

comment on view public.player_career_stats is
  'Per-player aggregation across every tournament they have played. Powers the platform-wide leaderboard and the player profile page.';

-- ---------------------------------------------------------------------
-- 4. team_season_stats — aggregated per (team, tournament)
-- ---------------------------------------------------------------------
create or replace view public.team_season_stats as
with team_match_results as (
  select
    m.id                                                 as match_id,
    m.tournament_id,
    m.tenant_id,
    m.home_team_id                                       as team_id,
    m.home_score                                         as score_for,
    m.away_score                                         as score_against,
    case when m.home_score > m.away_score then 1 else 0 end as wins,
    case when m.home_score = m.away_score then 1 else 0 end as draws,
    case when m.home_score < m.away_score then 1 else 0 end as losses
  from public.matches m
  where m.status = 'completed'
  union all
  select
    m.id, m.tournament_id, m.tenant_id, m.away_team_id,
    m.away_score, m.home_score,
    case when m.away_score > m.home_score then 1 else 0 end,
    case when m.away_score = m.home_score then 1 else 0 end,
    case when m.away_score < m.home_score then 1 else 0 end
  from public.matches m
  where m.status = 'completed'
)
select
  tmr.team_id,
  tmr.tournament_id,
  tmr.tenant_id,
  t.name        as team_name,
  t.short_name,
  t.primary_color,
  count(*)                  as matches_played,
  sum(tmr.wins)             as wins,
  sum(tmr.draws)            as draws,
  sum(tmr.losses)           as losses,
  sum(tmr.score_for)        as points_for,
  sum(tmr.score_against)    as points_against,
  sum(tmr.score_for) - sum(tmr.score_against) as points_diff,
  -- League points: 5 per win, 3 per draw, 1 per loss within 7, 0 otherwise (PKL convention)
  sum(tmr.wins) * 5 + sum(tmr.draws) * 3 +
  sum(case when tmr.losses = 1 and (tmr.score_against - tmr.score_for) <= 7 then 1 else 0 end) as league_points
from team_match_results tmr
join public.teams t on t.id = tmr.team_id
group by tmr.team_id, tmr.tournament_id, tmr.tenant_id,
         t.name, t.short_name, t.primary_color;

comment on view public.team_season_stats is
  'Per-team per-tournament standings. Computes wins/draws/losses, points for/against, and PKL-style league points (W=5, D=3, narrow loss=1).';

-- ---------------------------------------------------------------------
-- 5. player_rankings — leaderboard with composite score + tier
-- ---------------------------------------------------------------------
-- The composite score weights different stats per role context. Tiers
-- are RELATIVE: top 10% = S, next 20% = A, next 30% = B, rest = C.
-- Players with < 3 matches are excluded so a single-match streak does
-- not top the leaderboard.

create or replace function public.player_ranking_score(
  p_role text,
  p_raid_points numeric,
  p_tackle_points numeric,
  p_bonus_points numeric,
  p_super_raids numeric,
  p_super_tackles numeric,
  p_empty_raids numeric,
  p_dod_conversions numeric
) returns numeric
language sql immutable as $$
  select case p_role
    -- Raiders: weighted toward attacking output
    when 'raider'           then p_raid_points + 2 * p_super_raids + 1.5 * p_dod_conversions - 0.3 * p_empty_raids
    -- Defenders: weighted toward tackling
    when 'defender_corner'  then p_tackle_points + 2 * p_super_tackles
    when 'defender_cover'   then p_tackle_points + 2 * p_super_tackles
    -- All-rounders: balanced
    when 'all_rounder'      then p_raid_points + p_tackle_points + p_bonus_points + 1.5 * p_super_raids + 1.5 * p_super_tackles
    -- Overall (any context): everything contributes
    else                         p_raid_points + p_tackle_points + p_bonus_points + 2 * p_super_raids + 2 * p_super_tackles + p_dod_conversions
  end;
$$;

create or replace view public.player_rankings_tournament as
with scored as (
  select
    pss.*,
    public.player_ranking_score(
      pss.role::text,
      pss.raid_points, pss.tackle_points, pss.bonus_points,
      pss.super_raids, pss.super_tackles,
      pss.empty_raids, pss.dod_conversions
    ) as composite_score
  from public.player_season_stats pss
  where pss.matches_played >= 3
),
ranked as (
  select
    *,
    row_number() over (
      partition by tournament_id, role
      order by composite_score desc, total_points desc, matches_played desc
    ) as rank,
    percent_rank() over (
      partition by tournament_id, role
      order by composite_score
    ) as percentile
  from scored
)
select
  player_id, tournament_id, tenant_id, team_id,
  full_name, role, jersey_number,
  matches_played, raid_points, tackle_points, bonus_points,
  super_raids, super_tackles, empty_raids,
  dod_conversions, dod_attempts, dod_conversion_pct,
  total_raids, successful_raids, raid_success_pct,
  total_tackles, total_points,
  composite_score,
  rank,
  case
    when percentile >= 0.90 then 'S'
    when percentile >= 0.70 then 'A'
    when percentile >= 0.40 then 'B'
    else                        'C'
  end as tier
from ranked;

comment on view public.player_rankings_tournament is
  'Per-tournament ranking within each role. Tiers are relative: top 10% = S, next 20% = A, next 30% = B, bottom 40% = C. Requires >=3 matches.';

create or replace view public.player_rankings_career as
with scored as (
  select
    pcs.*,
    public.player_ranking_score(
      pcs.role::text,
      pcs.raid_points, pcs.tackle_points, pcs.bonus_points,
      pcs.super_raids, pcs.super_tackles,
      pcs.empty_raids, pcs.dod_conversions
    ) as composite_score
  from public.player_career_stats pcs
  where pcs.matches_played >= 3
),
ranked as (
  select
    *,
    row_number() over (
      partition by role
      order by composite_score desc, total_points desc, matches_played desc
    ) as rank,
    percent_rank() over (
      partition by role
      order by composite_score
    ) as percentile
  from scored
)
select
  player_id, tenant_id, team_id,
  full_name, role, jersey_number,
  matches_played, tournaments_played,
  raid_points, tackle_points, bonus_points,
  super_raids, super_tackles, empty_raids,
  dod_conversions, dod_attempts, dod_conversion_pct,
  total_raids, successful_raids, raid_success_pct,
  total_tackles, total_points,
  composite_score,
  rank,
  case
    when percentile >= 0.90 then 'S'
    when percentile >= 0.70 then 'A'
    when percentile >= 0.40 then 'B'
    else                        'C'
  end as tier
from ranked;

comment on view public.player_rankings_career is
  'Platform-wide all-time ranking within each role. Same tiering rules as the per-tournament view.';

-- ---------------------------------------------------------------------
-- Grants — views inherit RLS from underlying tables (match_events,
-- matches, players are all publicly readable), so no explicit policies
-- needed. Just allow anon + authenticated to select.
-- ---------------------------------------------------------------------
grant select on public.player_match_stats        to anon, authenticated;
grant select on public.player_season_stats       to anon, authenticated;
grant select on public.player_career_stats       to anon, authenticated;
grant select on public.team_season_stats         to anon, authenticated;
grant select on public.player_rankings_tournament to anon, authenticated;
grant select on public.player_rankings_career    to anon, authenticated;
