'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function updateTenantSettingsAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user?.tenantId) {
    redirect('/organiser/settings?error=not-authorised');
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/organiser/settings?error=name-required');
  }

  const logoUrl = String(formData.get('logoUrl') ?? '').trim() || null;
  const customDomain = String(formData.get('customDomain') ?? '').trim() || null;
  const primaryColor = String(formData.get('primaryColor') ?? '').trim() || null;
  const tagline = String(formData.get('tagline') ?? '').trim() || null;
  const heroImageUrl = String(formData.get('heroImageUrl') ?? '').trim() || null;
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null;
  const contactPhone = String(formData.get('contactPhone') ?? '').trim() || null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('tenants')
    .select('branding')
    .eq('id', user.tenantId)
    .maybeSingle();

  // Spread existing branding then overwrite — use undefined to delete a key
  // when the user clears the field, so old values don't leak through.
  const branding = {
    ...((existing?.branding as Record<string, unknown> | null) ?? {}),
    primaryColor: primaryColor ?? undefined,
    tagline: tagline ?? undefined,
    heroImageUrl: heroImageUrl ?? undefined,
  };

  const { error } = await supabase
    .from('tenants')
    .update({
      name,
      logo_url: logoUrl,
      custom_domain: customDomain,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      branding,
    })
    .eq('id', user.tenantId);

  if (error) {
    redirect(`/organiser/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/organiser/settings');
  revalidatePath('/organiser', 'layout');
  redirect('/organiser/settings?saved=1');
}
