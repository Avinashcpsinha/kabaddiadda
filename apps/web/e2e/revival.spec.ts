import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env';

loadEnv();

/**
 * Revival regression: a successful raid must revive a previously-out
 * team-mate (FIFO) EXCEPT at full strength.
 *
 * This drives the live `maintain_player_state_after_event` trigger by
 * inserting match_events exactly the way the scoring console's `record()`
 * server action does (same columns), then asserting match_player_state.
 *
 * Reported bug: after a raider scores a touch, the FIFO revival does not
 * fire. Root cause is migration 0027 routing the attacking-team revival
 * through match_player_state_revive_one_prior_raid, which only revives an
 * out player when an OPPOSING raid sits strictly between that player's
 * out-event and the current event. In normal alternating play the out came
 * from the opponent's immediately-preceding raid, so nothing is "between"
 * and the player is wrongly skipped.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const tenantId = randomUUID();
const tournamentId = randomUUID();
const teamAId = randomUUID(); // home
const teamBId = randomUUID(); // away
// 7 starters per team.
const teamA = Array.from({ length: 7 }, () => randomUUID());
const teamB = Array.from({ length: 7 }, () => randomUUID());

// Deterministic, strictly-increasing event timestamps within a match.
const T0 = Date.parse('2026-06-13T10:00:00.000Z');
function at(seq: number) {
  return new Date(T0 + seq * 1000).toISOString();
}

test.beforeAll(async () => {
  await admin.from('tenants').insert({
    id: tenantId,
    slug: `e2e-revival-${tenantId.slice(0, 8)}`,
    name: 'E2E Revival',
    status: 'active',
    contact_email: 'e2e-revival@kabaddiadda.test',
    plan: 'pro',
    plan_status: 'active',
  });
  await admin.from('tournaments').insert({
    id: tournamentId,
    tenant_id: tenantId,
    slug: 'e2e-revival-cup',
    name: 'E2E Revival Cup',
    format: 'league',
    status: 'live',
    start_date: '2026-05-01',
    end_date: '2026-05-30',
  });
  await admin.from('teams').insert([
    { id: teamAId, tenant_id: tenantId, tournament_id: tournamentId, name: 'Team A', short_name: 'AAA', primary_color: '#ff5c1a' },
    { id: teamBId, tenant_id: tenantId, tournament_id: tournamentId, name: 'Team B', short_name: 'BBB', primary_color: '#1a7cff' },
  ]);
  await admin.from('players').insert([
    ...teamA.map((id, i) => ({ id, tenant_id: tenantId, team_id: teamAId, full_name: `A${i + 1}`, jersey_number: i + 1, role: 'all_rounder' })),
    ...teamB.map((id, i) => ({ id, tenant_id: tenantId, team_id: teamBId, full_name: `B${i + 1}`, jersey_number: i + 1, role: 'all_rounder' })),
  ]);
});

test.afterAll(async () => {
  // Tenant delete cascades to tournament/teams/players/matches/events/state.
  await admin.from('tenants').delete().eq('id', tenantId);
});

/** Create a fresh full-strength v2 match (7 on_mat per team). */
async function seedMatch(): Promise<string> {
  const matchId = randomUUID();
  await admin.from('matches').insert({
    id: matchId,
    tenant_id: tenantId,
    tournament_id: tournamentId,
    home_team_id: teamAId,
    away_team_id: teamBId,
    scheduled_at: new Date(T0).toISOString(),
    status: 'live',
    scoring_version: 2,
    home_score: 0,
    away_score: 0,
    current_half: 1,
    clock_seconds: 0,
  });
  await admin.from('match_player_state').insert([
    ...teamA.map((pid) => ({ tenant_id: tenantId, match_id: matchId, team_id: teamAId, player_id: pid, state: 'on_mat' })),
    ...teamB.map((pid) => ({ tenant_id: tenantId, match_id: matchId, team_id: teamBId, player_id: pid, state: 'on_mat' })),
  ]);
  return matchId;
}

/** Insert a raid_point touch event (same shape the console's record() uses). */
async function touch(
  matchId: string,
  attackingTeamId: string,
  raiderId: string,
  defenderId: string,
  seq: number,
) {
  const { error } = await admin.from('match_events').insert({
    tenant_id: tenantId,
    match_id: matchId,
    type: 'raid_point',
    half: 1,
    clock_seconds: 60 + seq,
    attacking_team_id: attackingTeamId,
    raider_id: raiderId,
    defender_ids: [defenderId],
    points_attacker: 1,
    points_defender: 0,
    created_at: at(seq),
  });
  if (error) throw new Error(`event insert failed: ${error.message}`);
}

async function onMatCount(matchId: string, teamId: string): Promise<number> {
  const { count, error } = await admin
    .from('match_player_state')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .eq('state', 'on_mat');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

test('successful raid revives a previously-out team-mate (FIFO)', async () => {
  const matchId = await seedMatch();

  // Raid 1 — Team B raids and touches A1. A1 goes OUT. B is at full
  // strength so B gets no revival (correct).
  await touch(matchId, teamBId, teamB[0], teamA[0], 1);
  expect(await onMatCount(matchId, teamAId), 'A is down a player after being touched out').toBe(6);
  expect(await onMatCount(matchId, teamBId), 'B revives nothing at full strength').toBe(7);

  // Raid 2 — Team A raids and touches B1. B1 goes OUT, AND A must revive
  // A1 (its only out player, FIFO). A should be back to 7.
  await touch(matchId, teamAId, teamA[1], teamB[0], 2);
  expect(await onMatCount(matchId, teamBId), 'B is down a player after being touched out').toBe(6);
  expect(await onMatCount(matchId, teamAId), 'A revives A1 on the successful raid').toBe(7);
});

test('no revival at full strength (control)', async () => {
  const matchId = await seedMatch();

  // Team A raids and touches B1 while A has nobody out. Nothing to revive.
  await touch(matchId, teamAId, teamA[0], teamB[0], 1);
  expect(await onMatCount(matchId, teamBId)).toBe(6);
  expect(await onMatCount(matchId, teamAId), 'A stays full — no phantom revival').toBe(7);
});
