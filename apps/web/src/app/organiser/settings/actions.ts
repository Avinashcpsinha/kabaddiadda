'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canUseCustomBranding, canUseCustomDomain } from '@/lib/billing/gate';

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
  const customDomainInput = String(formData.get('customDomain') ?? '').trim() || null;
  const primaryColor = String(formData.get('primaryColor') ?? '').trim() || null;
  const tagline = String(formData.get('tagline') ?? '').trim() || null;
  const heroImageUrl = String(formData.get('heroImageUrl') ?? '').trim() || null;
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null;
  const contactPhone = String(formData.get('contactPhone') ?? '').trim() || null;

  // Plan-gated fields. We accept the form submission either way (so the user
  // can still save other fields) but silently drop branding/custom-domain
  // values if their plan doesn't include them. The settings UI shows a
  // "(Pro / Enterprise)" hint so this isn't a surprise.
  const allowBranding = await canUseCustomBranding(user.tenantId);
  const allowCustomDomain = await canUseCustomDomain(user.tenantId);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('tenants')
    .select('branding, logo_url, custom_domain')
    .eq('id', user.tenantId)
    .maybeSingle();

  // Existing branding stays untouched on Free; new submissions for branding
  // fields are dropped. This keeps the value in the DB so it activates
  // automatically when the tenant upgrades — the alternative (wiping it on
  // every Free save) would force re-entry after every upgrade.
  const existingBranding = (existing?.branding as Record<string, unknown> | null) ?? {};
  const branding = allowBranding
    ? {
        ...existingBranding,
        primaryColor: primaryColor ?? undefined,
        tagline: tagline ?? undefined,
        heroImageUrl: heroImageUrl ?? undefined,
      }
    : { ...existingBranding, tagline: tagline ?? undefined };
  const logoUrlToSave = allowBranding ? logoUrl : (existing?.logo_url ?? null);
  const customDomainToSave = allowCustomDomain ? customDomainInput : (existing?.custom_domain ?? null);

  const { error } = await supabase
    .from('tenants')
    .update({
      name,
      logo_url: logoUrlToSave,
      custom_domain: customDomainToSave,
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
