import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TENANT_ID,
  DEMO_TOURNAMENT_ID,
  DEMO_TEAM_IDS,
  DEMO_TEAMS,
  DEMO_ROLES,
  DEMO_NAMES_BY_TEAM,
  DEMO_MATCH_LIVE_ID,
  DEMO_MATCH_SCHEDULED_ID,
} from './demo';

/**
 * Reset the demo tenant to a known-good seeded state.
 *
 * Idempotent: safe to call from a cron job or manually. Wipes the demo
 * tenant's matches/events/players/teams/tournaments and re-inserts the
 * canonical seed. Demo user + tenant rows themselves are preserved
 * (so any in-flight session keeps working — only their data resets).
 *
 * Used by /api/cron/reset-demo. Requires the service-role client, so
 * only call from server code with strict authorisation upstream.
 */
export async function reseedDemoTenant(): Promise<{
  teams: number;
  players: number;
  matches: number;
}> {
  const supabase = createAdminClient();

  // Make sure the auth user has the documented password (in case someone
  // changed it in the dashboard) and is confirmed.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 500,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  let userId: string;
  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Organiser', role: 'organiser' },
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  // Upsert tenant + profile so the org link stays correct.
  await supabase
    .from('tenants')
    .upsert(
      {
        id: DEMO_TENANT_ID,
        slug: 'kabaddiadda-demo',
        name: 'Kabaddiadda Demo League',
        status: 'active',
        owner_id: userId,
        contact_email: DEMO_EMAIL,
        plan: 'pro',
        plan_status: 'active',
      },
      { onConflict: 'id' },
    );
  await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: DEMO_EMAIL,
        full_name: 'Demo Organiser',
        role: 'organiser',
        tenant_id: DEMO_TENANT_ID,
      },
      { onConflict: 'id' },
    );

  // Wipe demo tenant content. Order matters where there's no CASCADE FK.
  for (const t of ['match_events', 'matches', 'players', 'teams', 'tournaments']) {
    const { error } = await supabase.from(t).delete().eq('tenant_id', DEMO_TENANT_ID);
    if (error) throw error;
  }

  // Re-insert seed.
  await supabase.from('tournaments').insert({
    id: DEMO_TOURNAMENT_ID,
    tenant_id: DEMO_TENANT_ID,
    slug: 'demo-cup',
    name: 'Demo Cup 2026',
    description:
      'A sandbox tournament — score real matches, edit teams, try every feature. Resets nightly.',
    format: 'league',
    status: 'live',
    start_date: '2026-05-01',
    end_date: '2026-05-30',
  });

  await supabase.from('teams').insert(
    DEMO_TEAMS.map((t) => ({
      id: t.id,
      tenant_id: DEMO_TENANT_ID,
      tournament_id: DEMO_TOURNAMENT_ID,
      name: t.name,
      short_name: t.short_name,
      city: t.city,
      primary_color: t.primary_color,
    })),
  );

  const players = DEMO_TEAMS.flatMap((team, ti) =>
    DEMO_NAMES_BY_TEAM[team.short_name].map((name, pi) => ({
      id: `d0000000-0000-0000-0000-1${ti}${String(pi).padStart(10, '0')}`,
      tenant_id: DEMO_TENANT_ID,
      team_id: team.id,
      full_name: name,
      jersey_number: pi + 1,
      role: DEMO_ROLES[pi],
      is_captain: pi === 0,
    })),
  );
  await supabase.from('players').insert(players);

  const liveScheduledAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const futureScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('matches').insert([
    {
      id: DEMO_MATCH_LIVE_ID,
      tenant_id: DEMO_TENANT_ID,
      tournament_id: DEMO_TOURNAMENT_ID,
      home_team_id: DEMO_TEAM_IDS[0],
      away_team_id: DEMO_TEAM_IDS[1],
      scheduled_at: liveScheduledAt,
      status: 'live',
      home_score: 14,
      away_score: 12,
      current_half: 1,
      clock_seconds: 600,
      round: 'League · Round 1',
    },
    {
      id: DEMO_MATCH_SCHEDULED_ID,
      tenant_id: DEMO_TENANT_ID,
      tournament_id: DEMO_TOURNAMENT_ID,
      home_team_id: DEMO_TEAM_IDS[2],
      away_team_id: DEMO_TEAM_IDS[3],
      scheduled_at: futureScheduledAt,
      status: 'scheduled',
      home_score: 0,
      away_score: 0,
      current_half: 1,
      clock_seconds: 0,
      round: 'League · Round 1',
    },
  ]);

  return {
    teams: DEMO_TEAMS.length,
    players: players.length,
    matches: 2,
  };
}
