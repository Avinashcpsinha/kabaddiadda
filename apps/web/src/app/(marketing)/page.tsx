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
import { HeroSceneBg } from '@/components/hero-scene-bg';
import { AnimatedTagline } from '@/components/animated-tagline';
import { PhoneMockup } from '@/components/phone-mockup';
import { FormSubmit } from '@/components/form-submit';
import { signInAsDemoAction } from '@/app/(auth)/actions';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// Marketing home shows live matches across the platform — public, no auth.
// /live/[matchId] is also public (not in middleware PROTECTED_PREFIXES), so
// anonymous visitors can click through and watch the scoreboard.
export const revalidate = 30;

export default async function HomePage() {
  const session = await getSessionUser();

  // CTAs route to the right place based on whether the visitor is signed in.
  // Without this, a logged-in organiser clicking "Host a tournament" gets
  // bounced to /feed by the middleware (which redirects authed users away
  // from /signup).
  let hostHref = '/signup?role=organiser';
  let hostLabel = 'Host a tournament';
  if (session?.role === 'organiser') {
    hostHref = '/organiser/tournaments/new';
    hostLabel = 'Create tournament';
  } else if (session?.role === 'superadmin') {
    hostHref = '/admin';
    hostLabel = 'Open admin';
  }

  const watchHref = session ? '/feed' : '/signup';
  const fanJoinHref = session ? '/feed' : '/signup';
  const fanJoinLabel = session ? 'Open fan zone' : 'Join as a fan';

  const supabase = await createClient();
  const { data: liveMatches } = await supabase
    .from('matches')
    .select(
      `id, home_score, away_score, current_half, clock_seconds,
       home_team:home_team_id(name, short_name, primary_color),
       away_team:away_team_id(name, short_name, primary_color),
       tournament:tournament_id(name),
       tenant:tenant_id(name, logo_url)`,
    )
    .eq('status', 'live')
    .order('updated_at', { ascending: false })
    .limit(9);

  // Tournaments section: show non-draft tournaments across all leagues, newest
  // first by start date. RLS already hides drafts from anonymous visitors but
  // we filter explicitly so the SQL plan is cleaner.
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(
      `id, slug, name, format, status, start_date, end_date, cover_image,
       tenant:tenant_id(slug, name, logo_url)`,
    )
    .neq('status', 'draft')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(9);

  return (
    <>
      <Hero hostHref={hostHref} hostLabel={hostLabel} watchHref={watchHref} />
      <LiveMatchesSection matches={(liveMatches ?? []) as unknown as LiveMatchCard[]} />
      <TournamentsSection tournaments={(tournaments ?? []) as unknown as TournamentCard[]} />
      <Features />
      <RolesSection
        hostHref={hostHref}
        hostLabel={hostLabel}
        fanJoinHref={fanJoinHref}
        fanJoinLabel={fanJoinLabel}
      />
      <MobileSection />
      <CTA hostHref={hostHref} hostLabel={hostLabel} />
    </>
  );
}

interface LiveMatchCard {
  id: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  home_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  tournament: { name: string } | null;
  tenant: { name: string; logo_url: string | null } | null;
}

interface TournamentCard {
  id: string;
  slug: string;
  name: string;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  tenant: { slug: string; name: string; logo_url: string | null } | null;
}

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + KO',
  double_elimination: 'Double Elim.',
};

const STATUS_VARIANT: Record<string, 'live' | 'default' | 'outline' | 'secondary'> = {
  live: 'live',
  scheduled: 'outline',
  upcoming: 'outline',
  completed: 'secondary',
};

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start ?? end)!);
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function Hero({
  hostHref,
  hostLabel,
  watchHref,
}: {
  hostHref: string;
  hostLabel: string;
  watchHref: string;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Layered backdrop — stadium action photo + radial flame fade + ambient glow */}
      <HeroSceneBg src="/hero/kabaddi-action.jpg" />
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-electric/15 blur-3xl" />

      <div className="container relative mx-auto px-4 py-12 md:py-20 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* LEFT — editorial copy */}
          <div className="lg:col-span-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-electric sm:text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-electric" />
              </span>
              Built for the Kabaddi era
            </div>

            <h1 className="font-display text-balance text-4xl uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-7xl lg:text-8xl xl:text-9xl">
              The home of <span className="gradient-text">Kabaddi</span>,
              <br />
              <span className="text-primary md:text-stroke-flame">reimagined.</span>
            </h1>

            <AnimatedTagline />

            <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10">
              <Button asChild variant="flame" size="xl" className="glow-flame">
                <Link href={hostHref}>
                  {hostLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href={watchHref}>
                  <PlayCircle className="h-4 w-4" />
                  Watch live
                </Link>
              </Button>
              <form action={signInAsDemoAction} className="contents">
                <FormSubmit variant="outline" size="xl">
                  <Sparkles className="h-4 w-4" />
                  Try live scoring (demo)
                </FormSubmit>
              </form>
              <Link
                href="/pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                See pricing →
              </Link>
              <Link
                href="/demo/organiser"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                See how it works →
              </Link>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 md:mt-14 md:gap-6">
              <Stat value="1.2M+" label="Raids tracked" />
              <Stat value="450+" label="Tournaments" />
              <Stat value="98%" label="Scorer satisfaction" />
            </div>
          </div>

          {/* RIGHT — floating Kabaddiadda phone mockup */}
          <div className="lg:col-span-5">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display tabular-stats text-2xl uppercase leading-none text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
        {value}
      </div>
      <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:mt-2 sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function LiveMatchesSection({ matches }: { matches: LiveMatchCard[] }) {
  if (matches.length === 0) {
    return (
      <section className="border-y border-border/50 bg-secondary/20 py-3">
        <div className="container mx-auto flex items-center gap-3 px-4 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
          </span>
          <span className="font-semibold text-muted-foreground">No matches live right now</span>
          <span className="text-muted-foreground">— check back later or browse upcoming fixtures.</span>
        </div>
      </section>
    );
  }

  const [featured, ...rest] = matches;

  return (
    <section className="relative border-y border-border/50 bg-secondary/30 py-10 md:py-14">
      <div className="absolute inset-0 bg-noise opacity-[0.04]" aria-hidden />
      <div className="container relative mx-auto px-4">
        <div className="mb-6 md:mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/10 px-3 py-1">
            <span className="pulse-live h-2 w-2 rounded-full bg-live" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-live sm:text-[11px]">
              Live now
            </span>
          </div>
          <h2 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-4xl md:text-5xl">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}{' '}
            <span className="text-muted-foreground">on the mat</span>
          </h2>
          <p className="mt-2 font-editorial text-sm italic text-muted-foreground md:text-base">
            Tap any card to watch the scoreboard — no signup needed.
          </p>
        </div>

        {/* HERO match — full-width split-color drama */}
        <FeaturedMatchCard match={featured!} />

        {rest.length > 0 && (
          <>
            <h3 className="mb-3 mt-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="pulse-live h-1.5 w-1.5 rounded-full bg-live" />
              Also live now
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((m) => (
                <CompactMatchCard key={m.id} match={m} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FeaturedMatchCard({ match }: { match: LiveMatchCard }) {
  const homeColor = match.home_team?.primary_color ?? '#0052a3';
  const awayColor = match.away_team?.primary_color ?? '#475569';
  return (
    <Link
      href={`/live/${match.id}`}
      className="group relative block overflow-hidden rounded-3xl border border-border/60 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/25"
    >
      {/* Split team-color background — left half home, right half away */}
      <div aria-hidden className="absolute inset-0">
        <div
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ background: `linear-gradient(135deg, ${homeColor}, ${homeColor}cc)` }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/2"
          style={{ background: `linear-gradient(225deg, ${awayColor}, ${awayColor}cc)` }}
        />
        <div className="absolute inset-0 bg-background/40 dark:bg-background/55" />
        <div className="absolute inset-0 bg-noise opacity-30" />
      </div>

      <div className="relative px-5 py-7 md:px-8 md:py-10 lg:py-12">
        <div className="mb-5 flex flex-wrap items-center gap-2 md:gap-3">
          <span className="pulse-live inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 font-display text-[11px] uppercase tracking-wider text-live-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-live-foreground" />
            Live · Q{match.current_half} · {formatClock(match.clock_seconds)}
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/80 md:text-[11px]">
            {match.tournament?.name ?? match.tenant?.name ?? '—'}
          </span>
          <span className="ml-auto hidden font-display text-[11px] uppercase tracking-[0.25em] text-foreground/60 md:inline">
            ◇ Match of the moment
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <FeaturedTeam team={match.home_team} score={match.home_score} />
          <span className="font-display text-3xl uppercase tracking-wider text-foreground/50 md:text-5xl lg:text-6xl">
            vs
          </span>
          <FeaturedTeam team={match.away_team} score={match.away_score} />
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-foreground/15 pt-4 md:mt-8">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-foreground/70 md:text-[11px]">
            <span className="h-1 w-1 rounded-full bg-electric" />
            Tap to watch
          </span>
          <span className="flex items-center gap-1 font-display text-sm uppercase tracking-wider text-foreground transition-transform group-hover:translate-x-1">
            Watch live
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function FeaturedTeam({ team, score }: { team: LiveMatchCard['home_team']; score: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center md:gap-2.5">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xs uppercase tracking-wider text-white shadow-xl md:h-16 md:w-16 md:text-base lg:h-20 lg:w-20 lg:text-lg"
        style={{
          background: team?.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #0052a3)',
        }}
      >
        {team?.short_name ?? '??'}
      </div>
      <div className="line-clamp-1 font-mono text-[9px] uppercase tracking-[0.15em] text-foreground/85 md:text-[11px]">
        {team?.name ?? 'TBD'}
      </div>
      <div className="font-display tabular-stats text-5xl uppercase leading-none text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-7xl lg:text-8xl">
        {score}
      </div>
    </div>
  );
}

function CompactMatchCard({ match }: { match: LiveMatchCard }) {
  return (
    <Link
      href={`/live/${match.id}`}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
    >
      <div className="flex h-0.5 w-full">
        <div
          className="flex-1"
          style={{ background: match.home_team?.primary_color ?? 'hsl(var(--primary))' }}
        />
        <div
          className="flex-1"
          style={{ background: match.away_team?.primary_color ?? 'hsl(var(--electric))' }}
        />
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            {match.tournament?.name ?? match.tenant?.name ?? '—'}
          </span>
          <span className="pulse-live inline-flex shrink-0 items-center gap-1 rounded-full bg-live px-1.5 py-px font-display text-[9px] uppercase tracking-wider text-live-foreground">
            <span className="h-1 w-1 rounded-full bg-live-foreground" />
            Live
          </span>
        </div>

        {/* Horizontal team rows — visually distinct from the featured card */}
        <div className="space-y-1.5">
          <CompactTeamRow team={match.home_team} score={match.home_score} />
          <CompactTeamRow team={match.away_team} score={match.away_score} />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <span className="tabular-stats">
            Q{match.current_half} · {formatClock(match.clock_seconds)}
          </span>
          <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function CompactTeamRow({ team, score }: { team: LiveMatchCard['home_team']; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[8px] uppercase tracking-wider text-white shadow-sm"
        style={{
          background: team?.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #0052a3)',
        }}
      >
        {team?.short_name ?? '??'}
      </div>
      <div className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wider">
        {team?.name ?? 'TBD'}
      </div>
      <div className="font-display tabular-stats text-2xl uppercase leading-none">{score}</div>
    </div>
  );
}

function TournamentsSection({ tournaments }: { tournaments: TournamentCard[] }) {
  if (tournaments.length === 0) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Tournaments
          </h2>
          <p className="mt-3 text-muted-foreground">
            No tournaments published yet — check back soon, or host your own.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5">
            <Trophy className="h-3 w-3 text-primary" />
            <span className="text-primary">Tournaments</span>
          </Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Leagues and tournaments on Kabaddiadda
          </h2>
          <p className="mt-2 text-muted-foreground">
            Tap any card to open the league page — fixtures, standings, teams, and live scoring.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t) => {
          const dateRange = formatDateRange(t.start_date, t.end_date);
          const tenantSlug = t.tenant?.slug;
          const tenantName = t.tenant?.name ?? 'Organiser';
          const href = tenantSlug ? `/t/${tenantSlug}/${t.slug}` : '#';
          const formatLabel = FORMAT_LABEL[t.format] ?? t.format;
          const statusVariant = STATUS_VARIANT[t.status] ?? 'outline';

          return (
            <Link
              key={t.id}
              href={href}
              className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {t.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.cover_image}
                  alt={t.name}
                  className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                  <Trophy className="h-12 w-12 text-primary/40" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Crown className="h-3 w-3 shrink-0" />
                      <span className="truncate">{tenantName}</span>
                    </div>
                    <h3 className="truncate text-base font-semibold">{t.name}</h3>
                  </div>
                  <Badge variant={statusVariant} className="shrink-0 text-[10px] uppercase">
                    {t.status === 'live' ? '● LIVE' : t.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {formatLabel}
                  </span>
                  {dateRange && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {dateRange}
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-3 text-xs">
                  <span className="text-muted-foreground">View league</span>
                  <ArrowRight className="h-3 w-3 text-primary transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TeamSide({
  team,
  score,
  align,
}: {
  team: LiveMatchCard['home_team'];
  score: number;
  align: 'left' | 'right';
}) {
  void align;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-display text-xs uppercase tracking-wider text-white shadow-lg"
        style={{
          background: team?.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #0052a3)',
        }}
      >
        {team?.short_name ?? '??'}
      </div>
      <div className="line-clamp-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {team?.name ?? 'TBD'}
      </div>
      <div className="font-display tabular-stats text-4xl uppercase leading-none">{score}</div>
    </div>
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

function RolesSection({
  hostHref,
  hostLabel,
  fanJoinHref,
  fanJoinLabel,
}: {
  hostHref: string;
  hostLabel: string;
  fanJoinHref: string;
  fanJoinLabel: string;
}) {
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
      cta: { label: fanJoinLabel, href: fanJoinHref },
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
      cta: { label: hostLabel, href: hostHref },
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
          {/* Phone-frame mockup of the Kabaddiadda mobile live-match screen.
              Pure CSS approximation — proportions and content match what the
              real app renders, but every "screenshot" is hand-built. The
              caveat note below the mockup is intentional: we don't claim it
              is a real screenshot. Replace with an Image when an actual
              screenshot lands in /public/mobile/. */}
          <div
            aria-label="Kabaddiadda mobile app — live match screen"
            className="relative mx-auto aspect-[9/19] w-full max-w-[300px] rounded-[3rem] bg-neutral-900 p-[10px] shadow-[0_30px_80px_-20px_rgba(0,82,163,0.45)] ring-1 ring-black/40"
          >
            {/* Side buttons — purely cosmetic, sells the phone illusion */}
            <div className="absolute left-[-3px] top-24 h-12 w-[3px] rounded-l-full bg-neutral-800" />
            <div className="absolute left-[-3px] top-40 h-16 w-[3px] rounded-l-full bg-neutral-800" />
            <div className="absolute right-[-3px] top-32 h-20 w-[3px] rounded-r-full bg-neutral-800" />

            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.4rem] bg-background">
              {/* Dynamic-island / camera notch */}
              <div className="absolute left-1/2 top-2 z-20 flex h-6 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-neutral-900">
                <div className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
              </div>

              {/* iOS status bar — time + signal + battery */}
              <div className="z-10 flex items-center justify-between px-5 pt-3 text-[9px] font-semibold text-foreground">
                <span className="font-mono">9:41</span>
                <span className="flex items-center gap-1 opacity-80">
                  <span className="flex items-end gap-0.5">
                    <span className="h-1 w-0.5 rounded-sm bg-foreground" />
                    <span className="h-1.5 w-0.5 rounded-sm bg-foreground" />
                    <span className="h-2 w-0.5 rounded-sm bg-foreground" />
                    <span className="h-2.5 w-0.5 rounded-sm bg-foreground" />
                  </span>
                  <span className="font-mono text-[8px]">5G</span>
                  <span className="flex h-2 w-4 items-center rounded-[2px] border border-foreground/80 px-px">
                    <span className="h-full w-full rounded-[1px] bg-foreground" />
                  </span>
                </span>
              </div>

              {/* App header — small Kabaddiadda wordmark + screen title */}
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <div className="font-display text-[11px] uppercase tracking-[0.15em] text-foreground">
                  Kabaddi Adda
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                  <span className="text-[8px] font-bold text-muted-foreground">A</span>
                </div>
              </div>
              <div className="border-t border-border/50" />

              {/* Body — Live tab content */}
              <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
                {/* LIVE pill row */}
                <div className="flex items-center gap-2">
                  <Badge variant="live" className="text-[9px]">
                    ● LIVE
                  </Badge>
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
                    Q1 · 26:57
                  </span>
                  <span className="ml-auto rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-semibold">
                    RAID 09
                  </span>
                </div>

                {/* Match card */}
                <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                  {/* Tournament label */}
                  <div className="mb-2 flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Pro Kabaddi Cup 2026 · Round 4
                  </div>

                  {/* Team rows */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[#003d7a] text-[9px] font-bold text-white shadow-sm">
                        DBW
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold leading-tight">
                          Darbar Warriors
                        </div>
                        <div className="text-[9px] text-muted-foreground">Home</div>
                      </div>
                      <div className="font-mono text-2xl font-bold tabular-nums">4</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] text-[9px] font-bold text-white shadow-sm">
                        MSK
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold leading-tight">
                          Maheshwari Super Kings
                        </div>
                        <div className="text-[9px] text-muted-foreground">Away</div>
                      </div>
                      <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                        7
                      </div>
                    </div>
                  </div>

                  {/* On-mat dots row */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[9px]">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">DBW</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        ))}
                        {[1, 2, 3, 4].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        ))}
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      </div>
                      <span className="text-muted-foreground">MSK</span>
                    </div>
                  </div>
                </div>

                {/* Latest action */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-primary">
                    <Zap className="h-2.5 w-2.5" />
                    Latest action
                  </div>
                  <div className="text-[10px] font-semibold leading-tight">
                    Pavan #9 dives in, taps Lalu #77
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground">
                    MSK +1 · just now
                  </div>
                </div>

                {/* Push notification preview */}
                <div className="mt-auto rounded-xl bg-neutral-900/95 p-2.5 text-white shadow-lg shadow-black/20">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary text-[7px] font-bold">
                      KA
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                      Kabaddi Adda
                    </span>
                    <span className="ml-auto text-[8px] opacity-50">now</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold leading-tight">
                    Super Raid! MSK 3-point sweep
                  </div>
                  <div className="text-[9px] opacity-70">Pavan brings home 3 — MSK 7, DBW 4</div>
                </div>
              </div>

              {/* Bottom tab bar */}
              <div className="flex shrink-0 items-center justify-around border-t border-border/50 bg-background/95 px-2 pb-4 pt-1.5">
                {[
                  { label: 'Feed', active: false },
                  { label: 'Live', active: true },
                  { label: 'Teams', active: false },
                  { label: 'Profile', active: false },
                ].map((t) => (
                  <div
                    key={t.label}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-2 py-1 text-[8px] font-medium',
                      t.active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'h-1 w-1 rounded-full',
                        t.active ? 'bg-primary' : 'bg-muted-foreground/40',
                      )}
                    />
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-1 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/60" />
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Illustrative — final UI may vary
          </p>
        </div>
      </div>
    </section>
  );
}

function CTA({ hostHref, hostLabel }: { hostHref: string; hostLabel: string }) {
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
              <Link href={hostHref}>
                {hostLabel}
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
