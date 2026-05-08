/**
 * Plan catalogue. Single source of truth for plan limits, display data,
 * and which features unlock at which tier. Read everywhere — server actions,
 * billing UI, settings UI, public-page renderers.
 *
 * The provider-side IDs (Razorpay plan ID etc.) live in env vars, not here,
 * so the same code can run against test mode and production with different
 * underlying provider plans.
 */
export type PlanId = 'free' | 'pro' | 'enterprise';

export type PlanStatus =
  | 'free'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancel_at_period_end'
  | 'cancelled'
  | 'paused';

export interface PlanLimits {
  /** Maximum tournaments. null = unlimited. */
  maxTournaments: number | null;
  /** Maximum teams across all tournaments in the tenant. null = unlimited. */
  maxTeams: number | null;
  /** Whether tenant's logo + primary colour render on public pages. */
  customBranding: boolean;
  /** Whether tenant can configure a custom domain. */
  customDomain: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  /** Display price (rendered in UI; not used for charging). */
  priceLabel: string;
  priceSubLabel: string;
  /** Price in INR paise — 4999 INR = 499900 paise. Used for invoice amount. */
  priceMinor: number;
  features: string[];
  limits: PlanLimits;
  /** Razorpay plan ID env var name; null for tiers that aren't auto-subscribable. */
  providerPlanIdEnvVar: 'RAZORPAY_PLAN_PRO_ID' | null;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For one league, getting started',
    priceLabel: '₹0',
    priceSubLabel: 'forever',
    priceMinor: 0,
    features: [
      'Up to 3 tournaments',
      'Up to 30 teams total',
      'Live scoring (web + public live page)',
      'Basic stats + leaderboard',
      'Kabaddiadda branding',
    ],
    limits: {
      maxTournaments: 3,
      maxTeams: 30,
      customBranding: false,
      customDomain: false,
    },
    providerPlanIdEnvVar: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For active league organisers',
    priceLabel: '₹4,999',
    priceSubLabel: 'per month',
    priceMinor: 4999_00,
    features: [
      'Unlimited tournaments + teams',
      'Custom subdomain (yourleague.kabaddiadda.com)',
      'Custom logo & primary colour',
      'CSV exports of every report',
      'Priority email support',
    ],
    limits: {
      maxTournaments: null,
      maxTeams: null,
      customBranding: true,
      customDomain: false,
    },
    providerPlanIdEnvVar: 'RAZORPAY_PLAN_PRO_ID',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For federations & broadcasters',
    priceLabel: 'Talk to us',
    priceSubLabel: 'volume pricing',
    priceMinor: 0,
    features: [
      'Everything in Pro',
      'Custom domain (yourleague.com)',
      'White-label public live page',
      'Sponsor / ad slots on broadcasts',
      'SLA-backed support + dedicated CSM',
    ],
    limits: {
      maxTournaments: null,
      maxTeams: null,
      customBranding: true,
      customDomain: true,
    },
    providerPlanIdEnvVar: null,
  },
};

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLANS[plan].limits;
}

/**
 * Whether a plan is currently providing access. Cancellations stay 'active'
 * (`cancel_at_period_end`) until the period ends, so we treat both as paid.
 * Past-due is intentionally treated as paid — Razorpay retries, and we don't
 * want to lock the customer out the moment a card declines.
 */
export function isPlanActive(plan: PlanId, status: PlanStatus): boolean {
  if (plan === 'free') return true;
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'cancel_at_period_end'
  );
}

/**
 * Resolve the effective plan for gating. If the tenant's status is not
 * providing access (e.g. cancelled), we return 'free' regardless of the
 * `plan` column so feature gates fall back to free-tier limits.
 */
export function effectivePlan(plan: PlanId, status: PlanStatus): PlanId {
  return isPlanActive(plan, status) ? plan : 'free';
}
