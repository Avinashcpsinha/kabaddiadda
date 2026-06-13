import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env';

loadEnv();

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e', '.fixture.json'), 'utf8'),
) as { email: string; password: string; tenantId: string; tournamentId: string; teamId: string };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const homeTeamId = randomUUID();
const awayTeamId = randomUUID();
const matchId = randomUUID();

test.beforeAll(async () => {
  await admin.from('teams').insert([
    { id: homeTeamId, tenant_id: fixture.tenantId, tournament_id: fixture.tournamentId, name: 'Normal Home', short_name: 'NMH', primary_color: '#ff5c1a' },
    { id: awayTeamId, tenant_id: fixture.tenantId, tournament_id: fixture.tournamentId, name: 'Normal Away', short_name: 'NMA', primary_color: '#1a7cff' },
  ]);
  await admin.from('matches').insert({
    id: matchId,
    tenant_id: fixture.tenantId,
    tournament_id: fixture.tournamentId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    scheduled_at: new Date('2026-06-14T10:00:00.000Z').toISOString(),
    status: 'scheduled',
    scoring_version: 1, // Normal mode
    home_score: 0,
    away_score: 0,
    current_half: 1,
    clock_seconds: 0,
  });
});

test.afterAll(async () => {
  await admin.from('matches').delete().eq('id', matchId);
  await admin.from('teams').delete().in('id', [homeTeamId, awayTeamId]);
});

test('Normal scoring: quick-start, tap points, undo', async ({ page }) => {
  // Sign in through the real login form, wait for the session cookie.
  await page.goto('/login');
  await page.fill('#email', fixture.email);
  await page.fill('#password', fixture.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect
    .poll(
      async () => (await page.context().cookies()).some((c) => c.name.includes('auth-token')),
      { timeout: 20_000, message: 'sign-in failed' },
    )
    .toBe(true);

  // Open the match → Quick start in Normal mode (no lineups).
  await page.goto(`/organiser/tournaments/${fixture.tournamentId}/matches/${matchId}`);
  await page.getByRole('button', { name: /Quick start/ }).click();
  await page.waitForURL(/\/matches\/.+\/scoring/, { timeout: 30_000 });

  // The simple console renders point buttons (no raider/defender pickers).
  await expect(page.getByTestId('home-raid')).toBeVisible({ timeout: 20_000 });

  // Score: home Raid (+1), home Bonus (+1) → home 2; away All-out (+2) → away 2.
  await page.getByTestId('home-raid').click();
  await expect(page.getByTestId('home-score')).toHaveText('1', { timeout: 15_000 });
  await page.getByTestId('home-bonus').click();
  await expect(page.getByTestId('home-score')).toHaveText('2');
  await page.getByTestId('away-allout').click();
  await expect(page.getByTestId('away-score')).toHaveText('2');

  // Undo reverses the last event (away all-out) → away back to 0.
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('away-score')).toHaveText('0');

  // Persisted correctly in the DB (score trigger handles v1 too).
  const { data } = await admin
    .from('matches')
    .select('home_score, away_score, status')
    .eq('id', matchId)
    .maybeSingle();
  expect(data?.home_score).toBe(2);
  expect(data?.away_score).toBe(0);
  expect(data?.status).toBe('live');
});
