/**
 * Provider-agnostic types used by the billing abstraction. The Razorpay
 * implementation translates between these shapes and the Razorpay API;
 * a future Stripe implementation would do the same with Stripe's wire
 * format. Keep these intentionally minimal — only fields we actually
 * read in the UI or actions belong here.
 */
import type { PlanId, PlanStatus } from './plans';

/** Identifier strings used in the `plan_provider` column. */
export type ProviderId = 'razorpay' | 'stripe';

export interface CheckoutSession {
  /** Provider's subscription / order ID — store on the tenant after checkout completes. */
  subscriptionId: string;
  /** Provider's customer ID — store on the tenant. Empty for processors that don't issue one upfront. */
  customerId: string;
  /**
   * Hand-off payload for the client. Razorpay returns a `short_url` we
   * redirect to; Stripe returns a Checkout Session URL. Either way, the
   * client-side action just navigates to this URL.
   */
  checkoutUrl: string;
}

export interface ProviderInvoice {
  providerInvoiceId: string;
  providerSubscriptionId: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface ParsedWebhookEvent {
  /** Provider's event ID (used for idempotency). */
  eventId: string;
  /** Normalised event name — see WEBHOOK_EVENT_TYPES below. */
  type: WebhookEventType;
  /** Subscription ID this event refers to (null for events not tied to a sub). */
  subscriptionId: string | null;
  /** Customer ID this event refers to (null if event doesn't reference one). */
  customerId: string | null;
  /** New plan-status to apply to the tenant after this event. null = no change. */
  resultingPlanStatus: PlanStatus | null;
  /** Updated period_end / renews_at after this event. null = no change. */
  resultingRenewsAt: Date | null;
  /** Invoice payload to upsert into the invoices table. null if no invoice. */
  invoice: ProviderInvoice | null;
  /** Raw event payload, retained for the billing_events log. */
  raw: unknown;
}

export type WebhookEventType =
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.cancelled'
  | 'subscription.completed'
  | 'subscription.halted'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.pending'
  | 'subscription.updated'
  | 'payment.failed'
  | 'unknown';

export interface CreateCheckoutInput {
  tenantId: string;
  tenantSlug: string;
  /** The plan we're starting a subscription for. */
  plan: Exclude<PlanId, 'free' | 'enterprise'>;
  /** Email used to prefill the checkout. */
  customerEmail: string | null;
  /** Display name for the checkout. */
  customerName: string | null;
  /** Phone if available — Razorpay accepts and prefills. */
  customerPhone: string | null;
  /** Where the user is sent after a successful subscription. */
  successUrl: string;
  /** Where the user is sent if they bail out of the checkout. */
  cancelUrl: string;
}

export interface BillingProvider {
  readonly id: ProviderId;

  /** Create a hosted-checkout session and return where to redirect the user. */
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;

  /**
   * Cancel a subscription. `atPeriodEnd=true` keeps access until the next
   * renewal date; false cancels immediately.
   */
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<void>;

  /** Reverse a `cancel_at_period_end` cancellation while still in the active period. */
  resumeSubscription(subscriptionId: string): Promise<void>;

  /**
   * Switch a subscription to a different plan. The provider handles
   * proration. We update local state when the resulting webhook lands.
   */
  changeSubscriptionPlan(
    subscriptionId: string,
    newProviderPlanId: string,
  ): Promise<void>;

  /** List invoices for a subscription, newest first. */
  listInvoices(subscriptionId: string): Promise<ProviderInvoice[]>;

  /**
   * Verify webhook signature against the raw body and decide whether to
   * accept the request. Throws on signature mismatch.
   */
  verifyWebhookSignature(rawBody: string, signature: string | null): void;

  /** Translate a verified webhook payload into our normalised event shape. */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent;
}
