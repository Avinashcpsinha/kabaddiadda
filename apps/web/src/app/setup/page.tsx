'use client';

import * as React from 'react';
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmit } from '@/components/form-submit';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { slugify } from '@/lib/slug';
import { createMyTenantAction } from './actions';

type PlanChoice = 'free' | 'pro' | 'enterprise';

const PLAN_OPTIONS: Array<{
  id: PlanChoice;
  name: string;
  price: string;
  priceSub: string;
  tagline: string;
  highlights: string[];
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    priceSub: 'forever',
    tagline: 'Run your first season',
    highlights: ['Up to 3 tournaments', 'Up to 30 teams', 'Live scoring + public page'],
    icon: Sparkles,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹4,999',
    priceSub: 'per month',
    tagline: 'For active organisers',
    highlights: [
      'Unlimited tournaments + teams',
      'Custom logo + colour',
      'Vanity subdomain',
      'CSV exports',
    ],
    icon: Crown,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Talk to us',
    priceSub: 'volume pricing',
    tagline: 'Federations & broadcasters',
    highlights: [
      'Everything in Pro',
      'Custom domain',
      'White-label live page',
      'SLA-backed support',
    ],
    icon: ShieldCheck,
  },
];

export default function SetupPage() {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [plan, setPlan] = React.useState<PlanChoice>('free');

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function action(fd: FormData) {
    fd.set('plan', plan);
    const res = await createMyTenantAction(fd);
    if (res?.error) toast.error(res.error);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="absolute inset-0 bg-radial-fade" />

      <header className="relative z-10 flex items-center justify-between p-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-3xl items-center px-4 pb-12">
        <Card className="w-full border-border/60 shadow-2xl shadow-primary/5">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 text-primary-foreground shadow-lg shadow-primary/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl">Set up your league</CardTitle>
              <CardDescription>
                Pick a plan and name your league. Your league becomes your public identity
                on Kabaddiadda.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-6">
              {/* PLAN SELECTOR ----------------------------------- */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Choose your plan</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {PLAN_OPTIONS.map((opt) => (
                    <PlanCard
                      key={opt.id}
                      plan={opt}
                      active={plan === opt.id}
                      onSelect={() => setPlan(opt.id)}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan === 'free' &&
                    'Free plan starts immediately — no card needed. Upgrade any time.'}
                  {plan === 'pro' &&
                    'You will be taken to the secure Razorpay checkout right after we create your league.'}
                  {plan === 'enterprise' &&
                    'We will set up your league on Free and our team will reach out to scope the Enterprise plan with you.'}
                </p>
              </fieldset>

              {/* LEAGUE DETAILS --------------------------------- */}
              <div className="space-y-2">
                <Label htmlFor="name">League / organiser name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Bengal Premier Kabaddi"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Public URL slug</Label>
                <div className="flex overflow-hidden rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                  <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
                    kabaddiadda.com/t/
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                    placeholder="bengal-premier"
                    pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                    minLength={2}
                    maxLength={40}
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens. You can change this later.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact email (optional)</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    placeholder="hello@yourleague.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact phone (optional)</Label>
                  <Input id="contactPhone" name="contactPhone" type="tel" placeholder="+91…" />
                </div>
              </div>
              <FormSubmit variant="flame" size="lg" className="w-full">
                {plan === 'pro'
                  ? 'Create league & continue to checkout'
                  : plan === 'enterprise'
                    ? 'Create league & contact us'
                    : 'Create league'}
                <ArrowRight className="h-4 w-4" />
              </FormSubmit>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PlanCard({
  plan,
  active,
  onSelect,
}: {
  plan: (typeof PLAN_OPTIONS)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = plan.icon;
  const popular = plan.id === 'pro';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-all',
        active
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border/60 hover:border-border hover:bg-accent/30',
      )}
    >
      {popular && (
        <Badge variant="default" className="absolute -top-2 right-3 text-[9px]">
          POPULAR
        </Badge>
      )}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">{plan.name}</span>
      </div>
      <div>
        <span className="font-display text-2xl">{plan.price}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">{plan.priceSub}</span>
      </div>
      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      <ul className="space-y-1 text-[11px]">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
