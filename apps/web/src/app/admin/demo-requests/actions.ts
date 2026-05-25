'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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
