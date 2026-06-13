#!/usr/bin/env node
/**
 * Promote an existing profile to superadmin.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/promote-superadmin.mjs <email>
 *
 * Connects via DATABASE_URL (with POSTGRES_URL_NON_POOLING preferred). The
 * profiles_role_unchanged trigger allows role changes when auth.uid() is null
 * (direct Postgres connection — no JWT), so this works without any policy
 * dance. Prints the resulting row so you can verify before logging in.
 */

import postgres from 'postgres';

const email = process.argv[2];
if (!email) {
  console.error('Usage: promote-superadmin.mjs <email>');
  process.exit(1);
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING or DATABASE_URL must be set');
  process.exit(1);
}

console.log(`→ Promoting ${email} to superadmin`);
console.log(`  Host: ${new URL(url).hostname}`);

const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  const rows = await client`
    update public.profiles
       set role = 'superadmin'
     where email = ${email}
     returning id, email, role, tenant_id
  `;
  if (rows.length === 0) {
    console.error(`✗ No profile found with email "${email}". Has this user signed up yet?`);
    process.exit(1);
  }
  console.log(`✓ Updated ${rows.length} row:`);
  console.log(rows[0]);
} catch (err) {
  console.error('✗ Promotion failed:');
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
