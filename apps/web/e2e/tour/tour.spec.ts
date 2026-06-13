import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from '../load-env';

loadEnv();
test.use({ actionTimeout: 12_000 });

const HERE = __dirname;
const NARRATION = JSON.parse(readFileSync(resolve(HERE, 'narration.json'), 'utf8')) as {
  id: string;
  title: string;
  text: string;
}[];
const DURATIONS: Record<string, number> = existsSync(resolve(HERE, 'durations.json'))
  ? JSON.parse(readFileSync(resolve(HERE, 'durations.json'), 'utf8'))
  : {};
const N = new Map(NARRATION.map((s) => [s.id, s]));
const TOTAL = NARRATION.length;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const STAMP = Date.now();
const EMAIL = `tour-${STAMP}@kabaddiadda.test`;
const PASSWORD = 'TourDemo!2026';

// Captured as the tour runs.
let userId: string | null = null;
let tenantId: string | null = null;
let tournamentId: string | null = null;
let teamAName = '';
let teamBName = '';
let normalMatchId: string | null = null;
let advMatchId: string | null = null;

const offsets: { id: string; offsetMs: number }[] = [];
let videoPath: string | null = null;
let t0 = 0;

// ── helpers ───────────────────────────────────────────────────────────
async function setCaption(page: Page, idx: number, title: string, text: string) {
  try {
    await page.evaluate(
      ({ idx, title, text, total }) => {
        // Hide the Next.js dev-tools indicator (a fixed bottom-corner overlay
        // that otherwise intercepts clicks on bottom buttons) and pad the body
        // so nothing sits under our caption bar.
        let st = document.getElementById('__tour_style');
        if (!st) {
          st = document.createElement('style');
          st.id = '__tour_style';
          st.textContent =
            'nextjs-portal{display:none!important}' +
            '[data-nextjs-toast]{display:none!important}' +
            'body{padding-bottom:118px!important}';
          document.head.appendChild(st);
        }
        let bar = document.getElementById('__tour_caption');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = '__tour_caption';
          bar.style.cssText =
            'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;' +
            'display:flex;align-items:center;gap:16px;padding:14px 22px;' +
            'background:linear-gradient(0deg,rgba(5,7,10,0.94),rgba(5,7,10,0.78));' +
            'border-top:2px solid #ff5a1f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;';
          document.body.appendChild(bar);
        }
        bar.innerHTML =
          `<div style="flex:none;min-width:54px;height:46px;padding:0 12px;border-radius:12px;background:#ff5a1f;` +
          `display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;` +
          `box-shadow:0 6px 20px rgba(255,90,31,0.45)">${idx}/${total}</div>` +
          `<div style="line-height:1.35"><div style="font-size:16px;font-weight:800;letter-spacing:.2px">${title}</div>` +
          `<div style="font-size:14px;color:#cfd6e2;margin-top:2px">${text}</div></div>`;
      },
      { idx, title, text, total: TOTAL },
    );
  } catch {
    // page mid-navigation — caption re-applies on the next step
  }
}

/** Click a button robustly: wait for it, highlight, normal click, then a
 *  force-click fallback (bypasses any stray overlay intercepting the hit). */
async function clickBtn(loc: Locator) {
  await loc.waitFor({ state: 'visible', timeout: 12_000 });
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await highlight(loc);
  try {
    await loc.click({ timeout: 6000 });
  } catch {
    await loc.click({ force: true, timeout: 6000 });
  }
}

/** Submit a form by its submit <button>, located via a field it contains.
 *  Robust to FormSubmit swapping its label for a spinner while pending
 *  (which makes accessible-name lookups fail). */
async function submitForm(page: Page, fieldSel: string) {
  const loc = page.locator(`form:has(${fieldSel}) button[type="submit"]`).first();
  await loc.waitFor({ state: 'visible', timeout: 12_000 });
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await highlight(loc);
  try {
    await loc.click({ timeout: 6000 });
  } catch {
    await loc.click({ force: true, timeout: 6000 });
  }
}

async function highlight(loc: Locator) {
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 4000 });
    await loc.evaluate((el: HTMLElement) => {
      el.style.outline = '3px solid #ff5a1f';
      el.style.outlineOffset = '2px';
      el.style.borderRadius = '8px';
      el.style.transition = 'outline-color .2s';
    });
  } catch {
    /* non-fatal */
  }
}

let stepIdx = 0;
async function step(page: Page, id: string, action: () => Promise<void>) {
  const meta = N.get(id)!;
  stepIdx += 1;
  console.log(`[tour] step ${stepIdx}/${TOTAL} ${id}`);
  await setCaption(page, stepIdx, meta.title, meta.text);
  const start = Date.now();
  offsets.push({ id, offsetMs: start - t0 });
  try {
    await action();
  } catch (err) {
    console.error(`[tour] step "${id}" action error:`, (err as Error).message);
  }
  await setCaption(page, stepIdx, meta.title, meta.text); // re-apply after any nav
  const holdMs = DURATIONS[id] ? Math.round(DURATIONS[id] * 1000 + 1500) : 4500;
  const elapsed = Date.now() - start;
  await page.waitForTimeout(Math.max(1100, holdMs - elapsed));
}

/** Seed a ready-to-score v2 (Advanced) match with two full 7-player squads
 *  plus a couple of raids already played, so the Advanced console looks live. */
async function seedAdvancedMatch(tenant: string, tournament: string) {
  const homeId = randomUUID();
  const awayId = randomUUID();
  const matchId = randomUUID();
  const home = Array.from({ length: 7 }, () => randomUUID());
  const away = Array.from({ length: 7 }, () => randomUUID());

  await admin.from('teams').insert([
    { id: homeId, tenant_id: tenant, tournament_id: tournament, name: 'Patna Pythons', short_name: 'PAT', primary_color: '#e11d48' },
    { id: awayId, tenant_id: tenant, tournament_id: tournament, name: 'Delhi Dynamos', short_name: 'DEL', primary_color: '#2563eb' },
  ]);
  await admin.from('players').insert([
    ...home.map((id, i) => ({ id, tenant_id: tenant, team_id: homeId, full_name: `Pythons ${i + 1}`, jersey_number: i + 1, role: 'all_rounder' })),
    ...away.map((id, i) => ({ id, tenant_id: tenant, team_id: awayId, full_name: `Dynamos ${i + 1}`, jersey_number: i + 1, role: 'all_rounder' })),
  ]);
  await admin.from('matches').insert({
    id: matchId, tenant_id: tenant, tournament_id: tournament,
    home_team_id: homeId, away_team_id: awayId,
    scheduled_at: new Date(STAMP).toISOString(), status: 'live', scoring_version: 2,
    home_score: 0, away_score: 0, current_half: 1, clock_seconds: 540, round: 'Final',
  });
  await admin.from('match_lineups').insert([
    { tenant_id: tenant, match_id: matchId, team_id: homeId, starting_player_ids: home, bench_player_ids: [], captain_id: home[0], locked_at: new Date(STAMP).toISOString() },
    { tenant_id: tenant, match_id: matchId, team_id: awayId, starting_player_ids: away, bench_player_ids: [], captain_id: away[0], locked_at: new Date(STAMP).toISOString() },
  ]);
  await admin.from('match_player_state').insert([
    ...home.map((pid) => ({ tenant_id: tenant, match_id: matchId, team_id: homeId, player_id: pid, state: 'on_mat' })),
    ...away.map((pid) => ({ tenant_id: tenant, match_id: matchId, team_id: awayId, player_id: pid, state: 'on_mat' })),
  ]);
  // A couple of raids so the mat shows outs (the v2 trigger does the rest).
  await admin.from('match_events').insert({
    tenant_id: tenant, match_id: matchId, type: 'raid_point', half: 1, clock_seconds: 120,
    attacking_team_id: homeId, raider_id: home[0], defender_ids: [away[5], away[6]], points_attacker: 2, points_defender: 0,
  });
  await admin.from('match_events').insert({
    tenant_id: tenant, match_id: matchId, type: 'tackle_point', half: 1, clock_seconds: 160,
    attacking_team_id: awayId, raider_id: away[1], defender_ids: [home[3]], points_attacker: 0, points_defender: 1,
  });
  return matchId;
}

test('Kabaddiadda product tour', async ({ page }) => {
  t0 = Date.now();

  // 0 · Land on the homepage.
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await step(page, 'intro', async () => {
    await page.waitForTimeout(300);
  });
  await step(page, 'home', async () => {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, -500);
  });

  // 1 · Register.
  await step(page, 'signup_open', async () => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'signup_role', async () => {
    const org = page.getByRole('button', { name: 'Organiser' });
    await highlight(org);
    await org.click();
  });
  await step(page, 'signup_fill', async () => {
    await page.fill('#fullName', 'Tour Organiser');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
  });
  await step(page, 'signup_submit', async () => {
    await clickBtn(page.getByRole('button', { name: 'Create account' }));
    await page.waitForURL((u) => !u.pathname.includes('/signup'), { timeout: 30_000 });
  });

  // A brand-new organiser has no tenant yet, so the app sends them to /setup
  // to create their league before anything else.
  await step(page, 'setup_league', async () => {
    if (!page.url().includes('/setup')) await page.goto('/setup');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('#name', 'Bengal Premier Kabaddi').catch(() => {});
    await page.waitForTimeout(250);
    await page.fill('#slug', `bpl-${STAMP}`).catch(() => {});
    await submitForm(page, '#name');
    await page.waitForURL(/\/organiser(\/|$|\?)/, { timeout: 30_000 }).catch(() => {});
  });

  // Tenant now exists — look it up + upgrade so no plan gate interrupts the tour.
  {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === EMAIL)?.id ?? null;
    if (userId) {
      const { data: ten } = await admin.from('tenants').select('id').eq('owner_id', userId).maybeSingle();
      tenantId = ten?.id ?? null;
      if (tenantId) await admin.from('tenants').update({ plan: 'pro', plan_status: 'active' }).eq('id', tenantId);
    }
  }

  await step(page, 'dashboard', async () => {
    await page.goto('/organiser');
    await page.waitForLoadState('domcontentloaded');
  });

  // 2 · Create a tournament.
  await step(page, 'tour_open', async () => {
    await page.goto('/organiser/tournaments/new');
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'tour_fill', async () => {
    await page.fill('#name', 'Summer Kabaddi Cup');
    await page.fill('#slug', `summer-cup-${STAMP}`);
    await page.selectOption('#format', 'league').catch(() => {});
    await page.fill('#startDate', '2026-07-01').catch(() => {});
    await page.fill('#endDate', '2026-07-20').catch(() => {});
  });
  await step(page, 'tour_submit', async () => {
    await submitForm(page, '#name');
    await page.waitForURL(/\/organiser\/tournaments\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const m = page.url().match(/tournaments\/([0-9a-f-]{36})/);
    tournamentId = m?.[1] ?? null;
  });

  // 3 · Add teams.
  await step(page, 'teams_open', async () => {
    if (tournamentId) await page.goto(`/organiser/tournaments/${tournamentId}/teams`);
    await page.waitForLoadState('domcontentloaded');
  });
  teamAName = 'Mumbai Mavericks';
  teamBName = 'Chennai Chargers';
  await step(page, 'team1', async () => {
    await page.fill('#name', teamAName);
    await page.fill('#shortName', 'MUM').catch(() => {});
    await page.fill('#city', 'Mumbai').catch(() => {});
    await page.fill('#primaryColor', '#f97316').catch(() => {});
    await submitForm(page, '#shortName');
    await page.waitForTimeout(1400);
  });
  await step(page, 'team2', async () => {
    await page.fill('#name', teamBName);
    await page.fill('#shortName', 'CHE').catch(() => {});
    await page.fill('#city', 'Chennai').catch(() => {});
    await page.fill('#primaryColor', '#0ea5e9').catch(() => {});
    await submitForm(page, '#shortName');
    await page.waitForTimeout(1400);
  });

  // 4 · Add players to team A.
  await step(page, 'players_open', async () => {
    const link = page.getByRole('link', { name: new RegExp(teamAName) }).first();
    if (await link.count()) {
      await link.click();
    } else if (tournamentId) {
      const { data: t } = await admin.from('teams').select('id').eq('tournament_id', tournamentId).eq('name', teamAName).maybeSingle();
      if (t) await page.goto(`/organiser/tournaments/${tournamentId}/teams/${t.id}`);
    }
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'players_add', async () => {
    const squad = [
      { name: 'Pawan Kumar', jersey: '7', role: 'raider' },
      { name: 'Rahul Chaudhari', jersey: '9', role: 'raider' },
      { name: 'Fazel Atrachali', jersey: '5', role: 'defender_corner' },
    ];
    for (const p of squad) {
      await page.fill('#fullName', p.name).catch(() => {});
      await page.fill('#jerseyNumber', p.jersey).catch(() => {});
      await page.selectOption('#role', p.role).catch(() => {});
      await submitForm(page, '#fullName').catch(() => {});
      await page.waitForTimeout(900);
    }
  });

  // 5 · Schedule a fixture (Normal, v1).
  await step(page, 'fixtures_open', async () => {
    if (tournamentId) await page.goto(`/organiser/tournaments/${tournamentId}/fixtures`);
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'fixture_add', async () => {
    // Resolve team ids so the <select>s are set deterministically.
    let aId: string | null = null;
    let bId: string | null = null;
    if (tournamentId) {
      const { data: ts } = await admin
        .from('teams')
        .select('id, name')
        .eq('tournament_id', tournamentId)
        .in('name', [teamAName, teamBName]);
      aId = ts?.find((t) => t.name === teamAName)?.id ?? null;
      bId = ts?.find((t) => t.name === teamBName)?.id ?? null;
    }
    await page.fill('#round', 'League · Match 1').catch(() => {});
    await page
      .selectOption('#homeTeamId', aId ?? { label: teamAName })
      .catch(() => page.selectOption('#homeTeamId', { label: teamAName }).catch(() => {}));
    await page
      .selectOption('#awayTeamId', bId ?? { label: teamBName })
      .catch(() => page.selectOption('#awayTeamId', { label: teamBName }).catch(() => {}));
    await page.fill('#scheduledAt', '2026-07-05T18:30').catch(() => {});
    await submitForm(page, '#homeTeamId');
    await page.waitForTimeout(1600);
    if (tournamentId) {
      const { data: mt } = await admin
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('scoring_version', 1)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      normalMatchId = mt?.id ?? null;
    }
  });

  // 6 · Normal scoring.
  await step(page, 'match_open', async () => {
    if (tournamentId && normalMatchId)
      await page.goto(`/organiser/tournaments/${tournamentId}/matches/${normalMatchId}`);
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'normal_start', async () => {
    await clickBtn(page.getByRole('button', { name: /Quick start/ }));
    await page.waitForURL(/\/scoring/, { timeout: 30_000 });
    await page.getByTestId('home-raid').waitFor({ timeout: 20_000 }).catch(() => {});
  });
  await step(page, 'normal_score', async () => {
    for (const id of ['home-raid', 'home-bonus', 'away-allout', 'home-raid']) {
      const b = page.getByTestId(id);
      await highlight(b);
      await b.click().catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.getByTestId('undo').click().catch(() => {});
    await page.waitForTimeout(500);
  });

  // 7 · Advanced scoring (seeded full-squad v2 match).
  if (tenantId && tournamentId) {
    advMatchId = await seedAdvancedMatch(tenantId, tournamentId).catch((e) => {
      console.error('[tour] seedAdvancedMatch failed:', e.message);
      return null;
    });
  }
  await step(page, 'advanced_open', async () => {
    if (tournamentId && advMatchId)
      await page.goto(`/organiser/tournaments/${tournamentId}/matches/${advMatchId}/scoring`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
  });
  await step(page, 'advanced_score', async () => {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, -300);
  });

  // 8 · Public + broadcast pages.
  await step(page, 'public_live', async () => {
    const id = advMatchId ?? normalMatchId;
    if (id) await page.goto(`/live/${id}`);
    await page.waitForLoadState('domcontentloaded');
  });
  await step(page, 'overlay', async () => {
    const id = advMatchId ?? normalMatchId;
    if (id) await page.goto(`/overlay/match/${id}`);
    await page.waitForLoadState('domcontentloaded');
  });

  // 9 · Outro.
  await step(page, 'outro', async () => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  // Persist timing + video path for the audio-mux step.
  videoPath = await page.video()?.path().catch(() => null) ?? null;
  writeFileSync(
    resolve(HERE, 'offsets.json'),
    JSON.stringify({ t0, offsets, videoPath, email: EMAIL, tenantId }, null, 2),
  );
  expect(offsets.length).toBe(TOTAL);
});

test.afterAll(async () => {
  // Tear down the throwaway tour account + all its data.
  try {
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId);
    if (userId) {
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  } catch (e) {
    console.error('[tour] cleanup error:', (e as Error).message);
  }
});
