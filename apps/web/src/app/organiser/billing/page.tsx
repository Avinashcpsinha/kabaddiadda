import { AlertCircle, Check, CheckCircle2, CreditCard, Download, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PLANS, effectivePlan, type PlanId, type PlanStatus } from '@/lib/billing';
import { SubscribeButton, CancelButton, ChangePlanButton } from './billing-client';

export const metadata = { title: 'Billing' };

const STATUS_LABEL: Record<PlanStatus, { label: string; tone: 'success' | 'warn' | 'muted' | 'danger' }> = {
  free: { label: 'Free', tone: 'muted' },
  active: { label: 'Active', tone: 'success' },
  trialing: { label: 'Trialing', tone: 'success' },
  past_due: { label: 'Payment failed — retrying', tone: 'warn' },
  cancel_at_period_end: { label: 'Cancelling at period end', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  paused: { label: 'Paused', tone: 'warn' },
};

function formatINR(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN')}`;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; cancelled?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  const [tenantRes, tournamentsRes, teamsRes, matchesRes, invoicesRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('plan, plan_status, plan_started_at, plan_renews_at, plan_canceled_at, plan_provider')
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed'),
    supabase
      .from('invoices')
      .select('id, amount_minor, currency, status, paid_at, period_start, period_end, hosted_url')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(24),
  ]);

  const tenant = tenantRes.data;
  const currentPlan: PlanId = (tenant?.plan ?? 'free') as PlanId;
  const currentStatus: PlanStatus = (tenant?.plan_status ?? 'free') as PlanStatus;
  const effective = effectivePlan(currentPlan, currentStatus);
  const planDef = PLANS[effective];
  const statusInfo = STATUS_LABEL[currentStatus];

  const tournamentsCount = tournamentsRes.count ?? 0;
  const teamsCount = teamsRes.count ?? 0;
  const matchesCount = matchesRes.count ?? 0;
  const invoices = invoicesRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Your current plan, usage, and invoices.
        </p>
      </div>

      {params.subscribed && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Thanks — your subscription is being activated. It will reflect here within a minute.
        </div>
      )}
      {params.cancelled && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          Checkout cancelled — no charges made.
        </div>
      )}

      {/* CURRENT PLAN ----------------------------------------------- */}
      <section>
        <Card
          className={
            statusInfo.tone === 'warn'
              ? 'border-amber-500/30'
              : statusInfo.tone === 'danger'
                ? 'border-destructive/40'
                : effective !== 'free'
                  ? 'border-primary/40'
                  : ''
          }
        >
          <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current plan
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-bold">{planDef.name}</h2>
                <Badge
                  variant={statusInfo.tone === 'success' ? 'default' : 'outline'}
                  className={
                    statusInfo.tone === 'warn'
                      ? 'border-amber-500/40 text-amber-600'
                      : statusInfo.tone === 'success'
                        ? ''
                        : 'text-muted-foreground'
                  }
                >
                  {statusInfo.label}
                </Badge>
              </div>
              {tenant?.plan_renews_at && currentStatus === 'active' && (
                <p className="text-xs text-muted-foreground">
                  Renews on {new Date(tenant.plan_renews_at).toLocaleDateString('en-IN')}
                </p>
              )}
              {tenant?.plan_renews_at && currentStatus === 'cancel_at_period_end' && (
                <p className="text-xs text-amber-600">
                  Pro access ends on {new Date(tenant.plan_renews_at).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              {currentPlan === 'free' && <SubscribeButton plan="pro" />}
              {currentPlan === 'pro' &&
                (currentStatus === 'active' || currentStatus === 'past_due') && (
                  <CancelButton />
                )}
              {currentPlan === 'pro' && currentStatus === 'cancel_at_period_end' && (
                <p className="text-xs text-muted-foreground">
                  To reactivate, subscribe again after the current period ends.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* USAGE ------------------------------------------------------ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Tournaments"
            value={tournamentsCount}
            icon={CreditCard}
            delta={
              planDef.limits.maxTournaments === null
                ? 'Unlimited'
                : `${planDef.name}: up to ${planDef.limits.maxTournaments}`
            }
          />
          <StatCard
            label="Teams"
            value={teamsCount}
            icon={CreditCard}
            delta={
              planDef.limits.maxTeams === null
                ? 'Unlimited'
                : `${planDef.name}: up to ${planDef.limits.maxTeams}`
            }
          />
          <StatCard
            label="Completed matches"
            value={matchesCount}
            icon={CreditCard}
            delta="Unlimited on every plan"
          />
        </div>
      </section>

      {/* PLANS GRID ------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plans
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {(['free', 'pro', 'enterprise'] as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const isCurrent = effective === id;
            const isUpgrade = id === 'pro' && currentPlan === 'free';
            return (
              <Card
                key={plan.id}
                className={
                  isCurrent
                    ? 'border-emerald-500/40'
                    : id === 'pro'
                      ? 'relative border-primary/40 shadow-lg shadow-primary/5'
                      : ''
                }
              >
                {id === 'pro' && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default" className="text-[10px]">
                      POPULAR
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                  <div className="pt-2">
                    <span className="text-2xl font-bold">{plan.priceLabel}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{plan.priceSubLabel}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isUpgrade && <SubscribeButton plan="pro" />}
                  {!isCurrent && id === 'pro' && currentPlan === 'enterprise' && (
                    <ChangePlanButton plan="pro" label="Switch to Pro" />
                  )}
                  {id === 'enterprise' && currentPlan !== 'enterprise' && (
                    <a
                      href="mailto:hello@kabaddiadda.com?subject=Enterprise%20pricing"
                      className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Talk to sales
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* INVOICES --------------------------------------------------- */}
      {invoices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invoices
          </h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Paid on</th>
                    <th className="px-4 py-3 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/30 last:border-0">
                      <td className="px-4 py-3">
                        {inv.period_start && inv.period_end
                          ? `${new Date(inv.period_start).toLocaleDateString('en-IN')} – ${new Date(inv.period_end).toLocaleDateString('en-IN')}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono">{formatINR(inv.amount_minor)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            inv.status === 'paid'
                              ? 'border-emerald-500/40 text-emerald-500'
                              : inv.status === 'pending' || inv.status === 'issued'
                                ? 'border-amber-500/40 text-amber-600'
                                : 'text-muted-foreground'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.hosted_url ? (
                          <a
                            href={inv.hosted_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Download className="h-3 w-3" />
                            Open
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
