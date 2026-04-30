#!/usr/bin/env node
import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  const counts = await client`
    select
      (select count(*) from public.player_match_stats)        as match_stats,
      (select count(*) from public.player_season_stats)       as season_stats,
      (select count(*) from public.player_career_stats)       as career_stats,
      (select count(*) from public.team_season_stats)         as team_stats,
      (select count(*) from public.player_rankings_tournament) as tour_rankings,
      (select count(*) from public.player_rankings_career)     as career_rankings
  `;
  console.log('Row counts in each view:');
  console.table(counts[0]);

  const top = await client`
    select rank, full_name, role, tier, raid_points, tackle_points,
           total_points, matches_played
    from public.player_rankings_career
    order by rank
    limit 5
  `;
  console.log('\nTop 5 career rankings (all roles):');
  console.table(top);
} finally {
  await client.end();
}
