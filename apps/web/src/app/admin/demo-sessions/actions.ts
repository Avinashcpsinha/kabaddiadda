'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX } from '@/lib/demo';

type Admin = ReturnType<typeof createAdminClient>;

/** Tear down one demo tenant + its auth user + profile (data cascades on
 *  tenant delete). Safe to call when the tenant/user is already gone. */
async function deleteDemoTenantAndUser(supabase: Admin, tenantId: string | null) {
  if (!tenantId) return;
  const { data: tenant } = await supabase
    .from('tenants')
    .select('owner_id')
    .eq('id', tenantId)
    .maybeSingle();
  // Tenant delete cascades its matches/teams/players/etc (FK ON DELETE CASCADE).
  await supabase.from('tenants').delete().eq('id', tenantId);
  const ownerId = tenant?.owner_id as string | undefined;
  if (ownerId) {
    await supabase.from('profiles').delete().eq('id', ownerId);
    await supabase.auth.admin.deleteUser(ownerId).catch(() => {});
  }
}

const idSchema = z.object({ id: z.string().uuid() });

/** Delete a single demo session lead AND its demo user/tenant. */
export async function deleteDemoSessionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== 'superadmin') return { error: 'Forbidden' };

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Invalid id' };

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from('demo_sessions')
    .select('tenant_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  await deleteDemoTenantAndUser(supabase, (row?.tenant_id as string | null) ?? null);
  const { error } = await supabase.from('demo_sessions').delete().eq('id', parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath('/admin/demo-sessions');
  return { success: 'Deleted.' };
}

/** Purge ALL demo users + tenants now (the nightly cron does this for
 *  expired ones; this is the manual on-demand version). Lead records in
 *  demo_sessions are KEPT — tenant_id just becomes null — so you retain
 *  the "who came" history. */
export async function purgeAllDemoUsersAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'superadmin') return { error: 'Forbidden' };

  const supabase = createAdminClient();
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return { error: listErr.message };

  const demoUsers = list.users.filter(
    (u) => u.email?.startsWith(DEMO_EMAIL_PREFIX) && u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`),
  );

  let deleted = 0;
  for (const u of demoUsers) {
    // Tenant cascade + profile + auth user. tenant_id on demo_sessions is
    // ON DELETE SET NULL, so lead rows survive as history.
    const { error: tenantErr } = await supabase.from('tenants').delete().eq('owner_id', u.id);
    if (tenantErr) continue;
    await supabase.from('profiles').delete().eq('id', u.id);
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (!delErr) deleted++;
  }

  revalidatePath('/admin/demo-sessions');
  return { success: `Purged ${deleted} demo user${deleted === 1 ? '' : 's'}.` };
}
