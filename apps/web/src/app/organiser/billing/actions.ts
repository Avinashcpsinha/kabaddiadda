'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBillingProvider, PLANS, type PlanId } from '@/lib/billing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Start a Razorpay subscription for the user's tenant. Returns a
 * checkout URL that the client navigates to. The webhook later flips
 * `tenants.plan` once Razorpay confirms activation.
 *
 * If the tenant already has an active subscription, returns an error —
 * the UI shows a "Change plan" affordance for that case instead.
 */
export async function subscribeAction(input: { plan: 'pro' }) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  const supabase = await createClient();

  const { data: tenant, error: fetchErr } = await supabase
    .from('tenants')
    .select(
      'id, slug, plan, plan_status, plan_provider, plan_provider_subscription_id, plan_provider_customer_id, contact_email, contact_phone, name',
    )
    .eq('id', user.tenantId)
    .maybeSingle();
  if (fetchErr || !tenant) return { error: 'Tenant not found' };

  if (
    tenant.plan_provider_subscription_id &&
    (tenant.plan_status === 'active' ||
      tenant.plan_status === 'trialing' ||
      tenant.plan_status === 'past_due' ||
      tenant.plan_status === 'cancel_at_period_end')
  ) {
    return { error: 'You already have an active subscription. Use Change plan instead.' };
  }

  const provider = getBillingProvider();
  let session;
  try {
    session = await provider.createCheckoutSession({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      plan: input.plan,
      customerEmail: tenant.contact_email ?? user.email ?? null,
      customerName: tenant.name,
      customerPhone: tenant.contact_phone ?? null,
      successUrl: `${APP_URL}/organiser/billing?subscribed=1`,
      cancelUrl: `${APP_URL}/organiser/billing?cancelled=1`,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to start checkout' };
  }

  // Persist the provider IDs immediately so a webhook delivered before the
  // user lands back on the success URL still finds the right tenant.
  const admin = createAdminClient();
  await admin
    .from('tenants')
    .update({
      plan_provider: provider.id,
      plan_provider_subscription_id: session.subscriptionId,
      plan_provider_customer_id: session.customerId || null,
      // We optimistically set plan_status='free' until the webhook activates it.
    })
    .eq('id', tenant.id);

  return { ok: true, checkoutUrl: session.checkoutUrl };
}

/**
 * Cancel the active subscription. Defaults to "at period end" so the
 * customer keeps access until the renewal date — they paid for it.
 */
export async function cancelSubscriptionAction(input: { atPeriodEnd?: boolean } = {}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan_provider_subscription_id, plan_status')
    .eq('id', user.tenantId)
    .maybeSingle();
  if (!tenant?.plan_provider_subscription_id) {
    return { error: 'No active subscription to cancel' };
  }
  if (tenant.plan_status === 'cancelled' || tenant.plan_status === 'free') {
    return { error: 'Subscription is not active' };
  }

  const provider = getBillingProvider();
  try {
    await provider.cancelSubscription(
      tenant.plan_provider_subscription_id,
      input.atPeriodEnd ?? true,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Cancellation failed' };
  }

  // Reflect the user's intent locally; the webhook will follow up with the
  // canonical state when Razorpay processes the cancellation.
  const admin = createAdminClient();
  await admin
    .from('tenants')
    .update({
      plan_status: input.atPeriodEnd ?? true ? 'cancel_at_period_end' : 'cancelled',
      plan_canceled_at: new Date().toISOString(),
    })
    .eq('id', user.tenantId);

  revalidatePath('/organiser/billing');
  return { ok: true };
}

/**
 * Change the active subscription to a different plan. Razorpay applies
 * the new plan at the next cycle so we don't double-charge mid-period.
 * Local state updates when the resulting webhook arrives.
 */
export async function changePlanAction(input: { plan: PlanId }) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (input.plan === 'enterprise') {
    return { error: 'Enterprise is sales-led — email hello@kabaddiadda.com.' };
  }
  if (input.plan === 'free') {
    return { error: 'To downgrade to Free, cancel your subscription instead.' };
  }
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan_provider_subscription_id, plan')
    .eq('id', user.tenantId)
    .maybeSingle();
  if (!tenant?.plan_provider_subscription_id) {
    return { error: 'No active subscription. Subscribe first.' };
  }
  if (tenant.plan === input.plan) {
    return { error: `You're already on ${PLANS[input.plan].name}.` };
  }

  const target = PLANS[input.plan];
  const envVar = target.providerPlanIdEnvVar;
  const newPlanId = envVar ? process.env[envVar] : null;
  if (!newPlanId) {
    return { error: `No provider plan configured for ${target.name}.` };
  }

  try {
    await getBillingProvider().changeSubscriptionPlan(
      tenant.plan_provider_subscription_id,
      newPlanId,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Plan change failed' };
  }

  revalidatePath('/organiser/billing');
  return { ok: true };
}
