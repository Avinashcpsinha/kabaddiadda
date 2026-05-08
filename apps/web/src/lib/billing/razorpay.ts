import { createHmac, timingSafeEqual } from 'crypto';
import type {
  BillingProvider,
  CheckoutSession,
  CreateCheckoutInput,
  ParsedWebhookEvent,
  ProviderInvoice,
  WebhookEventType,
} from './types';
import type { PlanStatus } from './plans';

/**
 * Razorpay Subscriptions implementation. The Razorpay API is HTTP-only;
 * no SDK is required, which keeps the bundle thin and avoids adding a
 * dependency that pulls in Node-only crypto polyfills on the edge.
 *
 * Auth: Basic <base64(key_id:key_secret)>
 * Docs: https://razorpay.com/docs/api/subscriptions
 *
 * Webhook signatures are HMAC SHA-256 of the raw body using the webhook
 * secret as the key — verified by `verifyWebhookSignature`.
 */
const RAZORPAY_BASE = 'https://api.razorpay.com/v1';

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

function loadConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error(
      'Razorpay env vars missing — set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET',
    );
  }
  return { keyId, keySecret, webhookSecret };
}

async function rzpFetch(
  cfg: RazorpayConfig,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay ${res.status}: ${text}`);
  }
  return res.json();
}

interface RazorpaySubscription {
  id: string;
  customer_id?: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  charge_at?: number | null;
  short_url: string;
  plan_id: string;
}

interface RazorpayInvoice {
  id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: number | null;
  // Razorpay sends invoice period via `billing_start` / `billing_end` on subscription invoices.
  billing_start: number | null;
  billing_end: number | null;
  short_url: string | null;
}

interface RazorpayInvoiceListResponse {
  items: RazorpayInvoice[];
}

interface RazorpayWebhookEnvelope {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscription };
    invoice?: { entity: RazorpayInvoice };
    payment?: { entity: { id: string; status: string; subscription_id?: string | null } };
  };
}

function statusFromRazorpay(status: string): PlanStatus | null {
  switch (status) {
    case 'created':
    case 'authenticated':
    case 'pending':
      return 'free'; // not yet active
    case 'active':
      return 'active';
    case 'paused':
      return 'paused';
    case 'halted':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    case 'completed':
      return 'cancelled'; // term ran out, treat as ended
    case 'expired':
      return 'cancelled';
    default:
      return null;
  }
}

function eventTypeFromRazorpay(event: string): WebhookEventType {
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted':
    case 'subscription.paused':
    case 'subscription.resumed':
    case 'subscription.pending':
    case 'subscription.updated':
    case 'payment.failed':
      return event;
    default:
      return 'unknown';
  }
}

function tsToDate(ts: number | null | undefined): Date | null {
  if (!ts) return null;
  // Razorpay timestamps are seconds since epoch.
  return new Date(ts * 1000);
}

export class RazorpayProvider implements BillingProvider {
  readonly id = 'razorpay' as const;
  private readonly cfg = loadConfig();

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const planId =
      input.plan === 'pro' ? process.env.RAZORPAY_PLAN_PRO_ID : null;
    if (!planId) {
      throw new Error(
        `No Razorpay plan ID configured for tier '${input.plan}'. Set RAZORPAY_PLAN_PRO_ID.`,
      );
    }
    // Razorpay subscription: 12 cycles = 1 year of monthly charges, then auto-renews
    // by creating a new subscription if you call create again. For simplicity we
    // ask for total_count = 120 so the subscription effectively runs 10 years
    // unless the customer cancels.
    const sub = (await rzpFetch(this.cfg, '/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        total_count: 120,
        customer_notify: 1,
        notes: {
          tenant_id: input.tenantId,
          tenant_slug: input.tenantSlug,
        },
        notify_info: {
          notify_email: input.customerEmail ?? undefined,
          notify_phone: input.customerPhone ?? undefined,
        },
      }),
    })) as RazorpaySubscription;
    return {
      subscriptionId: sub.id,
      customerId: sub.customer_id ?? '',
      checkoutUrl: sub.short_url,
    };
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<void> {
    await rzpFetch(this.cfg, `/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancel_at_cycle_end: atPeriodEnd ? 1 : 0 }),
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    // Razorpay only supports resuming a 'paused' subscription via this endpoint.
    // For 'cancel_at_period_end' you can't reverse it via API — the customer
    // must re-subscribe. We surface that limitation in the UI.
    await rzpFetch(this.cfg, `/subscriptions/${subscriptionId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ resume_at: 'now' }),
    });
  }

  async changeSubscriptionPlan(subscriptionId: string, newProviderPlanId: string): Promise<void> {
    await rzpFetch(this.cfg, `/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        plan_id: newProviderPlanId,
        // Schedule the change for the next cycle so the customer isn't double-charged
        // for the current period.
        schedule_change_at: 'cycle_end',
        customer_notify: 1,
      }),
    });
  }

  async listInvoices(subscriptionId: string): Promise<ProviderInvoice[]> {
    const res = (await rzpFetch(
      this.cfg,
      `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=100`,
    )) as RazorpayInvoiceListResponse;
    return res.items.map(this.mapInvoice);
  }

  private mapInvoice(inv: RazorpayInvoice): ProviderInvoice {
    return {
      providerInvoiceId: inv.id,
      providerSubscriptionId: inv.subscription_id,
      amountMinor: inv.amount,
      currency: inv.currency,
      status: inv.status,
      paidAt: tsToDate(inv.paid_at),
      periodStart: tsToDate(inv.billing_start),
      periodEnd: tsToDate(inv.billing_end),
      hostedUrl: inv.short_url,
      pdfUrl: null, // Razorpay doesn't expose a direct PDF URL; short_url is the hosted invoice page.
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): void {
    if (!signature) throw new Error('Missing Razorpay webhook signature header');
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Razorpay webhook signature mismatch');
    }
  }

  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    const env = JSON.parse(rawBody) as RazorpayWebhookEnvelope & { id?: string };
    const type = eventTypeFromRazorpay(env.event);
    const sub = env.payload.subscription?.entity ?? null;
    const inv = env.payload.invoice?.entity ?? null;
    const subscriptionId = sub?.id ?? inv?.subscription_id ?? null;
    const customerId = sub?.customer_id ?? null;
    const resultingPlanStatus =
      type === 'subscription.cancelled' || type === 'subscription.completed'
        ? 'cancelled'
        : type === 'subscription.activated' || type === 'subscription.resumed'
          ? 'active'
          : type === 'subscription.charged'
            ? 'active'
            : type === 'subscription.halted' || type === 'payment.failed'
              ? 'past_due'
              : type === 'subscription.paused'
                ? 'paused'
                : sub
                  ? statusFromRazorpay(sub.status)
                  : null;
    const resultingRenewsAt = sub ? tsToDate(sub.current_end) : null;
    const invoice = inv ? this.mapInvoice(inv) : null;
    return {
      // Razorpay sends the event id in the 'x-razorpay-event-id' HEADER, not the
      // body, so the route handler injects it into the raw body before parsing.
      // We accept both forms: `id` in body (route-injected) or fallback to a
      // composite from event+ts.
      eventId: env.id ?? `${env.event}:${Date.now()}`,
      type,
      subscriptionId,
      customerId,
      resultingPlanStatus,
      resultingRenewsAt,
      invoice,
      raw: env,
    };
  }
}
