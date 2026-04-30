'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tenantCreateSchema } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';

export async function createMyTenantAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const slug = rawSlug ? rawSlug : slugify(name);

  const parsed = tenantCreateSchema.safeParse({
    name,
    slug,
    contactEmail: formData.get('contactEmail') || undefined,
    contactPhone: formData.get('contactPhone') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      owner_id: user.id,
      status: 'active',
      contact_email: parsed.data.contactEmail ?? user.email,
      contact_phone: parsed.data.contactPhone,
    })
    .select('id, slug')
    .single();

  if (tenantErr) {
    if (tenantErr.code === '23505') return { error: 'That slug is already taken — try another.' };
    return { error: tenantErr.message };
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ tenant_id: tenant.id })
    .eq('id', user.id);

  if (profileErr) return { error: profileErr.message };

  revalidatePath('/', 'layout');
  redirect('/organiser');
}
