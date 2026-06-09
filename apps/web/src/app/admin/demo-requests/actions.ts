'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX } from '@/lib/demo';

const DEMO_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(DEMO_STATUSES),
  admin_note: z.string().max(2000).optional().or(z.literal('')),
});

export async function updateDemoRequestAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== 'superadmin') {
    return { error: 'Forbidden' };
  }

  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    admin_note: formData.get('admin_note') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('demo_requests')
    .update({
      status: parsed.data.status,
      admin_note: parsed.data.admin_note || null,
    })
    .eq('id', parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath('/admin/demo-requests');
  return { success: 'Updated.' };
}

/**
 * Purge all throwaway demo sandboxes now — deletes every demo tenant +
 * demo auth user + profile (the nightly cron does this for expired ones).
 * Lead records in demo_requests are KEPT: they live outside the demo
 * tenant, so the instant-demo leads (source='instant') survive. This only
 * clears the ephemeral demo accounts/data clutter.
 */
export async function purgeDemoSandboxesAction() {
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
    const { error: tenantErr } = await supabase.from('tenants').delete().eq('owner_id', u.id);
    if (tenantErr) continue;
    await supabase.from('profiles').delete().eq('id', u.id);
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (!delErr) deleted++;
  }

  revalidatePath('/admin/demo-requests');
  return { success: `Purged ${deleted} demo sandbox${deleted === 1 ? '' : 'es'} (leads kept).` };
}
