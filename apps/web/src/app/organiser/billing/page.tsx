import { Check, CreditCard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Billing' };

const PLANS = [
  {
    name: 'Free',
    tagline: 'For one league, getting started',
    price: '₹0',
    priceSub: 'forever',
    features: [
      'Up to 3 tournaments',
      'Up to 30 teams total',
      'Live scoring (web + public live page)',
      'Basic stats + leaderboard',
      'Kabaddiadda branding',
    ],
    current: true,
  },
  {
    name: 'Pro',
    tagline: 'For active league organisers',
    price: '₹4,999',
    priceSub: 'per month',
    features: [
      'Unlimited tournaments + teams',
      'Custom subdomain (yourleague.kabaddiadda.com)',
      'Custom logo & primary colour',
      'CSV exports of every report',
      'Priority email support',
    ],
    highlight: true,
  },
  {
    name: 'Enterprise',
    tagline: 'For federations & broadcasters',
    price: 'Talk to us',
    priceSub: 'volume pricing',
    features: [
      'Everything in Pro',
      'Custom domain (yourleague.com)',
      'White-label public live page',
      'Sponsor / ad slots on broadcasts',
      'SLA-backed support + dedicated CSM',
    ],
  },
];

export default async function BillingPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  const [tournamentsRes, teamsRes, matchesRes] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Your current plan, usage, and what unlocks at higher tiers.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Phase 5 preview.</span> Plans aren&apos;t
            chargeable yet — every league runs on the Free plan. The pricing below is the planned
            launch lineup. Reach out to{' '}
            <a href="mailto:hello@kabaddiadda.com" className="text-primary hover:underline">
              hello@kabaddiadda.com
            </a>{' '}
            if you need an early Enterprise pilot.
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Tournaments"
            value={tournamentsRes.count ?? 0}
            icon={CreditCard}
            delta="Free: up to 3"
          />
          <StatCard
            label="Teams"
            value={teamsRes.count ?? 0}
            icon={CreditCard}
            delta="Free: up to 30"
          />
          <StatCard
            label="Completed matches"
            value={matchesRes.count ?? 0}
            icon={CreditCard}
            delta="Unlimited on every plan"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plans
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlight
                  ? 'relative border-primary/40 shadow-lg shadow-primary/5'
                  : plan.current
                    ? 'border-emerald-500/30'
                    : ''
              }
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="text-[10px]">
                    POPULAR
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.current && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                <div className="pt-2">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{plan.priceSub}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
