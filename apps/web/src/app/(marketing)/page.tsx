import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  ClipboardCheck,
  Crown,
  PlayCircle,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <>
      <Hero />
      <LiveStrip />
      <Features />
      <RolesSection />
      <MobileSection />
      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-[0.05]" />
      <div className="absolute inset-0 bg-radial-fade" />

      <div className="container relative mx-auto px-4 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 border-primary/30 bg-primary/5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-primary">Built for the Kabaddi era</span>
          </Badge>

          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            The home of <span className="gradient-text">Kabaddi</span>,
            <br />
            built for everyone.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            Run tournaments. Score live matches. Follow your team. One platform for organisers,
            players, and fans — on web and mobile.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="flame" size="xl">
              <Link href="/signup?role=organiser">
                Host a tournament
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href="/signup">
                <PlayCircle className="h-4 w-4" />
                Watch live
              </Link>
            </Button>
          </div>

          <div className="mt-14 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <Stat value="1.2M+" label="Match raids tracked" />
            <span className="h-8 w-px bg-border" />
            <Stat value="450+" label="Tournaments hosted" />
            <span className="h-8 w-px bg-border" />
            <Stat value="98%" label="Scorer satisfaction" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs">{label}</div>
    </div>
  );
}

function LiveStrip() {
  const matches = [
    { home: 'Bengal Warriors', away: 'Patna Pirates', score: '34 — 28', status: 'LIVE Q4' },
    { home: 'U Mumba', away: 'Telugu Titans', score: '22 — 19', status: 'LIVE Q3' },
    { home: 'Jaipur Pink Panthers', away: 'Dabang Delhi', score: '14 — 12', status: 'LIVE Q2' },
  ];
  return (
    <section className="border-y border-border/50 bg-secondary/20 py-3">
      <div className="container mx-auto flex items-center gap-6 overflow-x-auto px-4 text-sm">
        <div className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          LIVE NOW
        </div>
        {matches.map((m) => (
          <div key={m.home} className="flex shrink-0 items-center gap-3">
            <span className="text-muted-foreground">{m.home}</span>
            <span className="font-mono font-bold">{m.score}</span>
            <span className="text-muted-foreground">{m.away}</span>
            <Badge variant="live" className="text-[10px]">
              {m.status}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Trophy,
    title: 'Tournament management',
    description:
      'Create leagues, knockouts, and hybrid formats. Auto-generate fixtures, track standings, and publish a branded microsite.',
  },
  {
    icon: Activity,
    title: 'Live scoring',
    description:
      'A scorer console designed for the mat — raid, tackle, super tackle, all-out — with realtime push to fans worldwide.',
  },
  {
    icon: Users,
    title: 'Team & roster',
    description:
      'Register teams, manage rosters, verify eligibility, collect entry fees. KYC for players, captains, and officials.',
  },
  {
    icon: BarChart3,
    title: 'Stats & analytics',
    description:
      'Player performance, team form, head-to-heads, and tournament insights — exportable for media and broadcasters.',
  },
  {
    icon: Calendar,
    title: 'Smart fixtures',
    description:
      'Round-robin, single & double elimination, group + knockout. Venue allocation and conflict detection built in.',
  },
  {
    icon: Smartphone,
    title: 'Native mobile app',
    description:
      'iOS and Android apps for fans, players, and scorers. Offline-first scoring console for venues with poor network.',
  },
];

function Features() {
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Everything Kabaddi needs.
        </h2>
        <p className="mt-3 text-muted-foreground">
          One stack for organisers, players, and fans. No more spreadsheets, no more WhatsApp
          fixtures.
        </p>
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card
            key={f.title}
            className="group relative overflow-hidden border-border/50 transition-all hover:border-primary/30"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 transition-all group-hover:from-primary/5 group-hover:to-transparent" />
            <CardContent className="relative p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RolesSection() {
  const roles = [
    {
      icon: Users,
      title: 'For Fans & Players',
      tagline: 'Follow the game you love',
      points: [
        'Live scores with raid-by-raid commentary',
        'Follow teams, players, and tournaments',
        'Personalised feed and push notifications',
        'Player profiles with career stats',
      ],
      cta: { label: 'Join as a fan', href: '/signup' },
      tone: 'from-blue-500/10 to-blue-500/0 border-blue-500/20',
    },
    {
      icon: Trophy,
      title: 'For Organisers',
      tagline: 'Run tournaments like a pro',
      points: [
        'Tournament wizard — set up in under 10 minutes',
        'Live scoring console for your scorers',
        'Branded microsite & fixture management',
        'Revenue, attendance, and stats reports',
      ],
      cta: { label: 'Host a tournament', href: '/signup?role=organiser' },
      tone: 'from-primary/15 to-primary/0 border-primary/30',
      featured: true,
    },
    {
      icon: Crown,
      title: 'For Federations',
      tagline: 'Govern the sport at scale',
      points: [
        'Tenant management for affiliated organisers',
        'Platform-wide analytics & content moderation',
        'Plans, billing, and compliance dashboards',
        'Audit log of every administrative action',
      ],
      cta: { label: 'Talk to us', href: '/contact' },
      tone: 'from-amber-500/10 to-amber-500/0 border-amber-500/20',
    },
  ];
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Built for everyone in the sport.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Three interfaces, one platform — each tuned for the people who use it.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {roles.map((r) => (
          <Card
            key={r.title}
            className={`relative overflow-hidden bg-gradient-to-b ${r.tone} ${
              r.featured ? 'shadow-2xl shadow-primary/10 md:scale-[1.02]' : ''
            }`}
          >
            {r.featured && (
              <Badge className="absolute right-4 top-4 bg-primary">Most popular</Badge>
            )}
            <CardContent className="space-y-5 p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border/50">
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.tagline}</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant={r.featured ? 'flame' : 'outline'} className="w-full">
                <Link href={r.cta.href}>
                  {r.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MobileSection() {
  return (
    <section className="border-y border-border/50 bg-secondary/10">
      <div className="container mx-auto grid gap-12 px-4 py-24 md:grid-cols-2 md:items-center">
        <div>
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Smartphone className="h-3 w-3" />
            iOS · Android
          </Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Carry the mat in your pocket.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Live scoring works offline. Fans get push notifications the second their team scores.
            Players check fixtures on the way to the venue.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              'Offline-first scoring — sync when you get signal',
              'Real-time push notifications for followed teams',
              'Native iOS + Android, one codebase, fast updates',
              'Same login, same data, same experience as the web',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Button variant="outline" disabled>
              App Store · soon
            </Button>
            <Button variant="outline" disabled>
              Play Store · soon
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="mx-auto aspect-[9/16] max-w-[280px] rounded-[2.5rem] border-8 border-foreground/10 bg-background p-2 shadow-2xl shadow-primary/10">
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-secondary to-background">
              <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/80" />
              <div className="flex h-full flex-col p-4 pt-12">
                <Badge variant="live" className="self-start text-[10px]">
                  ● LIVE · Q3
                </Badge>
                <div className="mt-6 text-center">
                  <div className="text-xs text-muted-foreground">Bengal Warriors</div>
                  <div className="mt-1 text-5xl font-bold tracking-tight">34</div>
                </div>
                <div className="my-3 text-center text-xs text-muted-foreground">vs</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Patna Pirates</div>
                  <div className="mt-1 text-5xl font-bold tracking-tight gradient-text">28</div>
                </div>
                <div className="mt-auto rounded-lg bg-secondary/60 p-3 text-xs">
                  <div className="font-semibold">Pawan Sehrawat</div>
                  <div className="text-muted-foreground">3-point Super Raid · just now</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-12 text-center md:p-16">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to bring your tournament online?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free to start. Pay only when your tournament goes live. No card required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="flame" size="xl">
              <Link href="/signup?role=organiser">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
