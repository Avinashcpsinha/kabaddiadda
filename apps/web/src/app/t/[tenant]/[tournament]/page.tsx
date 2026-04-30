import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  IndianRupee,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League — round-robin',
  knockout: 'Knockout — single elimination',
  group_knockout: 'Group + Knockout',
  double_elimination: 'Double elimination',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; tournament: string }>;
}) {
  const { tenant, tournament } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from('tournaments')
    .select('name, description, tenants!inner(slug, name)')
    .eq('slug', tournament)
    .eq('tenants.slug', tenant)
    .neq('status', 'draft')
    .maybeSingle();
  if (!t) return { title: 'Tournament not found' };
  return {
    title: t.name,
    description: t.description ?? `${t.name} — live on Kabaddiadda.`,
  };
}

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tenant: string; tournament: string }>;
}) {
  const { tenant: tenantSlug, tournament: tournamentSlug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, branding')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .maybeSingle();
  if (!tenant) notFound();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(
      'id, name, slug, description, format, status, start_date, end_date, max_teams, prize_pool, cover_image',
    )
    .eq('tenant_id', tenant.id)
    .eq('slug', tournamentSlug)
    .neq('status', 'draft')
    .maybeSingle();
  if (!tournament) notFound();

  const [{ data: teams }, { data: matches }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, short_name, city, primary_color')
      .eq('tournament_id', tournament.id)
      .order('name'),
    supabase
      .from('matches')
      .select(
        'id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
      )
      .eq('tournament_id', tournament.id)
      .order('scheduled_at', { ascending: false }),
  ]);

  const liveMatches = (matches ?? []).filter((m) => m.status === 'live');
  const upcomingMatches = (matches ?? [])
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const completedMatches = (matches ?? [])
    .filter((m) => m.status === 'completed')
    .slice(0, 10);

  const branding = (tenant.branding as { primaryColor?: string; tagline?: string } | null) ?? null;
  const brandColor = branding?.primaryColor ?? null;

  return (
    <div
      className="min-h-screen bg-background"
      style={brandColor ? ({ ['--brand-primary' as string]: brandColor } as React.CSSProperties) : undefined}
    >
      <Hero tenant={tenant} tournament={tournament} brandColor={brandColor} />

      <section className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Teams</CardTitle>
                <Badge variant="outline">{teams?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent>
                {!teams || teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No teams have registered yet. Check back soon.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {teams.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={{
                            background: t.primary_color
                              ? `linear-gradient(135deg, ${t.primary_color}, ${t.primary_color}cc)`
                              : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
                          }}
                        >
                          {t.short_name || initials(t.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          {t.city && (
                            <div className="text-xs text-muted-foreground">{t.city}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {liveMatches.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    Live now
                  </CardTitle>
                  <Badge variant="live">{liveMatches.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/40">
                    {liveMatches.map((m) => (
                      <FixtureRow key={m.id} match={m} variant="live" brandColor={brandColor} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Upcoming fixtures</CardTitle>
                <Badge variant="outline">{upcomingMatches.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {upcomingMatches.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">
                    No matches scheduled yet — check back soon.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {upcomingMatches.map((m) => (
                      <FixtureRow key={m.id} match={m} variant="upcoming" brandColor={brandColor} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {completedMatches.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent results</CardTitle>
                  <Badge variant="outline">{completedMatches.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/40">
                    {completedMatches.map((m) => (
                      <FixtureRow key={m.id} match={m} variant="completed" brandColor={brandColor} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hosted by</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {tenant.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tenant.logo_url}
                      alt={tenant.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 font-bold text-white">
                      <Crown className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">
                      kabaddiadda.com/t/{tenant.slug}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow icon={Trophy} label="Format" value={FORMAT_LABEL[tournament.format] ?? tournament.format} />
                {tournament.start_date && (
                  <DetailRow
                    icon={Calendar}
                    label="Dates"
                    value={`${new Date(tournament.start_date).toLocaleDateString()}${
                      tournament.end_date ? ` → ${new Date(tournament.end_date).toLocaleDateString()}` : ''
                    }`}
                  />
                )}
                {tournament.max_teams && (
                  <DetailRow
                    icon={Users}
                    label="Capacity"
                    value={`${teams?.length ?? 0} / ${tournament.max_teams} teams`}
                  />
                )}
                {tournament.prize_pool && (
                  <DetailRow
                    icon={IndianRupee}
                    label="Prize pool"
                    value={`₹${tournament.prize_pool.toLocaleString('en-IN')}`}
                  />
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        Powered by{' '}
        <Link href="/" className="font-semibold text-foreground hover:underline">
          Kabaddiadda
        </Link>
      </footer>
    </div>
  );
}

function Hero({
  tenant,
  tournament,
  brandColor,
}: {
  tenant: { name: string; slug: string };
  tournament: {
    name: string;
    description: string | null;
    status: string;
    cover_image: string | null;
  };
  brandColor: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 bg-grid opacity-[0.05]" />
      <div className="absolute inset-0 bg-radial-fade" />
      {tournament.cover_image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${tournament.cover_image})` }}
        />
      )}
      {brandColor && !tournament.cover_image && (
        <div
          className="absolute inset-0 opacity-15"
          style={{ background: `linear-gradient(135deg, ${brandColor}, transparent 60%)` }}
        />
      )}

      <div className="container relative mx-auto px-4 py-20">
        <Link
          href={`/t/${tenant.slug}`}
          className="text-sm hover:text-foreground"
          style={{ color: brandColor ?? undefined }}
        >
          ← {tenant.name}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{tournament.name}</h1>
          <StatusBadge status={tournament.status} />
        </div>
        {tournament.description && (
          <p className="mt-4 max-w-2xl text-muted-foreground">{tournament.description}</p>
        )}
      </div>
    </section>
  );
}

interface FixtureMatch {
  id: string;
  scheduled_at: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
}

function FixtureRow({
  match,
  variant,
  brandColor,
}: {
  match: FixtureMatch;
  variant: 'live' | 'upcoming' | 'completed';
  brandColor: string | null;
}) {
  // @ts-expect-error supabase nested join
  const home = match.home_team as FixtureMatch['home_team'];
  // @ts-expect-error supabase nested join
  const away = match.away_team as FixtureMatch['away_team'];
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  const scheduled = new Date(match.scheduled_at);

  return (
    <li>
      <Link
        href={`/live/${match.id}`}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
      >
        {/* Home team */}
        <div className="flex items-center gap-3 min-w-0">
          <TeamBadge team={home} />
          <div className="min-w-0">
            <div className={`truncate text-sm ${variant === 'completed' && homeWon ? 'font-semibold' : 'font-medium'}`}>
              {home?.name ?? 'TBD'}
            </div>
            {match.round && variant !== 'completed' && (
              <div className="text-[10px] text-muted-foreground">{match.round}</div>
            )}
          </div>
        </div>

        {/* Center cell — score / time / VS */}
        <div className="flex flex-col items-center gap-0.5 px-2 text-center">
          {variant === 'live' && (
            <>
              <div className="font-mono text-base font-bold tabular-nums">
                <span className={homeWon ? 'text-foreground' : 'text-muted-foreground'}>{match.home_score}</span>
                <span className="text-muted-foreground/40 mx-1">·</span>
                <span className={awayWon ? 'text-foreground' : 'text-muted-foreground'}>{match.away_score}</span>
              </div>
              <Badge variant="live" className="text-[9px]">
                ● Q{match.current_half}
              </Badge>
            </>
          )}
          {variant === 'completed' && (
            <>
              <div className="font-mono text-base font-bold tabular-nums">
                <span className={homeWon ? 'text-foreground' : 'text-muted-foreground'}>{match.home_score}</span>
                <span className="text-muted-foreground/40 mx-1">·</span>
                <span className={awayWon ? 'text-foreground' : 'text-muted-foreground'}>{match.away_score}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">FT</span>
            </>
          )}
          {variant === 'upcoming' && (
            <>
              <div className="text-xs font-medium" style={{ color: brandColor ?? undefined }}>
                {scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center justify-end gap-3 min-w-0">
          <div className="min-w-0 text-right">
            <div className={`truncate text-sm ${variant === 'completed' && awayWon ? 'font-semibold' : 'font-medium'}`}>
              {away?.name ?? 'TBD'}
            </div>
            {match.round && variant !== 'completed' && (
              <div className="text-[10px] text-muted-foreground">{match.round}</div>
            )}
          </div>
          <TeamBadge team={away} />
          <ArrowRight className="ml-1 h-3 w-3 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}

function TeamBadge({ team }: { team: FixtureMatch['home_team'] }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
      style={{
        background: team?.primary_color
          ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
          : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
      }}
    >
      {team?.short_name ?? '??'}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return (
        <Badge variant="live" className="text-xs">
          ● LIVE
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="success" className="text-xs">
          COMPLETED
        </Badge>
      );
    case 'registration':
      return <Badge>REGISTRATION OPEN</Badge>;
    default:
      return null;
  }
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
