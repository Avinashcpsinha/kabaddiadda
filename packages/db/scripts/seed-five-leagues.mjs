#!/usr/bin/env node
/**
 * End-to-end seed: 5 organisers, 50 teams, 500 players, 50 matches.
 *
 * Per organiser: 1 tenant, 1 tournament, 10 teams × 10 players, 10 matches
 * (5 completed, 1 live, 4 scheduled). Completed matches get realistic
 * match_events that sum to the final score; the live match also gets a
 * partial event log + initialized player state so it shows up correctly
 * in the public live page and the scoring console.
 *
 * Idempotent — re-running does not duplicate data:
 *   - Organisers keyed by deterministic email (org1@…demo to org5@…demo)
 *   - Tenants keyed by slug
 *   - Teams + tournaments + matches use deterministic UUIDs derived from
 *     the seed index, so on-conflict-do-nothing keeps them stable
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/seed-five-leagues.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (for admin auth user creation) and
 * either POSTGRES_URL_NON_POOLING or DATABASE_URL.
 */

import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PG_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE || !PG_URL) {
  console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL');
  process.exit(1);
}

// -------------------------------------------------------------------
// Deterministic UUID helper — gives stable IDs across re-runs
// -------------------------------------------------------------------
function stableUuid(...parts) {
  const h = createHash('sha256').update(parts.join('|')).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),                 // version 4
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}

// -------------------------------------------------------------------
// Static name pools
// -------------------------------------------------------------------
const LEAGUES = [
  { slug: 'pro-punjab',     name: 'Pro Punjab Kabaddi',         tournament: 'Pro Punjab Kabaddi Season 1',   primaryColor: '#dc2626' },
  { slug: 'mh-kabaddi',     name: 'Maharashtra Kabaddi League', tournament: 'MKL Spring Championship 2026',  primaryColor: '#2563eb' },
  { slug: 'tn-premier',     name: 'Tamil Nadu Premier',         tournament: 'TN Premier 2026',               primaryColor: '#16a34a' },
  { slug: 'bengal-trophy',  name: 'Bengal Tigers League',       tournament: 'Bengal Tigers Trophy',          primaryColor: '#ea580c' },
  { slug: 'karnataka-cup',  name: 'Karnataka Kabaddi Cup',      tournament: 'Karnataka Cup 2026',            primaryColor: '#7c3aed' },
];

// 50 unique team-name combinations (city + suffix)
const CITIES = [
  'Mumbai','Delhi','Pune','Chennai','Bangalore','Kolkata','Hyderabad','Ahmedabad','Surat','Jaipur',
  'Lucknow','Kanpur','Nagpur','Indore','Bhopal','Thane','Vizag','Patna','Vadodara','Ghaziabad',
  'Ludhiana','Agra','Nashik','Faridabad','Meerut','Rajkot','Varanasi','Srinagar','Aurangabad','Dhanbad',
  'Amritsar','Allahabad','Ranchi','Howrah','Coimbatore','Jabalpur','Gwalior','Vijayawada','Jodhpur','Madurai',
  'Raipur','Kota','Chandigarh','Guwahati','Solapur','Hubli','Mysore','Trichy','Bareilly','Aligarh',
];
const SUFFIXES = ['Warriors','Lions','Panthers','Jets','Bulls','Mavericks','Hawks','Pirates','Flames','Strikers'];
const TEAM_COLORS = ['#dc2626','#2563eb','#16a34a','#ea580c','#7c3aed','#0891b2','#ca8a04','#be185d','#059669','#6d28d9'];

// Indian first/last names — generates 500 unique players
const FIRST_NAMES = [
  'Pawan','Rahul','Naveen','Pradeep','Mahender','Surender','Rohit','Manjeet','Ajay','Deepak',
  'Vikas','Sandeep','Anup','Sachin','Ravi','Karan','Nitin','Akash','Arjun','Vivek',
  'Suresh','Mukesh','Rakesh','Nitesh','Hitesh','Pankaj','Manoj','Saurabh','Yash','Aman',
  'Harish','Mohit','Kapil','Sushil','Anil','Sunil','Ajit','Vinod','Rajesh','Mahesh',
  'Girish','Lalit','Bharat','Bipin','Chetan','Dinesh','Gaurav','Hemant','Jagat','Kunal',
];
const LAST_NAMES = [
  'Sehrawat','Kumar','Singh','Yadav','Sharma','Verma','Gupta','Rajput','Chaudhary','Tomar',
  'Hooda','Dhaka','Pawar','Patil','Reddy','Naik','Nair','Iyer','Iyengar','Menon',
  'Choudhary','Punia','Tanwar','Sangwan','Phogat','Dahiya','Bhardwaj','Saini','Rana','Thakur',
];

// Per organiser: pick 10 distinct teams from the pool offset by tenantIndex×10
function teamsForTenant(tenantIndex) {
  const teams = [];
  const usedSuffixIdx = new Set();
  for (let i = 0; i < 10; i++) {
    const cityIdx = (tenantIndex * 10 + i) % CITIES.length;
    let suffixIdx = i;
    while (usedSuffixIdx.has(suffixIdx)) suffixIdx = (suffixIdx + 1) % SUFFIXES.length;
    usedSuffixIdx.add(suffixIdx);
    const city = CITIES[cityIdx];
    const suffix = SUFFIXES[suffixIdx];
    teams.push({
      name: `${city} ${suffix}`,
      shortName: city.slice(0, 3).toUpperCase(),
      city,
      primaryColor: TEAM_COLORS[i],
    });
  }
  return teams;
}

// 10 player names per team, deterministic per tenant×team×slot
function playersForTeam(tenantIndex, teamIndex) {
  const players = [];
  // Roles: 3 raiders, 4 defenders (2 corner + 2 cover), 3 all-rounders
  const ROLES = [
    'raider', 'raider', 'raider',
    'defender_corner', 'defender_corner',
    'defender_cover', 'defender_cover',
    'all_rounder', 'all_rounder', 'all_rounder',
  ];
  const seed = tenantIndex * 100 + teamIndex * 10;
  for (let i = 0; i < 10; i++) {
    const fnIdx = (seed + i * 7) % FIRST_NAMES.length;
    const lnIdx = (seed + i * 13) % LAST_NAMES.length;
    players.push({
      fullName: `${FIRST_NAMES[fnIdx]} ${LAST_NAMES[lnIdx]}`,
      jerseyNumber: i + 1,
      role: ROLES[i],
    });
  }
  return players;
}

// -------------------------------------------------------------------
// Match generation — produces a sequence of events that sum to a score
// -------------------------------------------------------------------
function generateCompletedMatchEvents({
  matchId,
  tenantId,
  homeTeamId,
  awayTeamId,
  homePlayers,           // [{ id, role }]
  awayPlayers,
  matchEndAt,            // Date object — anchors created_at
}) {
  const events = [];
  const TOTAL_RAIDS = 30 + Math.floor(Math.random() * 15); // 30-44 raids
  let half = 1;
  let homeScore = 0;
  let awayScore = 0;
  let consecutiveEmptyHome = 0;
  let consecutiveEmptyAway = 0;
  let clock = 0;
  let timeOffsetMs = -TOTAL_RAIDS * 30 * 1000; // ~30s per raid before matchEndAt

  for (let i = 0; i < TOTAL_RAIDS; i++) {
    const isHomeAttacking = i % 2 === 0;
    const attackingTeamId = isHomeAttacking ? homeTeamId : awayTeamId;
    const defendingTeamId = isHomeAttacking ? awayTeamId : homeTeamId;
    const attackers = isHomeAttacking ? homePlayers : awayPlayers;
    const defenders = isHomeAttacking ? awayPlayers : homePlayers;

    // Switch to half 2 at midpoint
    if (i >= TOTAL_RAIDS / 2) half = 2;
    clock = (i % (TOTAL_RAIDS / 2)) * (1800 / (TOTAL_RAIDS / 2));

    const raider = attackers[Math.floor(Math.random() * attackers.length)];
    const consecEmpty = isHomeAttacking ? consecutiveEmptyHome : consecutiveEmptyAway;
    const isDoOrDie = consecEmpty >= 2;

    const roll = Math.random();
    let type, pointsAttacker = 0, pointsDefender = 0, defenderIds = null;
    let isSuperRaid = false, isSuperTackle = false;

    if (roll < 0.15) {
      // Empty raid
      type = isDoOrDie ? 'do_or_die_raid' : 'empty_raid';
      if (isDoOrDie) pointsDefender = 1;
    } else if (roll < 0.25) {
      // Super raid (3+ pts)
      type = 'super_raid';
      pointsAttacker = 3;
      isSuperRaid = true;
      const touchedCount = 3;
      defenderIds = pickRandom(defenders, touchedCount).map((p) => p.id);
    } else if (roll < 0.40) {
      // Super tackle by defenders
      type = 'super_tackle';
      pointsDefender = 2;
      isSuperTackle = true;
      defenderIds = pickRandom(defenders, 2 + Math.floor(Math.random() * 2)).map((p) => p.id);
    } else if (roll < 0.55) {
      // Tackle point
      type = 'tackle_point';
      pointsDefender = 1;
      defenderIds = pickRandom(defenders, 2 + Math.floor(Math.random() * 2)).map((p) => p.id);
    } else if (roll < 0.65) {
      // Bonus only
      type = 'bonus_point';
      pointsAttacker = 1;
    } else {
      // Standard raid_point — 1 to 2 touches
      type = isDoOrDie ? 'do_or_die_raid' : 'raid_point';
      pointsAttacker = 1 + Math.floor(Math.random() * 2);
      defenderIds = pickRandom(defenders, pointsAttacker).map((p) => p.id);
    }

    homeScore += isHomeAttacking ? pointsAttacker : pointsDefender;
    awayScore += isHomeAttacking ? pointsDefender : pointsAttacker;

    if (pointsAttacker === 0 && pointsDefender === 0) {
      // Pure empty raid
      if (isHomeAttacking) consecutiveEmptyHome++;
      else consecutiveEmptyAway++;
    } else {
      if (isHomeAttacking) consecutiveEmptyHome = 0;
      else consecutiveEmptyAway = 0;
    }

    timeOffsetMs += 30 * 1000;
    events.push({
      id: stableUuid(matchId, 'event', i),
      tenant_id: tenantId,
      match_id: matchId,
      type,
      half,
      clock_seconds: Math.floor(clock),
      attacking_team_id: attackingTeamId,
      raider_id: raider.id,
      defender_ids: defenderIds,
      points_attacker: pointsAttacker,
      points_defender: pointsDefender,
      is_super_raid: isSuperRaid,
      is_super_tackle: isSuperTackle,
      is_all_out: false,
      created_at: new Date(matchEndAt.getTime() + timeOffsetMs).toISOString(),
    });
  }

  return { events, homeScore, awayScore };
}

function pickRandom(pool, n) {
  const copy = [...pool];
  const out = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// -------------------------------------------------------------------
// Supabase admin client (REST) for auth user provisioning
// -------------------------------------------------------------------
async function adminFetch(path, init = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function findUserByEmail(email) {
  // Page through up to 1000 users
  for (let page = 1; page <= 5; page++) {
    const data = await adminFetch(`/auth/v1/admin/users?per_page=200&page=${page}`);
    const found = (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if ((data.users ?? []).length < 200) break;
  }
  return null;
}

async function ensureAuthUser(email, password, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) return existing.id;
  const created = await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'organiser' },
    }),
  });
  return created.id;
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------
const sql = postgres(PG_URL, { prepare: false, ssl: 'require' });

async function main() {
  const summary = [];

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const email = `org${i + 1}@kabaddiadda-demo.example`;
    const password = `KabaddiOrg${i + 1}-Demo!`;
    const fullName = `${league.name} Admin`;

    process.stdout.write(`[${i + 1}/${LEAGUES.length}] ${league.name}: provisioning auth user… `);
    const userId = await ensureAuthUser(email, password, fullName);
    process.stdout.write('✓\n');

    // Profile + tenant via SQL (service role bypasses RLS)
    const tenantId = stableUuid('tenant', league.slug);
    await sql`
      insert into public.profiles (id, email, full_name, role)
      values (${userId}, ${email}, ${fullName}, 'organiser')
      on conflict (id) do update
        set email = excluded.email, full_name = excluded.full_name, role = 'organiser'
    `;
    await sql`
      insert into public.tenants (id, slug, name, status, owner_id, contact_email, branding)
      values (${tenantId}, ${league.slug}, ${league.name}, 'active', ${userId}, ${email},
              ${sql.json({ primaryColor: league.primaryColor })})
      on conflict (id) do update
        set slug = excluded.slug, name = excluded.name, status = 'active',
            owner_id = excluded.owner_id, branding = excluded.branding
    `;
    await sql`update public.profiles set tenant_id = ${tenantId} where id = ${userId}`;

    // Tournament
    const tournamentId = stableUuid('tournament', league.slug);
    await sql`
      insert into public.tournaments
        (id, tenant_id, slug, name, format, status, start_date, end_date, max_teams)
      values
        (${tournamentId}, ${tenantId}, 'season-1', ${league.tournament}, 'league',
         'live', ${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)},
         ${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}, 10)
      on conflict (id) do update
        set name = excluded.name, status = 'live'
    `;

    // 10 teams + 100 players
    const teamsRecords = [];
    for (let t = 0; t < 10; t++) {
      const teamMeta = teamsForTenant(i)[t];
      const teamId = stableUuid('team', league.slug, t);
      await sql`
        insert into public.teams
          (id, tenant_id, tournament_id, name, short_name, city, primary_color)
        values
          (${teamId}, ${tenantId}, ${tournamentId},
           ${teamMeta.name}, ${teamMeta.shortName}, ${teamMeta.city}, ${teamMeta.primaryColor})
        on conflict (id) do update
          set name = excluded.name, short_name = excluded.short_name,
              city = excluded.city, primary_color = excluded.primary_color
      `;

      const players = playersForTeam(i, t).map((p, idx) => ({
        ...p,
        id: stableUuid('player', league.slug, t, idx),
      }));
      for (const p of players) {
        await sql`
          insert into public.players
            (id, tenant_id, team_id, full_name, jersey_number, role)
          values
            (${p.id}, ${tenantId}, ${teamId}, ${p.fullName}, ${p.jerseyNumber}, ${p.role})
          on conflict (id) do update
            set full_name = excluded.full_name, jersey_number = excluded.jersey_number,
                role = excluded.role
        `;
      }
      teamsRecords.push({ id: teamId, name: teamMeta.name, players });
    }

    // 10 matches: 5 completed, 1 live, 4 scheduled
    let matchIndex = 0;
    let completedCount = 0;
    let liveAssigned = false;
    let liveMatchId = null;

    // Generate 10 unique team pairings (round-robin slice)
    const pairings = [];
    for (let h = 0; h < teamsRecords.length && pairings.length < 10; h++) {
      for (let a = h + 1; a < teamsRecords.length && pairings.length < 10; a++) {
        pairings.push([h, a]);
      }
    }

    for (const [h, a] of pairings) {
      const home = teamsRecords[h];
      const away = teamsRecords[a];
      const matchId = stableUuid('match', league.slug, matchIndex);

      let status, scheduledAt, homeScore = 0, awayScore = 0;
      const events = [];

      if (completedCount < 5) {
        status = 'completed';
        scheduledAt = new Date(Date.now() - (5 - completedCount) * 4 * 86400000);
        const result = generateCompletedMatchEvents({
          matchId,
          tenantId,
          homeTeamId: home.id,
          awayTeamId: away.id,
          homePlayers: home.players,
          awayPlayers: away.players,
          matchEndAt: scheduledAt,
        });
        homeScore = result.homeScore;
        awayScore = result.awayScore;
        events.push(...result.events);
        completedCount++;
      } else if (!liveAssigned) {
        status = 'live';
        scheduledAt = new Date(Date.now() - 15 * 60 * 1000); // started 15 min ago
        liveAssigned = true;
        liveMatchId = matchId;
        // ~12 events for partial score
        const partial = generateCompletedMatchEvents({
          matchId,
          tenantId,
          homeTeamId: home.id,
          awayTeamId: away.id,
          homePlayers: home.players,
          awayPlayers: away.players,
          matchEndAt: scheduledAt,
        });
        const partialEvents = partial.events.slice(0, 12);
        for (const e of partialEvents) {
          if (e.points_attacker > 0 || e.points_defender > 0) {
            const attackingHome = e.attacking_team_id === home.id;
            if (attackingHome) {
              homeScore += e.points_attacker;
              awayScore += e.points_defender;
            } else {
              awayScore += e.points_attacker;
              homeScore += e.points_defender;
            }
          }
        }
        events.push(...partialEvents);
      } else {
        status = 'scheduled';
        scheduledAt = new Date(Date.now() + (matchIndex - 5) * 2 * 86400000);
      }

      // Insert / upsert match
      const liveMeta = status === 'live'
        ? {
            current_half: 1,
            clock_seconds: 600,                              // 10 mins into 30 min half
            current_attacking_team_id: home.id,
            current_raider_id: home.players[0].id,
            scoring_version: 2,
          }
        : { current_half: status === 'completed' ? 2 : 1, clock_seconds: 0, scoring_version: 2 };

      await sql`
        insert into public.matches
          (id, tenant_id, tournament_id, home_team_id, away_team_id,
           scheduled_at, status, home_score, away_score, current_half, clock_seconds,
           current_raider_id, current_attacking_team_id, scoring_version, round)
        values
          (${matchId}, ${tenantId}, ${tournamentId}, ${home.id}, ${away.id},
           ${scheduledAt.toISOString()}, ${status}, ${homeScore}, ${awayScore},
           ${liveMeta.current_half}, ${liveMeta.clock_seconds},
           ${liveMeta.current_raider_id ?? null}, ${liveMeta.current_attacking_team_id ?? null},
           2, ${`Match ${matchIndex + 1}`})
        on conflict (id) do update
          set status = excluded.status,
              home_score = excluded.home_score, away_score = excluded.away_score,
              current_half = excluded.current_half, clock_seconds = excluded.clock_seconds,
              current_raider_id = excluded.current_raider_id,
              current_attacking_team_id = excluded.current_attacking_team_id
      `;

      // Match lineups (starting 7) for live + completed matches; scheduled gets nothing
      if (status !== 'scheduled') {
        const homeStarters = home.players.slice(0, 7).map((p) => p.id);
        const awayStarters = away.players.slice(0, 7).map((p) => p.id);
        await sql`
          insert into public.match_lineups
            (id, tenant_id, match_id, team_id, starting_player_ids)
          values
            (${stableUuid('lineup', matchId, 'home')}, ${tenantId}, ${matchId}, ${home.id}, ${sql.json(homeStarters)}),
            (${stableUuid('lineup', matchId, 'away')}, ${tenantId}, ${matchId}, ${away.id}, ${sql.json(awayStarters)})
          on conflict (match_id, team_id) do update
            set starting_player_ids = excluded.starting_player_ids
        `;
      }

      // Insert events. We use a temporary side-channel: bulk insert.
      if (events.length > 0) {
        // Wipe any prior events for this match (idempotency)
        await sql`delete from public.match_events where match_id = ${matchId}`;
        for (const e of events) {
          await sql`
            insert into public.match_events
              (id, tenant_id, match_id, type, half, clock_seconds,
               attacking_team_id, raider_id, defender_ids,
               points_attacker, points_defender,
               is_super_raid, is_super_tackle, is_all_out, created_at)
            values
              (${e.id}, ${e.tenant_id}, ${e.match_id}, ${e.type}, ${e.half}, ${e.clock_seconds},
               ${e.attacking_team_id}, ${e.raider_id},
               ${e.defender_ids ? sql.json(e.defender_ids) : null},
               ${e.points_attacker}, ${e.points_defender},
               ${e.is_super_raid}, ${e.is_super_tackle}, ${e.is_all_out}, ${e.created_at})
          `;
        }
      }

      matchIndex++;
    }

    // Initialize player state for the live match (after lineups exist)
    if (liveMatchId) {
      await sql`select public.initialize_match_player_state(${liveMatchId})`;
    }

    summary.push({
      league: league.name,
      slug: league.slug,
      organiser_email: email,
      organiser_password: password,
      teams: 10,
      players: 100,
      matches: { completed: 5, live: 1, scheduled: 4 },
    });
  }

  console.log('\n✓ Seed complete\n');
  console.table(
    summary.map((s) => ({
      League: s.league,
      'URL slug': `/t/${s.slug}`,
      'Organiser email': s.organiser_email,
      Password: s.organiser_password,
    })),
  );
  console.log('\nTotal: 5 leagues, 50 teams, 500 players, 50 matches');
  console.log('       (25 completed, 5 live, 20 scheduled)\n');
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('\n✗ Seed failed:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    await sql.end();
    process.exit(1);
  });
