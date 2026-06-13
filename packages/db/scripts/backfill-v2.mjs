import postgres from 'postgres';
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, ssl: 'require' });
try {
  // Candidates: scoring_version=1 matches that HAVE seeded player-state.
  // That's exactly the demo-seed bug case (lineups + state seeded, but the
  // lineup-lock flip to v2 was never run). Matches with no player_state are
  // left alone — the engine would have nothing to drive.
  const candidates = await sql`
    select m.id, m.status, m.home_score, m.away_score,
           (select count(*) from public.match_player_state s where s.match_id = m.id)::int as state_rows
    from public.matches m
    where m.scoring_version = 1
      and exists (select 1 from public.match_player_state s where s.match_id = m.id)
    order by m.updated_at desc`;

  console.log(`Found ${candidates.length} v1 match(es) with seeded player-state:`);
  for (const c of candidates) {
    console.log(`  ${c.id} | ${c.status} | ${c.home_score}-${c.away_score} | ${c.state_rows} state rows`);
  }
  if (candidates.length === 0) { console.log('Nothing to backfill.'); process.exit(0); }

  const { count } = await sql`
    update public.matches set scoring_version = 2
    where scoring_version = 1
      and exists (select 1 from public.match_player_state s where s.match_id = public.matches.id)`;
  console.log(`\n✓ Flipped ${count} match(es) to scoring_version = 2.`);
  console.log('Refresh any open scoring consoles — outs + the no-revival rule are now live.');
} catch (e) { console.error('FAILED:', e.message); process.exit(1); } finally { await sql.end(); }
