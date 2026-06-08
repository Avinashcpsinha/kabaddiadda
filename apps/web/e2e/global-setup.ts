import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env';

export const FIXTURE_PATH = resolve(process.cwd(), 'e2e', '.fixture.json');

const E2E_EMAIL = 'e2e-coach@kabaddiadda.test';
const E2E_PASSWORD = 'E2eCoach!2026';

/**
 * Provision a deterministic, idempotent e2e organiser so the coach spec
 * has a real account + tenant + tournament + team to drive. Re-running
 * reuses the same rows (and just resets the password). Built off the same
 * pattern as src/lib/demo-seed.ts. Writes the IDs to e2e/.fixture.json.
 */
export default async function globalSetup() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check apps/web/.env.local',
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Auth user (find-or-create, always reset password + confirm).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === E2E_EMAIL);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, {
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Organiser', role: 'organiser' },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Organiser', role: 'organiser' },
    });
    if (error) throw error;
    user = data.user!;
  }
  const userId = user.id;

  // 2) Tenant (owned by the e2e user).
  let tenantId: string;
  const { data: ownTenant } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  if (ownTenant) {
    tenantId = ownTenant.id;
  } else {
    const { data: bySlug } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', 'e2e-coach-league')
      .maybeSingle();
    if (bySlug) {
      tenantId = bySlug.id;
      await admin.from('tenants').update({ owner_id: userId, status: 'active' }).eq('id', tenantId);
    } else {
      tenantId = randomUUID();
      const { error } = await admin.from('tenants').insert({
        id: tenantId,
        slug: 'e2e-coach-league',
        name: 'E2E Coach League',
        status: 'active',
        owner_id: userId,
        contact_email: E2E_EMAIL,
        plan: 'pro',
        plan_status: 'active',
      });
      if (error) throw error;
    }
  }

  // 3) Profile → organiser of the tenant.
  await admin.from('profiles').upsert(
    { id: userId, email: E2E_EMAIL, full_name: 'E2E Organiser', role: 'organiser', tenant_id: tenantId },
    { onConflict: 'id' },
  );

  // 4) Tournament.
  let tournamentId: string;
  const { data: tour } = await admin
    .from('tournaments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', 'e2e-cup')
    .maybeSingle();
  if (tour) {
    tournamentId = tour.id;
  } else {
    tournamentId = randomUUID();
    const { error } = await admin.from('tournaments').insert({
      id: tournamentId,
      tenant_id: tenantId,
      slug: 'e2e-cup',
      name: 'E2E Cup',
      format: 'league',
      status: 'live',
      start_date: '2026-05-01',
      end_date: '2026-05-30',
    });
    if (error) throw error;
  }

  // 5) Team.
  let teamId: string;
  const { data: team } = await admin
    .from('teams')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('tournament_id', tournamentId)
    .eq('name', 'E2E Test Team')
    .maybeSingle();
  if (team) {
    teamId = team.id;
  } else {
    teamId = randomUUID();
    const { error } = await admin.from('teams').insert({
      id: teamId,
      tenant_id: tenantId,
      tournament_id: tournamentId,
      name: 'E2E Test Team',
      short_name: 'E2E',
      primary_color: '#ff5c1a',
    });
    if (error) throw error;
  }

  writeFileSync(
    FIXTURE_PATH,
    JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD, tenantId, tournamentId, teamId }, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(`[e2e seed] organiser ready — tournament ${tournamentId}, team ${teamId}`);
}
