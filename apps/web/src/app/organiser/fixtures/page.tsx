import Link from 'next/link';
import { ArrowRight, Calendar, ExternalLink, Radio } from 'lucide-react';
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

  const { data: matches } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
        <p className="mt-1 text-muted-foreground">
          Every match across every tournament. Filter by status, click any to manage.
        </p>
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

      {!matches || matches.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fixtures match this filter"
          description="Try a different filter or generate fixtures from a tournament."
        />
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <FixtureRow key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
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
