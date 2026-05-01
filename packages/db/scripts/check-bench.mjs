#!/usr/bin/env node
import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});
try {
  const live = await sql`
    select
      m.id as match_id,
      count(*) filter (where mps.state = 'on_mat')   as on_mat,
      count(*) filter (where mps.state = 'bench')    as bench,
      count(*) filter (where mps.state = 'out')      as out,
      count(*)                                       as total
    from public.matches m
    join public.match_player_state mps on mps.match_id = m.id
    where m.status = 'live'
    group by m.id
  `;
  console.log('Live matches — player state distribution:');
  console.table(live);
} finally {
  await sql.end();
}
