#!/usr/bin/env node
/**
 * Set up (or reset) the demo organiser account + seeded league.
 *
 * Idempotent: runs identically whether the demo data is fresh, partially
 * populated, or trashed. Wipes and reseeds the demo tenant on every run.
 *
 * Uses the Supabase Auth admin REST API for the demo user (since hashed
 * passwords can't be written via plain SQL) and a direct Postgres
 * connection for everything else.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/setup-demo.mjs
 */

import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

export const DEMO_EMAIL = 'demo@kabaddiadda.in';
export const DEMO_PASSWORD = 'KabaddiDemo2026!'; // deliberately public

// Stable UUIDs so every reset produces identical IDs (URLs stay valid).
const DEMO_TENANT_ID = 'd0000000-0000-0000-0000-000000000001';
const DEMO_TOURNAMENT_ID = 'd0000000-0000-0000-0000-000000000002';
const TEAM_IDS = [
  'd0000000-0000-0000-0000-00000000000a',
  'd0000000-0000-0000-0000-00000000000b',
  'd0000000-0000-0000-0000-00000000000c',
  'd0000000-0000-0000-0000-00000000000d',
];
const MATCH_LIVE_ID = 'd0000000-0000-0000-0000-0000000000a1';
const MATCH_SCHEDULED_ID = 'd0000000-0000-0000-0000-0000000000a2';

const TEAMS = [
  { id: TEAM_IDS[0], name: 'Bengaluru Bulls', short_name: 'BLR', city: 'Bengaluru', primary_color: '#f97316' },
  { id: TEAM_IDS[1], name: 'Chennai Chargers', short_name: 'CHE', city: 'Chennai', primary_color: '#0ea5e9' },
  { id: TEAM_IDS[2], name: 'Delhi Dynamos', short_name: 'DEL', city: 'Delhi', primary_color: '#22c55e' },
  { id: TEAM_IDS[3], name: 'Mumbai Mavericks', short_name: 'MUM', city: 'Mumbai', primary_color: '#a855f7' },
];

const ROLES = ['raider', 'raider', 'all_rounder', 'all_rounder', 'defender_corner', 'defender_corner', 'defender_cover', 'defender_cover'];
const NAMES_BY_TEAM = {
  BLR: ['Arjun Singh', 'Vikram Rao', 'Suresh Kumar', 'Rahul Joshi', 'Manoj Sharma', 'Ramesh Patel', 'Karan Mehra', 'Aakash Iyer'],
  CHE: ['Senthil Murugan', 'Karthik Reddy', 'Ganesh Iyer', 'Bharath Kumar', 'Praveen Raj', 'Sanjay Pillai', 'Vinod Krishnan', 'Suresh Babu'],
  DEL: ['Harpreet Singh', 'Amit Verma', 'Rohit Yadav', 'Deepak Tomar', 'Yashpal Gill', 'Nitin Kumar', 'Ashok Rana', 'Sumit Malik'],
  MUM: ['Pratik Shinde', 'Yash Patil', 'Rohan Desai', 'Tushar Joshi', 'Sandeep Kale', 'Mahesh Kadam', 'Vinit Naik', 'Sachin Pawar'],
};

const playerIdFor = (teamIndex, playerIndex) =>
  `d0000000-0000-0000-0000-1${teamIndex}${String(playerIndex).padStart(10, '0')}`;

async function authAdmin(method, path, body) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Auth admin ${method} ${path} → ${res.status}: ${text}`);
  }
  return json;
}

async function ensureDemoUser() {
  // List existing users and look for the demo email.
  const list = await authAdmin('GET', 'users?per_page=500');
  const existing = (list.users ?? []).find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (existing) {
    await authAdmin('PUT', `users/${existing.id}`, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Organiser', role: 'organiser' },
    });
    return existing.id;
  }
  const created = await authAdmin('POST', 'users', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Demo Organiser', role: 'organiser' },
  });
  return created.id;
}

export async function seedDemo() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  const userId = await ensureDemoUser();
  console.log(`✓ Demo user ready: ${DEMO_EMAIL} (${userId.slice(0, 8)}…)`);

  const sql = postgres(url, { prepare: false, ssl: 'require' });

  try {
    // Upsert tenant
    await sql`
      insert into public.tenants (id, slug, name, status, owner_id, contact_email, plan, plan_status)
      values (${DEMO_TENANT_ID}, 'kabaddiadda-demo', 'Kabaddiadda Demo League', 'active',
              ${userId}, ${DEMO_EMAIL}, 'pro', 'active')
      on conflict (id) do update set
        slug = excluded.slug,
        name = excluded.name,
        status = excluded.status,
        owner_id = excluded.owner_id,
        contact_email = excluded.contact_email,
        plan = excluded.plan,
        plan_status = excluded.plan_status
    `;

    // Upsert profile pointing to demo tenant
    await sql`
      insert into public.profiles (id, email, full_name, role, tenant_id)
      values (${userId}, ${DEMO_EMAIL}, 'Demo Organiser', 'organiser', ${DEMO_TENANT_ID})
      on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        role = 'organiser',
        tenant_id = excluded.tenant_id
    `;

    // Wipe demo tenant data. Order matters where children reference parents.
    await sql`delete from public.match_events where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.match_player_state where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.match_lineups where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.matches where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.players where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.teams where tenant_id = ${DEMO_TENANT_ID}`;
    await sql`delete from public.tournaments where tenant_id = ${DEMO_TENANT_ID}`;

    // Tournament
    await sql`
      insert into public.tournaments (id, tenant_id, slug, name, description, format, status, start_date, end_date)
      values (${DEMO_TOURNAMENT_ID}, ${DEMO_TENANT_ID}, 'demo-cup', 'Demo Cup 2026',
              'A sandbox tournament — score real matches, edit teams, try every feature. Resets nightly.',
              'league', 'live', '2026-05-01', '2026-05-30')
    `;

    // Teams
    for (const t of TEAMS) {
      await sql`
        insert into public.teams (id, tenant_id, tournament_id, name, short_name, city, primary_color)
        values (${t.id}, ${DEMO_TENANT_ID}, ${DEMO_TOURNAMENT_ID}, ${t.name}, ${t.short_name}, ${t.city}, ${t.primary_color})
      `;
    }

    // Players
    let playerCount = 0;
    for (let ti = 0; ti < TEAMS.length; ti++) {
      const team = TEAMS[ti];
      const names = NAMES_BY_TEAM[team.short_name];
      for (let pi = 0; pi < names.length; pi++) {
        const id = playerIdFor(ti, pi);
        await sql`
          insert into public.players (id, tenant_id, team_id, full_name, jersey_number, role, is_captain)
          values (${id}, ${DEMO_TENANT_ID}, ${team.id}, ${names[pi]}, ${pi + 1}, ${ROLES[pi]}, ${pi === 0})
        `;
        playerCount++;
      }
    }

    // Matches — one live (Q1, 14-12 at 10:00) and one scheduled tomorrow.
    const liveScheduledAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const futureScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sql`
      insert into public.matches (id, tenant_id, tournament_id, home_team_id, away_team_id,
                                  scheduled_at, status, home_score, away_score, current_half, clock_seconds, round)
      values
        (${MATCH_LIVE_ID}, ${DEMO_TENANT_ID}, ${DEMO_TOURNAMENT_ID},
         ${TEAM_IDS[0]}, ${TEAM_IDS[1]}, ${liveScheduledAt}, 'live', 14, 12, 1, 600, 'League · Round 1'),
        (${MATCH_SCHEDULED_ID}, ${DEMO_TENANT_ID}, ${DEMO_TOURNAMENT_ID},
         ${TEAM_IDS[2]}, ${TEAM_IDS[3]}, ${futureScheduledAt}, 'scheduled', 0, 0, 1, 0, 'League · Round 1')
    `;

    // Lineups + on-mat state for the LIVE match. First 7 players start, 8th
    // sits on the bench. Without this the scoring console shows "no on-mat
    // lineup" even though the match status is 'live'.
    const homePlayerIds = Array.from({ length: 8 }, (_, i) => playerIdFor(0, i));
    const awayPlayerIds = Array.from({ length: 8 }, (_, i) => playerIdFor(1, i));
    const lockedAt = new Date().toISOString();

    await sql`
      insert into public.match_lineups
        (tenant_id, match_id, team_id, starting_player_ids, bench_player_ids, captain_id, locked_at)
      values
        (${DEMO_TENANT_ID}, ${MATCH_LIVE_ID}, ${TEAM_IDS[0]},
         ${sql.json(homePlayerIds.slice(0, 7))}, ${sql.json(homePlayerIds.slice(7))},
         ${homePlayerIds[0]}, ${lockedAt}),
        (${DEMO_TENANT_ID}, ${MATCH_LIVE_ID}, ${TEAM_IDS[1]},
         ${sql.json(awayPlayerIds.slice(0, 7))}, ${sql.json(awayPlayerIds.slice(7))},
         ${awayPlayerIds[0]}, ${lockedAt})
    `;

    // match_player_state — 7 'on_mat' + 1 'bench' per team.
    for (let i = 0; i < 8; i++) {
      const state = i < 7 ? 'on_mat' : 'bench';
      await sql`
        insert into public.match_player_state (tenant_id, match_id, team_id, player_id, state)
        values (${DEMO_TENANT_ID}, ${MATCH_LIVE_ID}, ${TEAM_IDS[0]}, ${homePlayerIds[i]}, ${state}),
               (${DEMO_TENANT_ID}, ${MATCH_LIVE_ID}, ${TEAM_IDS[1]}, ${awayPlayerIds[i]}, ${state})
      `;
    }

    console.log(`✓ Tenant ready: kabaddiadda-demo`);
    console.log(`✓ Seeded ${TEAMS.length} teams, ${playerCount} players, 2 matches (1 live with lineups)`);
    console.log(`✓ Live match URL: /organiser/tournaments/${DEMO_TOURNAMENT_ID}/matches/${MATCH_LIVE_ID}/scoring`);

    return {
      demoUserId: userId,
      tenantId: DEMO_TENANT_ID,
      tournamentId: DEMO_TOURNAMENT_ID,
      liveMatchId: MATCH_LIVE_ID,
    };
  } finally {
    await sql.end();
  }
}

// CLI entry — Windows-safe path comparison via fileURLToPath.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await seedDemo();
    console.log('\n✓ Demo setup complete.');
  } catch (err) {
    console.error('✗ Setup failed:', err.message);
    process.exit(1);
  }
}
