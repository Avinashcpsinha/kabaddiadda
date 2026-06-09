import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env';

loadEnv();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

test('instant demo: capture name + mobile, then land in the scoring console', async ({ page }) => {
  const name = `E2E Demo Visitor ${Date.now()}`;
  const mobile = '+919999900000';

  // 1) Open a marketing page and click the Try-live-scoring FAB.
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the live scoring demo' }).click();

  // 2) Capture modal — name required, plus a contact.
  await page.fill('#demo-name', name);
  await page.fill('#demo-mobile', mobile);
  await page.getByRole('button', { name: /Start the demo/ }).click();

  // 3) Must land on a real live scoring console — NOT a 404. The scoring
  //    page renders a "Broadcast overlay" link; the not-found page doesn't.
  await page.waitForURL(/\/matches\/.+\/scoring/, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Broadcast overlay' })).toBeAttached({
    timeout: 30_000,
  });

  // 4) The visitor was recorded in demo_sessions.
  const { data } = await admin
    .from('demo_sessions')
    .select('name, mobile, tenant_id')
    .eq('name', name)
    .maybeSingle();
  expect(data, 'a demo_sessions row should exist for this visitor').not.toBeNull();
  expect(data?.mobile).toBe(mobile);

  // 5) Cleanup — drop the sandbox tenant (cascades its data) + the lead row.
  if (data?.tenant_id) await admin.from('tenants').delete().eq('id', data.tenant_id);
  await admin.from('demo_sessions').delete().eq('name', name);
});
