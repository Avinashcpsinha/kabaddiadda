import 'server-only';

import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_EMAIL_PREFIX,
  DEMO_NAMES_BY_TEAM,
  DEMO_ROLES,
  DEMO_SESSION_TTL_HOURS,
  DEMO_TEAMS,
} from './demo';

export interface DemoSession {
  email: string;
  password: string;
  liveMatchPath: string;
}

/**
 * Provision a fresh, isolated demo organiser session.
 *
 * Each call creates:
 *   - A unique auth user `demo-<8 hex>@kabaddiadda.in` (random strong password)
 *   - A unique tenant linked to that user
 *   - Seeded data: 1 tournament, 4 teams, 32 players, 1 live match with
 *     full lineups + on-mat state, 1 scheduled match
 *
 * The returned email + password are used by the homepage server action to
 * sign the visitor in. Cleanup of expired sessions happens nightly via
 * /api/cron/reset-demo.
 *
 * Run-time at low concurrency: ~1.5-2 seconds per call (12 supabase round
 * trips, dominated by auth.admin.createUser + the player batch insert).
 */
export async function createDemoSession(): Promise<DemoSession> {
  const supabase = createAdminClient();

  // Identifiers — generate fresh per session so concurrent visitors are
  // fully isolated at the database level by RLS on tenant_id.
  const shortId = randomUUID().replace(/-/g, '').slice(0, 8);
  const email = `${DEMO_EMAIL_PREFIX}${shortId}@${DEMO_EMAIL_DOMAIN}`;
  // Strong random password; visitor never sees it — server action knows it
  // for ~1 second between createUser and signInWithPassword.
  const password = randomUUID() + randomUUID();

  const tenantId = randomUUID();
  const tournamentId = randomUUID();
  const liveMatchId = randomUUID();
  const scheduledMatchId = randomUUID();

  // 1) Auth user
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Demo Visitor',
      role: 'organiser',
      demo: true,
    },
  });
  if (createErr) throw createErr;
  const userId = created.user!.id;

  // 2) Tenant
  await supabase.from('tenants').insert({
    id: tenantId,
    slug: `demo-${shortId}`,
    name: 'Your Demo League',
    status: 'active',
    owner_id: userId,
    contact_email: email,
    plan: 'pro',
    plan_status: 'active',
  });

  // 3) Profile points to demo tenant
  await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: 'Demo Visitor',
      role: 'organiser',
      tenant_id: tenantId,
    },
    { onConflict: 'id' },
  );

  // 4) Tournament
  await supabase.from('tournaments').insert({
    id: tournamentId,
    tenant_id: tenantId,
    slug: 'demo-cup',
    name: 'Demo Cup 2026',
    description: 'Your private sandbox — score real matches, edit teams, try every feature. Auto-cleans after 24 hours.',
    format: 'league',
    status: 'live',
    start_date: '2026-05-01',
    end_date: '2026-05-30',
  });

  // 5) Compose teams + players up front so all downstream IDs are typed
  //    `string` rather than `string | undefined` from indexed array access.
  const teams = DEMO_TEAMS.map((t) => {
    const names = DEMO_NAMES_BY_TEAM[t.short_name] ?? [];
    return {
      id: randomUUID(),
      name: t.name,
      short_name: t.short_name,
      city: t.city,
      primary_color: t.primary_color,
      playerIds: names.map(() => randomUUID()),
      playerNames: names,
    };
  });
  const [homeTeam, awayTeam, schedHome, schedAway] = teams as [
    (typeof teams)[number],
    (typeof teams)[number],
    (typeof teams)[number],
    (typeof teams)[number],
  ];

  await supabase.from('teams').insert(
    teams.map((t) => ({
      id: t.id,
      tenant_id: tenantId,
      tournament_id: tournamentId,
      name: t.name,
      short_name: t.short_name,
      city: t.city,
      primary_color: t.primary_color,
    })),
  );

  // 6) Players — 8 per team, single batched insert
  const playerRows = teams.flatMap((team) =>
    team.playerNames.map((name, pi) => ({
      id: team.playerIds[pi]!,
      tenant_id: tenantId,
      team_id: team.id,
      full_name: name,
      jersey_number: pi + 1,
      role: DEMO_ROLES[pi] ?? 'all_rounder',
      is_captain: pi === 0,
    })),
  );
  await supabase.from('players').insert(playerRows);

  // 7) Matches — one live (Q1, 14-12 at 10:00 on the clock) and one scheduled.
  const liveScheduledAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const futureScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('matches').insert([
    {
      id: liveMatchId,
      tenant_id: tenantId,
      tournament_id: tournamentId,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      scheduled_at: liveScheduledAt,
      status: 'live',
      // Full-rules engine ON. The demo seeds lineups + match_player_state
      // below but never runs the lineup-lock flow that flips a match to
      // scoring_version 2, so without this the out/revival/all-out engine
      // (and the no-revival-at-full-strength rule) stays disabled. Setting
      // it here activates the trigger for the seeded live match.
      scoring_version: 2,
      home_score: 14,
      away_score: 12,
      current_half: 1,
      clock_seconds: 600,
      round: 'League · Round 1',
    },
    {
      id: scheduledMatchId,
      tenant_id: tenantId,
      tournament_id: tournamentId,
      home_team_id: schedHome.id,
      away_team_id: schedAway.id,
      scheduled_at: futureScheduledAt,
      status: 'scheduled',
      // Keep the column set identical to the live match above — Supabase
      // bulk insert requires every row in the array to have the same keys,
      // or the whole insert fails (silently here, which 404'd the demo).
      // This match stays v1; locking its lineup later flips it to v2.
      scoring_version: 1,
      home_score: 0,
      away_score: 0,
      current_half: 1,
      clock_seconds: 0,
      round: 'League · Round 1',
    },
  ]);

  // 8) Lineups + on-mat state for the live match (7 start, 1 bench per team).
  const lockedAt = new Date().toISOString();
  await supabase.from('match_lineups').insert([
    {
      tenant_id: tenantId,
      match_id: liveMatchId,
      team_id: homeTeam.id,
      starting_player_ids: homeTeam.playerIds.slice(0, 7),
      bench_player_ids: homeTeam.playerIds.slice(7),
      captain_id: homeTeam.playerIds[0],
      locked_at: lockedAt,
    },
    {
      tenant_id: tenantId,
      match_id: liveMatchId,
      team_id: awayTeam.id,
      starting_player_ids: awayTeam.playerIds.slice(0, 7),
      bench_player_ids: awayTeam.playerIds.slice(7),
      captain_id: awayTeam.playerIds[0],
      locked_at: lockedAt,
    },
  ]);

  await supabase.from('match_player_state').insert([
    ...homeTeam.playerIds.map((pid, i) => ({
      tenant_id: tenantId,
      match_id: liveMatchId,
      team_id: homeTeam.id,
      player_id: pid,
      state: i < 7 ? 'on_mat' : 'bench',
    })),
    ...awayTeam.playerIds.map((pid, i) => ({
      tenant_id: tenantId,
      match_id: liveMatchId,
      team_id: awayTeam.id,
      player_id: pid,
      state: i < 7 ? 'on_mat' : 'bench',
    })),
  ]);

  return {
    email,
    password,
    liveMatchPath: `/organiser/tournaments/${tournamentId}/matches/${liveMatchId}/scoring`,
  };
}

/**
 * Delete demo accounts (and their cascade-linked tenants/data) older than
 * DEMO_SESSION_TTL_HOURS. Called by /api/cron/reset-demo nightly. Idempotent.
 */
export async function cleanupExpiredDemoSessions(): Promise<{
  scanned: number;
  deleted: number;
}> {
  const supabase = createAdminClient();
  const cutoff = Date.now() - DEMO_SESSION_TTL_HOURS * 60 * 60 * 1000;

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 500,
  });
  if (listErr) throw listErr;

  const candidates = list.users.filter((u) => {
    if (!u.email?.startsWith(DEMO_EMAIL_PREFIX)) return false;
    if (!u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) return false;
    if (!u.created_at) return false;
    return new Date(u.created_at).getTime() < cutoff;
  });

  let deleted = 0;
  for (const user of candidates) {
    // Tenant data cascades on tenant delete via FK ON DELETE CASCADE in 0001.
    const { error: tenantErr } = await supabase
      .from('tenants')
      .delete()
      .eq('owner_id', user.id);
    if (tenantErr) {
      console.error(`Failed to delete tenant for ${user.email}:`, tenantErr.message);
      continue;
    }
    // Then the profile (no cascade from auth.users to profiles; we trigger
    // it manually so cleanup is fully idempotent even if the trigger lagged).
    await supabase.from('profiles').delete().eq('id', user.id);

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`Failed to delete user ${user.email}:`, delErr.message);
      continue;
    }
    deleted++;
  }

  return { scanned: candidates.length, deleted };
}
