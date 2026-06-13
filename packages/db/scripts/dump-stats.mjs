#!/usr/bin/env node
/**
 * Throwaway one-off: dump real counts from the configured Postgres URL.
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/dump-stats.mjs
 */

import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

console.log(`Host: ${new URL(url).hostname}\n`);

const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  const [
    [{ count: users }],
    [{ count: tenants }],
    [{ count: tournaments }],
    [{ count: teams }],
    [{ count: matches }],
    rolesBreakdown,
    recentUsers,
    recentTenants,
  ] = await Promise.all([
    client`select count(*)::int as count from public.profiles`,
    client`select count(*)::int as count from public.tenants`,
    client`select count(*)::int as count from public.tournaments`,
    client`select count(*)::int as count from public.teams`,
    client`select count(*)::int as count from public.matches`,
    client`select role, count(*)::int as count from public.profiles group by role order by count desc`,
    client`select email, full_name, role, tenant_id, created_at from public.profiles order by created_at desc limit 10`,
    client`select slug, name, status, owner_id, created_at from public.tenants order by created_at desc limit 10`,
  ]);

  console.log('=== TOTALS ===');
  console.log(`Users:        ${users}`);
  console.log(`Tenants:      ${tenants}`);
  console.log(`Tournaments:  ${tournaments}`);
  console.log(`Teams:        ${teams}`);
  console.log(`Matches:      ${matches}`);

  console.log('\n=== USERS BY ROLE ===');
  for (const row of rolesBreakdown) {
    console.log(`  ${row.role}: ${row.count}`);
  }

  console.log('\n=== LAST 10 USERS ===');
  for (const u of recentUsers) {
    const when = new Date(u.created_at).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    console.log(
      `  ${u.email.padEnd(40)} ${(u.full_name ?? '').padEnd(25)} ${u.role.padEnd(11)} ${u.tenant_id ? 'tenant: ' + u.tenant_id.slice(0, 8) : 'no tenant'} ${when}`,
    );
  }

  console.log('\n=== LAST 10 TENANTS ===');
  if (recentTenants.length === 0) {
    console.log('  (none)');
  } else {
    for (const t of recentTenants) {
      const when = new Date(t.created_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      console.log(`  ${t.slug.padEnd(20)} ${t.name.padEnd(35)} ${t.status.padEnd(10)} ${when}`);
    }
  }
} catch (err) {
  console.error('Query failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
