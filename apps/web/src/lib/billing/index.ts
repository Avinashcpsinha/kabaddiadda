/**
 * Provider factory. Single entry point for billing operations — server
 * actions and the webhook route both call `getBillingProvider()` to get
 * the configured provider for the deployment. Today that's Razorpay;
 * adding Stripe means adding a Stripe class implementing BillingProvider
 * and adjusting the env-var switch here.
 */
import type { BillingProvider, ProviderId } from './types';
import { RazorpayProvider } from './razorpay';

export function getBillingProvider(provider?: ProviderId): BillingProvider {
  const id =
    provider ??
    ((process.env.BILLING_PROVIDER as ProviderId | undefined) ?? 'razorpay');
  switch (id) {
    case 'razorpay':
      return new RazorpayProvider();
    case 'stripe':
      throw new Error('Stripe billing provider is not implemented yet');
    default:
      throw new Error(`Unknown billing provider: ${id}`);
  }
}

export type { BillingProvider, CheckoutSession, ParsedWebhookEvent } from './types';
export {
  PLANS,
  effectivePlan,
  getPlanLimits,
  isPlanActive,
  type PlanDefinition,
  type PlanId,
  type PlanLimits,
  type PlanStatus,
} from './plans';
