'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tenantCreateSchema } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';

type PlanIntent = 'free' | 'pro' | 'enterprise';

export async function createMyTenantAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const slug = rawSlug ? rawSlug : slugify(name);

  // Plan intent — captured here, used only for the post-create redirect.
  // The tenant is always created on plan='free' (the column default); paid
  // plans require the Razorpay flow on /organiser/billing to flip the
  // status to 'active'. We never set plan='pro' optimistically — only the
  // webhook does that, after a successful charge.
  const planRaw = String(formData.get('plan') ?? 'free');
  const plan: PlanIntent =
    planRaw === 'pro' || planRaw === 'enterprise' ? planRaw : 'free';

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

  // Route to the right next step based on the plan choice. Pro lands on
  // billing with intent=pro so the page can highlight the Subscribe button;
  // Enterprise lands on billing too with a "talk to us" intent banner.
  if (plan === 'pro') redirect('/organiser/billing?intent=pro');
  if (plan === 'enterprise') redirect('/organiser/billing?intent=enterprise');
  redirect('/organiser');
}
