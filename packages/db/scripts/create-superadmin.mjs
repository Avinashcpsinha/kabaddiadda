#!/usr/bin/env node
/**
 * Create (or update) a superadmin account with a known password.
 * Idempotent — re-running just resets the password.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/create-superadmin.mjs <email> <password> "<full name>"
 */

import postgres from 'postgres';

const [, , email, password, fullName] = process.argv;
if (!email || !password) {
  console.error('Usage: create-superadmin.mjs <email> <password> "<full name>"');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

async function authAdmin(method, path, body) {
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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json;
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, ssl: 'require' });

try {
  // 1) Find or create the auth user.
  const list = await authAdmin('GET', 'users?per_page=500');
  const existing = (list.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId;
  if (existing) {
    await authAdmin('PUT', `users/${existing.id}`, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? existing.user_metadata?.full_name ?? '', role: 'superadmin' },
    });
    userId = existing.id;
    console.log(`✓ Existing user updated: ${email}`);
  } else {
    const created = await authAdmin('POST', 'users', {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? '', role: 'superadmin' },
    });
    userId = created.id;
    console.log(`✓ New user created: ${email}`);
  }

  // 2) Upsert profile with role=superadmin.
  await sql`
    insert into public.profiles (id, email, full_name, role)
    values (${userId}, ${email}, ${fullName ?? ''}, 'superadmin')
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(excluded.full_name, public.profiles.full_name),
          role = 'superadmin'
  `;

  console.log(`✓ Profile role = superadmin`);
  console.log(`\n  Login at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://your-site'}/login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await sql.end();
}
