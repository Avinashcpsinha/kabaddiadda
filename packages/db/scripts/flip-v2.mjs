import postgres from 'postgres';
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, ssl: 'require' });
const id = process.argv[2];
if (!id) { console.error('Usage: flip-v2.mjs <matchId>'); process.exit(1); }
try {
  const [before] = await sql`select scoring_version, home_team_id, away_team_id from public.matches where id = ${id}`;
  if (!before) { console.error('No match with that id'); process.exit(1); }
  const stateRows = await sql`select count(*)::int n from public.match_player_state where match_id = ${id}`;
  console.log(`before: scoring_version=${before.scoring_version}, player_state rows=${stateRows[0].n}`);
  if (stateRows[0].n === 0) {
    console.error('⚠ No match_player_state seeded for this match. Lock the lineup in the UI instead (it seeds state + sets v2).');
    process.exit(1);
  }
  await sql`update public.matches set scoring_version = 2 where id = ${id}`;
  const counts = await sql`select team_id, state, count(*)::int n from public.match_player_state where match_id=${id} group by team_id, state order by team_id, state`;
  console.log('✓ scoring_version set to 2. Current on-mat/out state:');
  for (const c of counts) {
    const side = c.team_id === before.home_team_id ? 'HOME' : c.team_id === before.away_team_id ? 'AWAY' : '?';
    console.log(`  ${side} ${c.state.padEnd(10)} ${c.n}`);
  }
  console.log('\nRefresh the scoring console; outs + the no-revival rule are now live for this match.');
} catch (e) { console.error(e.message); process.exit(1); } finally { await sql.end(); }
