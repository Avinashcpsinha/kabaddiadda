import Link from 'next/link';
import {
  Check,
  Crown,
  Globe,
  Headphones,
  HelpCircle,
  Minus,
  Palette,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, type PlanId } from '@/lib/billing';

export const metadata = {
  title: 'Pricing — every plan, every feature, no surprises',
  description:
    'Free for hobbyists, Pro for active leagues, Enterprise for federations. Compare plans, see every feature, and pick the right tier for your kabaddi league.',
};

// Comparison-table rows. Each row asks: at this tier, what does the user get?
// `value` can be a literal string (rendered as-is), `true` (rendered as a check),
// or `false` (rendered as a dash).
type RowValue = string | boolean;
interface FeatureRow {
  group: string;
  label: string;
  description?: string;
  free: RowValue;
  pro: RowValue;
  enterprise: RowValue;
}

const FEATURES: FeatureRow[] = [
  {
    group: 'Tournaments & teams',
    label: 'Tournaments',
    description: 'Number of tournaments you can run concurrently.',
    free: 'Up to 3',
    pro: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    group: 'Tournaments & teams',
    label: 'Teams',
    description: 'Total registered teams across all your tournaments.',
    free: 'Up to 30',
    pro: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    group: 'Tournaments & teams',
    label: 'Players per team',
    description: 'No cap on roster size at any tier.',
    free: 'Unlimited',
    pro: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    group: 'Tournaments & teams',
    label: 'Tournament formats',
    description: 'League, knockout, group + KO, double-elimination.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Live scoring',
    label: 'Web scoring console',
    description: 'Tap-driven scoring built for tournament operators.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Live scoring',
    label: 'Public live page',
    description: 'Sharable link fans open to follow each match in real time.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Live scoring',
    label: 'Broadcast overlay',
    description: 'OBS-ready overlay strip for streaming the score.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Live scoring',
    label: 'Realtime sync',
    description: 'Public pages update instantly via Supabase realtime.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Stats & reports',
    label: 'Match reports',
    description: 'Per-match score progression, raid logs, defender stats.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Stats & reports',
    label: 'Tournament leaderboards',
    description: 'Standings, top raiders, top defenders, super performers.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Stats & reports',
    label: 'CSV exports',
    description: 'Download every report as CSV for spreadsheets or federation submissions.',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Branding',
    label: 'Public-page branding',
    description: 'Free leagues display under the Kabaddiadda brand.',
    free: 'Kabaddiadda',
    pro: 'Your logo + colour',
    enterprise: 'White-label',
  },
  {
    group: 'Branding',
    label: 'Custom logo',
    description: 'Upload your league logo, shown on every public page.',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Branding',
    label: 'Custom primary colour',
    description: 'Drives accent buttons and highlights on public pages.',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Branding',
    label: 'Hero banner image',
    description: 'Wide image as the backdrop on your league public page.',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Public address',
    label: 'Path-based public page',
    description: 'kabaddiadda.com/t/your-league — works on every plan.',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Public address',
    label: 'Custom subdomain',
    description: 'yourleague.kabaddiadda.com — vanity URL on the platform.',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    group: 'Public address',
    label: 'Custom domain',
    description: 'yourleague.com — your own domain pointed at the platform.',
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    group: 'Broadcast & sponsors',
    label: 'Sponsor / ad slots',
    description: 'Branded slots on the broadcast overlay.',
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    group: 'Broadcast & sponsors',
    label: 'White-label live page',
    description: 'Public live page without Kabaddiadda branding at all.',
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    group: 'Support',
    label: 'Email support',
    description: 'Get help from the team via email.',
    free: 'Best effort',
    pro: 'Priority',
    enterprise: 'SLA-backed',
  },
  {
    group: 'Support',
    label: 'Dedicated CSM',
    description: 'Customer success manager for onboarding and escalations.',
    free: false,
    pro: false,
    enterprise: true,
  },
];

const FAQS = [
  {
    q: 'When am I charged?',
    a: 'On the day you upgrade to Pro, then every month on the same date. Razorpay handles the recurring charge — you can cancel from your billing page any time.',
  },
  {
    q: 'What happens if my payment fails?',
    a: 'Razorpay retries automatically over 4 days. We keep Pro features active during retries so a one-off card decline does not lock you out mid-tournament.',
  },
  {
    q: 'Can I downgrade?',
    a: 'Yes — cancel from your billing page. You keep Pro until the end of the current billing period, then drop to Free. Your data stays; only the gated features turn off.',
  },
  {
    q: 'Do existing tournaments stay accessible if I downgrade past the Free limit?',
    a: 'Yes. The Free 3-tournament cap blocks creating new ones; tournaments you already have keep working.',
  },
  {
    q: 'How is GST handled?',
    a: 'Razorpay computes and adds 18% GST on top of the listed price. The invoice you download from your billing page is GST-compliant.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Not yet. We launched with monthly so the commitment is small. Reach out if you want an annual quote — happy to set one up manually.',
  },
  {
    q: 'How do I get a custom domain (yourleague.com)?',
    a: 'Custom domains are an Enterprise feature because each one needs DNS and cert provisioning we manage with you. Email hello@kabaddiadda.com to start.',
  },
  {
    q: 'Can I trial Pro before paying?',
    a: 'Reach out — we run pilots for established leagues. The Free tier already supports a full 3-tournament season end-to-end, so most organisers can validate the platform without paying.',
  },
];

function renderCell(value: RowValue) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />;
  }
  return <span className="text-sm">{value}</span>;
}

const PLAN_ICONS: Record<PlanId, React.ComponentType<{ className?: string }>> = {
  free: Sparkles,
  pro: Crown,
  enterprise: ShieldCheck,
};

export default function PricingPage() {
  const groups = Array.from(new Set(FEATURES.map((f) => f.group)));

  return (
    <div className="space-y-20 py-16 md:py-24">
      {/* HERO -------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Pricing
          </Badge>
          <h1 className="text-balance font-display text-5xl uppercase leading-none tracking-tight md:text-7xl">
            Simple plans. <span className="text-primary">Real kabaddi.</span>
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            Free for hobbyists running their first tournament. Pro for active league
            organisers. Enterprise for federations and broadcasters. Switch any time —
            your data stays.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="flame" size="lg">
              <Link href="/signup?role=organiser">Start free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#compare">Compare plans</a>
            </Button>
          </div>
        </div>
      </section>

      {/* PLAN CARDS -------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="grid gap-6 lg:grid-cols-3">
          {(['free', 'pro', 'enterprise'] as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const Icon = PLAN_ICONS[id];
            const popular = id === 'pro';
            return (
              <Card
                key={id}
                className={
                  popular
                    ? 'relative border-primary/40 shadow-xl shadow-primary/5'
                    : 'border-border/60'
                }
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default" className="text-[10px]">
                      MOST POPULAR
                    </Badge>
                  </div>
                )}
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                  <div className="pt-2">
                    <span className="font-display text-4xl">{plan.priceLabel}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {plan.priceSubLabel}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {id === 'free' && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/signup?role=organiser">Get started — free</Link>
                    </Button>
                  )}
                  {id === 'pro' && (
                    <Button asChild variant="flame" className="w-full">
                      <Link href="/signup?role=organiser">Start free, upgrade any time</Link>
                    </Button>
                  )}
                  {id === 'enterprise' && (
                    <Button asChild variant="outline" className="w-full">
                      <a href="mailto:hello@kabaddiadda.com?subject=Enterprise%20pricing">
                        Talk to sales
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS ----------------------------------------- */}
      <section className="container mx-auto px-4">
        <h2 className="mb-10 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          What you get
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureBlock
            icon={Tv}
            title="Live scoring built for the operator"
            body="Tap-driven console with raid timer, audio cues, queued actions, and an event log. Public viewers see the same score within a second over realtime."
          />
          <FeatureBlock
            icon={Users}
            title="Tournaments, teams & rosters"
            body="League, knockout, group + KO, and double-elimination formats. Player roles (raider, corner, cover, all-rounder), substitutions, cards, reviews — full PKL ruleset."
          />
          <FeatureBlock
            icon={Sparkles}
            title="Stats that match the broadcast"
            body="Per-match score progression, top raiders, top defenders, super raids and super tackles. Standings update as matches end."
          />
          <FeatureBlock
            icon={Palette}
            title="Branding (Pro+)"
            body="Your logo, primary colour, and hero banner across every public page. Free tier shows Kabaddiadda branding so you can grow into your own identity."
          />
          <FeatureBlock
            icon={Globe}
            title="Public address (Pro+ / Enterprise)"
            body="Path-based URL works on every plan. Vanity subdomain on Pro. Bring your own domain (yourleague.com) on Enterprise."
          />
          <FeatureBlock
            icon={Headphones}
            title="Support that keeps up"
            body="Best-effort email on Free. Priority email on Pro. SLA-backed support and a dedicated success manager on Enterprise."
          />
        </div>
      </section>

      {/* COMPARISON TABLE ------------------------------------------ */}
      <section id="compare" className="container mx-auto px-4">
        <h2 className="mb-2 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          Compare every feature
        </h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">
          Tier-by-tier, what is included and what is not.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                <th className="px-4 py-3 text-center font-medium">Free</th>
                <th className="px-4 py-3 text-center font-medium">
                  <span className="text-primary">Pro</span>
                </th>
                <th className="px-4 py-3 text-center font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <FeatureGroup key={group} group={group} rows={FEATURES.filter((f) => f.group === group)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ -------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <h2 className="mb-2 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          Common questions
        </h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">
          Quick answers — email{' '}
          <a href="mailto:hello@kabaddiadda.com" className="text-primary hover:underline">
            hello@kabaddiadda.com
          </a>{' '}
          if yours is missing.
        </p>
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          {FAQS.map((item) => (
            <Card key={item.q} className="border-border/60">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start gap-2 font-semibold">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item.q}
                </div>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CLOSING CTA ----------------------------------------------- */}
      <section className="container mx-auto px-4">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <h2 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
              Spin up your league in minutes
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Free forever for one league. Upgrade only when you need more tournaments,
              your own branding, or a custom subdomain.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="flame" size="lg">
                <Link href="/signup?role=organiser">Start free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="mailto:hello@kabaddiadda.com?subject=Enterprise%20pricing">
                  Talk to sales
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FeatureGroup({ group, rows }: { group: string; rows: FeatureRow[] }) {
  return (
    <>
      <tr className="border-t border-border/60 bg-muted/20">
        <td
          colSpan={4}
          className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
          {group}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.label} className="border-t border-border/40">
          <td className="px-4 py-3">
            <div className="font-medium">{row.label}</div>
            {row.description && (
              <div className="mt-0.5 text-xs text-muted-foreground">{row.description}</div>
            )}
          </td>
          <td className="px-4 py-3 text-center">{renderCell(row.free)}</td>
          <td className="px-4 py-3 text-center">{renderCell(row.pro)}</td>
          <td className="px-4 py-3 text-center">{renderCell(row.enterprise)}</td>
        </tr>
      ))}
    </>
  );
}

function FeatureBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
