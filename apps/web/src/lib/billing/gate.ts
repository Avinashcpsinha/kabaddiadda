/**
 * Server-side feature gating. Each function returns a string error message
 * if the action is blocked by the tenant's current plan, or null if allowed.
 *
 * Used at the top of server actions that create gated resources (tournaments,
 * teams) and in settings save paths to enforce branding / custom-domain rules.
 *
 * The "effective" plan is computed via `effectivePlan(plan, status)` so a
 * tenant whose subscription has been cancelled (status='cancelled') falls
 * back to free-tier limits even if the `plan` column still reads 'pro'.
 */
import { createClient } from '@/lib/supabase/server';
import { effectivePlan, getPlanLimits, type PlanId, type PlanStatus } from './plans';

interface TenantPlanRow {
  plan: PlanId;
  plan_status: PlanStatus;
}

async function loadTenantPlan(tenantId: string): Promise<TenantPlanRow> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('plan, plan_status')
    .eq('id', tenantId)
    .maybeSingle();
  return {
    plan: (data?.plan ?? 'free') as PlanId,
    plan_status: (data?.plan_status ?? 'free') as PlanStatus,
  };
}

/** Check before creating a new tournament. */
export async function gateTournamentCreate(tenantId: string): Promise<string | null> {
  const { plan, plan_status } = await loadTenantPlan(tenantId);
  const limits = getPlanLimits(effectivePlan(plan, plan_status));
  if (limits.maxTournaments === null) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if ((count ?? 0) >= limits.maxTournaments) {
    return `Free plan is capped at ${limits.maxTournaments} tournaments. Upgrade to Pro for unlimited.`;
  }
  return null;
}

/** Check before creating a new team. */
export async function gateTeamCreate(tenantId: string): Promise<string | null> {
  const { plan, plan_status } = await loadTenantPlan(tenantId);
  const limits = getPlanLimits(effectivePlan(plan, plan_status));
  if (limits.maxTeams === null) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if ((count ?? 0) >= limits.maxTeams) {
    return `Free plan is capped at ${limits.maxTeams} teams. Upgrade to Pro for unlimited.`;
  }
  return null;
}

/**
 * Whether the tenant is allowed to set custom branding (logo + primary
 * colour). When false, settings still accepts the values but the public
 * pages render the default Kabaddiadda branding.
 */
export async function canUseCustomBranding(tenantId: string): Promise<boolean> {
  const { plan, plan_status } = await loadTenantPlan(tenantId);
  return getPlanLimits(effectivePlan(plan, plan_status)).customBranding;
}

/** Whether the tenant can save a custom domain. Enterprise-only. */
export async function canUseCustomDomain(tenantId: string): Promise<boolean> {
  const { plan, plan_status } = await loadTenantPlan(tenantId);
  return getPlanLimits(effectivePlan(plan, plan_status)).customDomain;
}
