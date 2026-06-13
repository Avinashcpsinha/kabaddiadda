// Remove leftover throwaway tour accounts (tour-<ts>@kabaddiadda.test) and
// their tenants, in case a run was interrupted before its afterAll cleanup.
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
const strays = (data?.users ?? []).filter((u) => /^tour-\d+@kabaddiadda\.test$/.test(u.email || ''));
for (const u of strays) {
  await admin.from('tenants').delete().eq('owner_id', u.id);
  await admin.from('profiles').delete().eq('id', u.id);
  await admin.auth.admin.deleteUser(u.id);
  console.log('deleted', u.email);
}
console.log('strays cleaned:', strays.length);
