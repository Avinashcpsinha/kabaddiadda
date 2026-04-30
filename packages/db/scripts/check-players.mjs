#!/usr/bin/env node
import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});
try {
  const r = await sql`select count(*) as total from public.players`;
  console.log('Total players:', r[0].total);
  const r2 = await sql`select count(*) as total from public.players p join public.teams t on t.id = p.team_id`;
  console.log('Players with valid team:', r2[0].total);
  const r3 = await sql`select count(*) as total from public.players p join public.tenants te on te.id = p.tenant_id`;
  console.log('Players with valid tenant:', r3[0].total);
  const policies = await sql`
    select policyname, cmd from pg_policies where tablename = 'players' order by policyname
  `;
  console.log('\nplayers RLS policies:');
  console.table(policies);
} finally {
  await sql.end();
}
