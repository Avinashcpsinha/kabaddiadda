import Link from 'next/link';
import { ArrowRight, Calendar, ChevronRight, ExternalLink, Plus, Radio, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export const metadata = { title: 'Fixtures' };

type Status = 'all' | 'scheduled' | 'live' | 'half_time' | 'completed' | 'abandoned';

const FILTERS: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
];

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: Status }>;
}) {
  const params = await searchParams;
  const filter = params.status ?? 'all';

  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  let query = supabase
    .from('matches')
    .select(
      `id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, tournament_id,
       home_team:home_team_id(id, name, short_name, primary_color),
       away_team:away_team_id(id, name, short_name, primary_color),
       tournament:tournament_id(name)`,
    )
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: filter === 'completed' ? false : true })
    .limit(100);

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const [{ data: matches }, { data: tournaments }, { data: allTournaments }] = await Promise.all([
    query,
    supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'completed')
      .order('start_date', { ascending: false, nullsFirst: false }),
    // Full tournament list (incl. completed) so we can group every match
    // — even completed ones — under their parent tournament header.
    supabase
      .from('tournaments')
      .select('id, name, status, start_date, end_date, format')
      .eq('tenant_id', tenantId)
      .order('start_date', { ascending: false, nullsFirst: false }),
  ]);

  // Group matches by tournament_id for the accordion
  const matchesByTournament = new Map<string, MatchRow[]>();
  for (const m of (matches ?? []) as unknown as MatchRow[]) {
    const list = matchesByTournament.get(m.tournament_id) ?? [];
    list.push(m);
    matchesByTournament.set(m.tournament_id, list);
  }
  // Order tournaments by: live first, then any with matches, then the rest
  const tournamentList = (allTournaments ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    format: string;
  }>;
  tournamentList.sort((a, b) => {
    const aLive = a.status === 'live' ? 0 : 1;
    const bLive = b.status === 'live' ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    const aHas = matchesByTournament.has(a.id) ? 0 : 1;
    const bHas = matchesByTournament.has(b.id) ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return (b.start_date ?? '').localeCompare(a.start_date ?? '');
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
          <p className="mt-1 text-muted-foreground">
            Every match across every tournament. Filter by status, click any to manage.
          </p>
        </div>
        {tournaments && tournaments.length > 0 && (
          <form action="/organiser/fixtures/redirect" method="get" className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Schedule in:</span>
            <select
              name="t"
              defaultValue=""
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="" disabled>
                Pick tournament…
              </option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status === 'live' ? ' · LIVE' : ''}
                </option>
              ))}
            </select>
            <Button type="submit" variant="flame" size="sm">
              <Plus className="h-3 w-3" />
              Add fixture
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            asChild
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
          >
            <Link href={f.value === 'all' ? '/organiser/fixtures' : `/organiser/fixtures?status=${f.value}`}>
              {f.label}
            </Link>
          </Button>
        ))}
      </div>

      {tournamentList.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Create a tournament first, then add fixtures inside it."
        />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fixtures match this filter"
          description="Try a different filter or generate fixtures from a tournament."
        />
      ) : (
        <div className="space-y-2">
          {tournamentList.map((t) => {
            const tMatches = matchesByTournament.get(t.id) ?? [];
            // Skip tournaments with no matching matches when a status filter
            // is active so the accordion stays focused.
            if (filter !== 'all' && tMatches.length === 0) return null;
            // Auto-open if there's a live match here OR the user is filtering
            // (so they don't have to re-expand on every filter change).
            const hasLive = tMatches.some(
              (m) => m.status === 'live' || m.status === 'half_time',
            );
            const open = hasLive || filter !== 'all';
            return (
              <TournamentAccordion
                key={t.id}
                tournament={t}
                matches={tMatches}
                open={open}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TournamentAccordion({
  tournament,
  matches,
  open,
}: {
  tournament: {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    format: string;
  };
  matches: MatchRow[];
  open: boolean;
}) {
  const liveCount = matches.filter((m) => m.status === 'live' || m.status === 'half_time').length;
  const upcomingCount = matches.filter((m) => m.status === 'scheduled').length;
  const completedCount = matches.filter((m) => m.status === 'completed').length;

  return (
    <details
      open={open}
      className="group overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-muted/30">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <Trophy className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{tournament.name}</span>
            {tournament.status === 'live' && <Badge variant="live">● LIVE</Badge>}
            {tournament.status === 'completed' && (
              <Badge variant="success" className="text-[10px]">
                COMPLETED
              </Badge>
            )}
            {tournament.status === 'scheduled' && (
              <Badge variant="outline" className="text-[10px]">
                UPCOMING
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span>{matches.length} matches</span>
            {liveCount > 0 && <span className="text-red-500">● {liveCount} live</span>}
            {upcomingCount > 0 && <span>{upcomingCount} upcoming</span>}
            {completedCount > 0 && <span>{completedCount} completed</span>}
            {tournament.start_date && (
              <span>
                {new Date(tournament.start_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {tournament.end_date && (
                  <>
                    {' → '}
                    {new Date(tournament.end_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        {/* Plain Link styled as a button — no onClick handler in a server
            component (Next.js 15 forbids that). The click bubbles to <summary>
            and toggles the accordion, but we're navigating away so the toggle
            is invisible. */}
        <Link
          href={`/organiser/tournaments/${tournament.id}/fixtures`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3 w-3" />
          Add fixture
        </Link>
      </summary>

      {matches.length === 0 ? (
        <div className="border-t border-border/40 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
          No fixtures yet —{' '}
          <Link
            href={`/organiser/tournaments/${tournament.id}/fixtures`}
            className="font-medium text-primary hover:underline"
          >
            schedule one
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-2 border-t border-border/40 p-3">
          {matches.map((m) => (
            <FixtureRow key={m.id} match={m} />
          ))}
        </div>
      )}
    </details>
  );
}

interface MatchRow {
  id: string;
  scheduled_at: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  tournament_id: string;
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  tournament: { name: string | null } | null;
}

function FixtureRow({ match: m }: { match: unknown }) {
  const match = m as MatchRow;
  const home = match.home_team;
  const away = match.away_team;
  if (!home || !away) return null;

  const isLive = match.status === 'live' || match.status === 'half_time';
  const detailHref = `/organiser/tournaments/${match.tournament_id}/matches/${match.id}`;
  const scoreHref = `${detailHref}/scoring`;

  return (
    <Card className="overflow-hidden transition-colors hover:border-primary/40">
      <CardContent className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 p-4">
        {/* Tournament + round + date */}
        <div className="hidden min-w-0 flex-col items-start sm:flex">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {match.tournament?.name ?? 'Tournament'}
          </div>
          <div className="text-xs text-foreground">{match.round ?? 'Match'}</div>
          <div className="text-[10px] text-muted-foreground">
            {new Date(match.scheduled_at).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>

        {/* Teams + score */}
        <div className="flex min-w-0 items-center gap-3">
          <TeamBadge team={home} />
          <div className="font-mono text-lg font-bold tabular-nums">
            {match.home_score}
            <span className="mx-1 text-muted-foreground/50">·</span>
            {match.away_score}
          </div>
          <TeamBadge team={away} />
        </div>

        {/* Status pill */}
        <StatusPill match={match} />

        {/* Actions */}
        <div className="flex gap-1">
          {isLive ? (
            <Button asChild variant="flame" size="sm">
              <Link href={scoreHref}>
                <Radio className="h-3 w-3" />
                Score
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={detailHref}>
                Open
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
          {(isLive || match.status === 'completed') && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/live/${match.id}`} target="_blank" aria-label="Public live page">
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamBadge({
  team,
}: {
  team: { name: string; short_name: string | null; primary_color: string | null };
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <span className="truncate text-sm font-medium">{team.name}</span>
    </div>
  );
}

function StatusPill({ match }: { match: MatchRow }) {
  switch (match.status) {
    case 'live':
      return (
        <Badge variant="live" className="gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          Q{match.current_half} ·{' '}
          {Math.floor(match.clock_seconds / 60)
            .toString()
            .padStart(2, '0')}
          :{(match.clock_seconds % 60).toString().padStart(2, '0')}
        </Badge>
      );
    case 'half_time':
      return <Badge>HALF TIME</Badge>;
    case 'completed':
      return <Badge variant="success">FINAL</Badge>;
    case 'abandoned':
      return <Badge variant="destructive">ABANDONED</Badge>;
    default:
      return <Badge variant="outline">SCHEDULED</Badge>;
  }
}
