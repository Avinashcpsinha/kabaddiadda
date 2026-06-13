#!/usr/bin/env node
/**
 * Search for users whose email matches a partial string.
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/find-user.mjs vaibhav
 */
import postgres from 'postgres';

const needle = process.argv[2];
if (!needle) {
  console.error('Usage: find-user.mjs <email-substring>');
  process.exit(1);
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, ssl: 'require' });
try {
  const rows = await sql`
    select email, full_name, role, tenant_id, created_at
    from public.profiles
    where email ilike ${'%' + needle + '%'}
    order by created_at desc
  `;
  if (rows.length === 0) {
    console.log(`No matches for "${needle}".`);
  } else {
    console.log(`Found ${rows.length} matching profile(s):`);
    for (const r of rows) {
      console.log(`  ${r.email.padEnd(45)} ${(r.full_name ?? '').padEnd(25)} ${r.role}`);
    }
  }
} finally {
  await sql.end();
}
