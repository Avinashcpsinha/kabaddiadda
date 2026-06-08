import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env';

loadEnv();

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'e2e', '.fixture.json'), 'utf8')) as {
  email: string;
  password: string;
  tenantId: string;
  tournamentId: string;
  teamId: string;
};

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Keep the e2e team clean so the run is repeatable.
test.afterAll(async () => {
  await admin.from('coaches').delete().eq('team_id', fixture.teamId);
});

test('organiser can add a coach and see them in the staff list', async ({ page }) => {
  const coachName = `E2E Head Coach ${Date.now()}`;
  const teamPath = `/organiser/tournaments/${fixture.tournamentId}/teams/${fixture.teamId}`;

  // 1) Sign in through the real login form. signInAction runs inside a
  //    React transition and sets the Supabase session cookie — wait for
  //    that cookie before navigating, or an early goto aborts the in-flight
  //    action and login never completes.
  await page.goto('/login');
  await page.fill('#email', fixture.email);
  await page.fill('#password', fixture.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies();
        return cookies.some((c) => c.name.includes('auth-token'));
      },
      { timeout: 20_000, message: 'Supabase session cookie never appeared — sign-in failed' },
    )
    .toBe(true);

  // 2) Open the (auth-gated) team page.
  await page.goto(teamPath);
  await expect(page.getByRole('heading', { name: /Coaching staff/ })).toBeVisible();

  // 3) Add a head coach (role defaults to head_coach).
  await page.fill('#coach-fullName', coachName);
  await page.getByRole('button', { name: 'Add coach' }).click();

  // 4) The coach should appear in the staff table. revalidatePath refreshes
  //    the server component; reload to assert deterministically.
  await page.reload();
  await expect(page.getByText(coachName)).toBeVisible({ timeout: 15_000 });

  // 5) And it should be persisted with the right role + team.
  const { data } = await admin
    .from('coaches')
    .select('full_name, role, team_id')
    .eq('team_id', fixture.teamId)
    .eq('full_name', coachName)
    .maybeSingle();
  expect(data?.role).toBe('head_coach');
});
