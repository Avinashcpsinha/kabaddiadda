import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBillingProvider } from '@/lib/billing';

/**
 * Razorpay webhook receiver. Verifies signature, deduplicates by event ID
 * via `billing_events`, then applies the resulting state to the tenant +
 * inserts an invoice row when the event includes one.
 *
 * Idempotency: every webhook is logged in `billing_events` keyed by
 * (provider, provider_event_id). Duplicate deliveries hit the unique
 * constraint and we skip processing. We always return 200 to Razorpay
 * even on internal errors, so they don't keep retrying — the unprocessed
 * row stays in the table for manual replay.
 *
 * Configuration:
 *   - URL: /api/billing/razorpay/webhook
 *   - Secret: RAZORPAY_WEBHOOK_SECRET env var
 *   - Events to subscribe in Razorpay dashboard:
 *       subscription.activated / charged / cancelled / completed /
 *       halted / paused / resumed / pending / updated, payment.failed
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const eventId = request.headers.get('x-razorpay-event-id') ?? '';

  const provider = getBillingProvider('razorpay');

  try {
    provider.verifyWebhookSignature(rawBody, signature);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bad signature' },
      { status: 401 },
    );
  }

  // Inject the header-derived event ID into the body so the provider parser
  // can surface it via the normalised shape.
  const bodyWithId = eventId
    ? JSON.stringify({ ...JSON.parse(rawBody), id: eventId })
    : rawBody;
  const event = provider.parseWebhookEvent(bodyWithId);

  const admin = createAdminClient();

  // Find the tenant attached to this subscription. Tenants store the
  // subscription ID after createCheckoutSession returns, so this lookup
  // works for every event after the first activation. For pre-subscription
  // events (rare) tenant_id stays null and the row is logged for audit.
  let tenantId: string | null = null;
  if (event.subscriptionId) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('plan_provider_subscription_id', event.subscriptionId)
      .maybeSingle();
    tenantId = tenant?.id ?? null;
  }

  // 1) Idempotency: insert into billing_events; unique constraint on
  // (provider, provider_event_id) makes duplicates a no-op.
  const { data: inserted, error: insertErr } = await admin
    .from('billing_events')
    .insert({
      tenant_id: tenantId,
      provider: 'razorpay',
      provider_event_id: event.eventId,
      event_type: event.type,
      payload: event.raw as never,
    })
    .select('id')
    .maybeSingle();

  // Postgres error code 23505 = unique_violation → duplicate event, already processed.
  if (insertErr && insertErr.code === '23505') {
    return NextResponse.json({ ok: true, deduped: true });
  }
  if (insertErr) {
    // Log + return 200 so Razorpay doesn't retry on something we can't fix automatically.
    console.error('billing_events insert failed', insertErr);
    return NextResponse.json({ ok: false });
  }

  // 2) Apply effects.
  let processingError: string | null = null;
  try {
    if (tenantId) {
      const update: Record<string, unknown> = {};
      if (event.resultingPlanStatus) {
        update.plan_status = event.resultingPlanStatus;
        // Keep `plan` in sync with status: activate sets plan from the
        // provider's plan_id mapping isn't trivial, so we trust the
        // subscribe action to have set `plan` to 'pro' optimistically.
        // Cancellation → drop plan to 'free' so feature gates fall back.
        if (event.resultingPlanStatus === 'cancelled') {
          update.plan = 'free';
        }
        if (event.resultingPlanStatus === 'active' && !update.plan_started_at) {
          update.plan_started_at = new Date().toISOString();
          update.plan = 'pro';
        }
      }
      if (event.resultingRenewsAt) {
        update.plan_renews_at = event.resultingRenewsAt.toISOString();
      }
      if (event.customerId) {
        update.plan_provider_customer_id = event.customerId;
      }
      if (Object.keys(update).length > 0) {
        await admin.from('tenants').update(update).eq('id', tenantId);
      }
    }

    if (tenantId && event.invoice) {
      const inv = event.invoice;
      await admin.from('invoices').upsert(
        {
          tenant_id: tenantId,
          provider: 'razorpay',
          provider_invoice_id: inv.providerInvoiceId,
          provider_subscription_id: inv.providerSubscriptionId,
          amount_minor: inv.amountMinor,
          currency: inv.currency,
          status: inv.status,
          paid_at: inv.paidAt?.toISOString() ?? null,
          period_start: inv.periodStart?.toISOString() ?? null,
          period_end: inv.periodEnd?.toISOString() ?? null,
          hosted_url: inv.hostedUrl,
          pdf_url: inv.pdfUrl,
          raw_payload: event.raw as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider,provider_invoice_id' },
      );
    }
  } catch (e) {
    processingError = e instanceof Error ? e.message : 'Unknown error';
    console.error('webhook processing failed', e);
  }

  // 3) Mark the event as processed (or record the error).
  if (inserted?.id) {
    await admin
      .from('billing_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: processingError,
      })
      .eq('id', inserted.id);
  }

  return NextResponse.json({ ok: !processingError });
}
