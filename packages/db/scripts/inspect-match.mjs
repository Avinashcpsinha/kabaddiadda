#!/usr/bin/env node
/**
 * Inspect a single match — dumps teams, score, recent events with
 * raider/defender names, and current match_player_state. Use to verify
 * trigger behavior against the event log.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/inspect-match.mjs <match_id>
 */
import postgres from 'postgres';

const matchId = process.argv[2];
if (!matchId) {
  console.error('Usage: inspect-match.mjs <match_id>');
  process.exit(1);
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING (or DATABASE_URL) must be set');
  process.exit(1);
}

const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  const [match] = await client`
    select m.id, m.status, m.current_half, m.clock_seconds, m.current_raider_id,
           m.home_score, m.away_score,
           m.home_team_id, m.away_team_id,
           ht.name as home_name, ht.short_name as home_short,
           at.name as away_name, at.short_name as away_short
    from public.matches m
    left join public.teams ht on ht.id = m.home_team_id
    left join public.teams at on at.id = m.away_team_id
    where m.id = ${matchId}
  `;

  if (!match) {
    console.error(`Match ${matchId} not found`);
    process.exit(1);
  }

  console.log(`\n=== MATCH ${matchId} ===`);
  console.log(`Status: ${match.status} · Half ${match.current_half} · Clock ${match.clock_seconds}s`);
  console.log(`Score: ${match.home_short || match.home_name} ${match.home_score} – ${match.away_score} ${match.away_short || match.away_name}`);

  const events = await client`
    select e.id, e.type, e.attacking_team_id, e.points_attacker, e.points_defender,
           e.half, e.clock_seconds, e.raider_id, e.defender_ids, e.details, e.created_at,
           rp.full_name as raider_name, rp.jersey_number as raider_jersey
    from public.match_events e
    left join public.players rp on rp.id = e.raider_id
    where e.match_id = ${matchId}
    order by e.created_at asc, e.id asc
  `;

  console.log(`\n=== EVENTS (${events.length} total) ===`);
  for (const e of events) {
    const side = e.attacking_team_id === match.home_team_id ? match.home_short || 'HOM' : match.away_team_id === e.attacking_team_id ? match.away_short || 'AWY' : '---';
    const reason = e.details?.reason ?? '';
    const score = `+${e.points_attacker}/${e.points_defender}`;
    const raider = e.raider_name ? `${e.raider_name}${e.raider_jersey != null ? ' #' + e.raider_jersey : ''}` : '-';
    const defenders = Array.isArray(e.defender_ids) ? e.defender_ids.length : 0;
    console.log(
      `  Q${e.half} ${String(Math.floor(e.clock_seconds / 60)).padStart(2, '0')}:${String(e.clock_seconds % 60).padStart(2, '0')}  ${side.padEnd(4)} ${e.type.padEnd(16)} ${score.padEnd(8)} r=${raider.padEnd(20)} d=${defenders}  ${reason}`,
    );
  }

  const state = await client`
    select ps.team_id, ps.player_id, ps.state, ps.out_seq, ps.last_event_id,
           p.full_name, p.jersey_number,
           t.short_name as team_short, t.name as team_name
    from public.match_player_state ps
    join public.players p on p.id = ps.player_id
    join public.teams t on t.id = ps.team_id
    where ps.match_id = ${matchId}
    order by t.id, ps.state, ps.out_seq nulls last, p.jersey_number
  `;

  console.log(`\n=== PLAYER STATE ===`);
  const byTeam = new Map();
  for (const r of state) {
    const k = r.team_short || r.team_name;
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k).push(r);
  }
  for (const [team, rows] of byTeam) {
    console.log(`\n  ${team}:`);
    const states = ['on_mat', 'out', 'bench', 'suspended', 'red_carded', 'injured'];
    for (const s of states) {
      const ofState = rows.filter((r) => r.state === s);
      if (ofState.length === 0) continue;
      console.log(`    ${s} (${ofState.length}): ${ofState.map((r) => `${r.full_name}${r.jersey_number != null ? '#' + r.jersey_number : ''}${r.out_seq != null ? ' [seq=' + r.out_seq + ']' : ''}`).join(', ')}`);
    }
  }

  // For each out player, show the outing event so we can verify the same-raid filter
  const outRows = state.filter((r) => r.state === 'out');
  if (outRows.length > 0) {
    console.log(`\n=== OUT-QUEUE → OUTING EVENT (for same-raid filter verification) ===`);
    for (const r of outRows) {
      const [oe] = await client`
        select id, type, raider_id, half, clock_seconds, details from public.match_events where id = ${r.last_event_id}
      `;
      const oeRaider = oe?.raider_id ?? '-';
      console.log(`  ${(r.team_short || r.team_name).padEnd(6)} ${r.full_name.padEnd(20)} seq=${r.out_seq}  outed by event type=${oe?.type ?? '?'} raider=${oeRaider}  Q${oe?.half ?? '?'} ${oe?.clock_seconds ?? '?'}s`);
    }
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
