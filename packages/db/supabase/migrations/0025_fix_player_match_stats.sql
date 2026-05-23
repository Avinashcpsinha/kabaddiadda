-- =====================================================================
-- 0025 — Fix player_match_stats view: super-tackle points and
-- bonus-in-combo credit for raiders.
--
-- Two bugs in 0013_stats_and_rankings.sql:
--
-- 1) tackle_points only counted regular tackles. A super tackle is worth
--    2 points to each participating defender (PKL convention, also stated
--    in the original inline comment) but the view did
--      count(*) filter (where type = 'tackle_point')
--    which excludes super tackles entirely. Result: defenders with super
--    tackles show 0 tackle_points and total_points (raid+tackle) is
--    under-reported by 2 × super_tackles.
--
--    Fix: sum (1 per regular tackle, 2 per super tackle).
--
-- 2) Bonus + Tackle and Bonus + Self-out combos are recorded as one
--    tackle_point event with points_attacker = 1 (the bonus) and
--    points_defender = 1 (the tackle/self-out). The raider's bonus
--    contribution was lost because the raid_events CTE filter excluded
--    tackle_point / super_tackle. Result: B+T / B+SO bonuses don't
--    show in the raider's raid_points or bonus_points.
--
--    Fix: include tackle_point / super_tackle events where
--    points_attacker > 0 in the raider's raid_events.
--
-- player_season_stats, player_career_stats, and the rankings views read
-- from player_match_stats so they update automatically.
-- =====================================================================

create or replace view public.player_match_stats as
with raid_events as (
  -- Events where this player was the raider.
  -- B+T / B+SO are stored as tackle_point with points_attacker = 1
  -- (the bonus crossing). The raider deserves credit for that bonus.
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
    and (
      e.type in ('raid_point', 'super_raid', 'bonus_point', 'empty_raid', 'do_or_die_raid')
      or (e.type in ('tackle_point', 'super_tackle') and coalesce(e.points_attacker, 0) > 0)
    )
),
tackle_events as (
  -- Each defender gets a row per tackle they participated in.
  -- PKL convention: regular tackle = 1 pt per defender, super = 2 pt per defender.
  select
    e.tenant_id,
    e.match_id,
    m.tournament_id,
    (jsonb_array_elements_text(e.defender_ids))::uuid as player_id,
    e.points_defender,
    e.type,
    e.is_super_tackle
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
    -- Sum of attacker points across every event the player raided —
    -- includes the +1 from B+T / B+SO bonus-in-combo events.
    sum(points_attacker) as raid_points,
    count(*) filter (where type = 'super_raid' or is_super_raid) as super_raids,
    -- Bonus_points counts every "bonus crossed" moment: standalone bonus
    -- AND the bonus inside B+T / B+SO combos.
    count(*) filter (
      where type = 'bonus_point'
        or (type in ('tackle_point', 'super_tackle') and points_attacker > 0)
    ) as bonus_points,
    count(*) filter (where type = 'empty_raid') as empty_raids,
    count(*) filter (where type = 'do_or_die_raid' and points_attacker > 0) as dod_conversions,
    count(*) filter (where type = 'do_or_die_raid') as dod_attempts,
    count(*) as total_raids,
    count(*) filter (where points_attacker > 0) as successful_raids
  from raid_events
  group by player_id, match_id, tenant_id, tournament_id
),
tackle_agg as (
  select
    player_id,
    match_id,
    tenant_id,
    tournament_id,
    -- ▼ THE FIX ▼ Each defender earns the FULL point value of the tackle:
    -- 1 for a regular tackle, 2 for a super tackle.
    sum(case
      when type = 'super_tackle' or is_super_tackle then 2
      when type = 'tackle_point' then 1
      else 0
    end) as tackle_points,
    count(*) filter (where type = 'super_tackle' or is_super_tackle) as super_tackles,
    count(*) as total_tackles_participated
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
  'Per-player per-match aggregation derived from match_events. tackle_points includes super-tackle bonus (1 reg + 2 super). raid_points credits the bonus inside B+T / B+SO combos to the raider.';
