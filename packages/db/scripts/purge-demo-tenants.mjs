import postgres from 'postgres';

const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dbUrl || !supabaseUrl || !serviceKey) {
  console.error('Need POSTGRES_URL_NON_POOLING + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sql = postgres(dbUrl, { prepare: false, ssl: 'require' });

async function authAdmin(method, path) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/${path}`, {
    method,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

try {
  // --- scope (demo tenants only; NOT the e2e-coach test org) ---
  const tenants = await sql`select id, slug from public.tenants where slug like 'demo-%'`;
  const [{ matches }] = await sql`
    select count(*)::int as matches from public.matches
    where tenant_id in (select id from public.tenants where slug like 'demo-%')`;
  console.log(`Demo tenants to delete: ${tenants.length} (cascading ~${matches} matches + their teams/players/events)`);

  // --- delete tenants (cascades all child data; demo_sessions.tenant_id -> null) ---
  const delT = await sql`delete from public.tenants where slug like 'demo-%'`;
  console.log(`✓ Deleted tenants: ${delT.count}`);

  // --- delete demo profiles ---
  const delP = await sql`delete from public.profiles where email like 'demo-%@kabaddiadda.in'`;
  console.log(`✓ Deleted profiles: ${delP.count}`);

  // --- delete demo auth users via the admin API ---
  let deletedUsers = 0, page = 1;
  for (;;) {
    const list = await authAdmin('GET', `users?per_page=1000&page=${page}`);
    const users = list?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (u.email?.startsWith('demo-') && u.email.endsWith('@kabaddiadda.in')) {
        await authAdmin('DELETE', `users/${u.id}`);
        deletedUsers++;
      }
    }
    if (users.length < 1000) break;
    page++;
  }
  console.log(`✓ Deleted demo auth users: ${deletedUsers}`);

  const [{ remaining }] = await sql`select count(*)::int as remaining from public.tenants where slug like 'demo-%'`;
  const [{ leads }] = await sql`select count(*)::int as leads from public.demo_sessions`;
  console.log(`\nRemaining demo tenants: ${remaining}`);
  console.log(`demo_sessions lead records kept: ${leads}`);
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
} finally {
  await sql.end();
}
