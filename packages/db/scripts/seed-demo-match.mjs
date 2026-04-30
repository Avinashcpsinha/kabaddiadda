#!/usr/bin/env node
/**
 * Idempotently provisions a tournament + 2 teams + 1 match in the demo-league
 * tenant, then resets the match to a clean scheduled/0-0 state. Used to set
 * the stage for the live-scoring walkthrough.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/seed-demo-match.mjs
 */

import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING or DATABASE_URL must be set');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, ssl: 'require' });

try {
  // 1. Find the demo-league tenant.
  const tenants = await sql`
    select id, name from public.tenants where slug = 'demo-league' limit 1
  `;
  if (tenants.length === 0) {
    console.error('✗ No `demo-league` tenant. Sign in once as Organiser via dev quick-login first.');
    process.exit(1);
  }
  const tenant = tenants[0];
  console.log(`✓ tenant: ${tenant.name}`);

  // 2. Upsert tournament.
  const tournaments = await sql`
    insert into public.tournaments (tenant_id, slug, name, description, format, status)
    values (
      ${tenant.id}, 'live-demo', 'Live Scoring Demo',
      'Auto-generated tournament for the live-scoring walkthrough.',
      'league', 'live'
    )
    on conflict (tenant_id, slug) do update
      set name = excluded.name, status = 'live'
    returning id
  `;
  const tournamentId = tournaments[0].id;
  console.log(`✓ tournament ready`);

  // 3. Two teams. No unique constraint on (tournament_id, name), so look-up first.
  async function ensureTeam(name, shortName, color) {
    const existing = await sql`
      select id from public.teams
      where tournament_id = ${tournamentId} and name = ${name}
      limit 1
    `;
    if (existing.length > 0) return existing[0].id;

    const created = await sql`
      insert into public.teams (tenant_id, tournament_id, name, short_name, primary_color)
      values (${tenant.id}, ${tournamentId}, ${name}, ${shortName}, ${color})
      returning id
    `;
    return created[0].id;
  }

  const homeId = await ensureTeam('Bengal Tigers', 'BEN', '#f97316');
  const awayId = await ensureTeam('Mumbai Mavericks', 'MUM', '#3b82f6');
  console.log(`✓ teams ready`);

  // 4. Ensure a match between them.
  let matchRows = await sql`
    select id from public.matches
    where tournament_id = ${tournamentId}
      and home_team_id = ${homeId}
      and away_team_id = ${awayId}
    limit 1
  `;

  let matchId;
  if (matchRows.length === 0) {
    const created = await sql`
      insert into public.matches (
        tenant_id, tournament_id, home_team_id, away_team_id,
        scheduled_at, status, round
      ) values (
        ${tenant.id}, ${tournamentId}, ${homeId}, ${awayId},
        now(), 'scheduled', 'Demo · Match 1'
      )
      returning id
    `;
    matchId = created[0].id;
  } else {
    matchId = matchRows[0].id;
  }

  // 5. RESET match to a clean state for the demo.
  await sql`delete from public.match_events where match_id = ${matchId}`;
  await sql`
    update public.matches set
      status = 'scheduled',
      home_score = 0, away_score = 0,
      current_half = 1, clock_seconds = 0
    where id = ${matchId}
  `;

  console.log(`✓ match reset to 0–0, scheduled`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WINDOW A — SCORING CONSOLE (organiser, requires sign-in)');
  console.log(
    `  http://localhost:3001/organiser/tournaments/${tournamentId}/matches/${matchId}/scoring`,
  );
  console.log('');
  console.log('  WINDOW B — PUBLIC LIVE PAGE (no auth needed)');
  console.log(`  http://localhost:3001/live/${matchId}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Single-line JSON for tooling.
  console.log(
    JSON.stringify({
      matchId,
      tournamentId,
      orgUrl: `http://localhost:3001/organiser/tournaments/${tournamentId}/matches/${matchId}/scoring`,
      pubUrl: `http://localhost:3001/live/${matchId}`,
    }),
  );
} finally {
  await sql.end();
}
