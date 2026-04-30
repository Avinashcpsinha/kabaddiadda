import Link from 'next/link';
import { ArrowRight, Calendar, ExternalLink, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export const metadata = { title: 'Live scoring' };

export default async function ScoringHubPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  // Live OR half-time matches in this tenant.
  const { data: liveMatches } = await supabase
    .from('matches')
    .select(
      `id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, tournament_id,
       home_team:home_team_id(id, name, short_name, primary_color),
       away_team:away_team_id(id, name, short_name, primary_color),
       tournament:tournament_id(name)`,
    )
    .eq('tenant_id', tenantId)
    .in('status', ['live', 'half_time'])
    .order('scheduled_at', { ascending: true });

  // Next 5 scheduled matches so the user can pick one to start.
  const { data: upcoming } = await supabase
    .from('matches')
    .select(
      `id, scheduled_at, round, tournament_id,
       home_team:home_team_id(name, short_name, primary_color),
       away_team:away_team_id(name, short_name, primary_color),
       tournament:tournament_id(name)`,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })
    .limit(5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live scoring</h1>
        <p className="mt-1 text-muted-foreground">
          Matches currently live in your league. Open one to keep scoring, or start the next
          scheduled match below.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Currently live ({liveMatches?.length ?? 0})
          </h2>
        </div>

        {!liveMatches || liveMatches.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No matches live right now"
            description="When a match is in progress it'll appear here. Start one from the upcoming list below."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {liveMatches.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Next up
          </h2>
        </div>

        {!upcoming || upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming matches scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <UpcomingRow key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface LiveMatch {
  id: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  tournament_id: string;
  home_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  tournament: { name: string | null } | null;
}

function LiveMatchCard({ match: raw }: { match: unknown }) {
  const m = raw as LiveMatch;
  if (!m.home_team || !m.away_team) return null;

  return (
    <Card className="overflow-hidden">
      <div className="h-1 animate-pulse bg-gradient-to-r from-primary via-orange-500 to-primary" />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">{m.tournament?.name ?? 'Match'}</span>
          {m.status === 'half_time' ? (
            <Badge>HALF TIME</Badge>
          ) : (
            <Badge variant="live" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Q{m.current_half} ·{' '}
              {Math.floor(m.clock_seconds / 60)
                .toString()
                .padStart(2, '0')}
              :{(m.clock_seconds % 60).toString().padStart(2, '0')}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <TeamBlock team={m.home_team} />
          <div className="font-mono text-3xl font-bold tabular-nums">
            {m.home_score}
            <span className="mx-2 text-muted-foreground/40">·</span>
            {m.away_score}
          </div>
          <TeamBlock team={m.away_team} />
        </div>

        <div className="flex gap-2">
          <Button asChild variant="flame" className="flex-1">
            <Link href={`/organiser/tournaments/${m.tournament_id}/matches/${m.id}/scoring`}>
              <Radio className="h-4 w-4" />
              Continue scoring
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/live/${m.id}`} target="_blank" aria-label="Public live page">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamBlock({
  team,
}: {
  team: { name: string; short_name: string | null; primary_color: string | null };
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">{team.name}</span>
    </div>
  );
}

interface UpcomingMatch {
  id: string;
  scheduled_at: string;
  round: string | null;
  tournament_id: string;
  home_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  tournament: { name: string | null } | null;
}

function UpcomingRow({ match: raw }: { match: unknown }) {
  const m = raw as UpcomingMatch;
  if (!m.home_team || !m.away_team) return null;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-3">
        <div className="hidden text-xs text-muted-foreground sm:block">
          <div className="uppercase tracking-wider">{m.tournament?.name ?? ''}</div>
          <div>{m.round ?? 'Match'}</div>
          <div className="text-[10px]">
            {new Date(m.scheduled_at).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center gap-3 text-sm">
          <span className="truncate font-medium">{m.home_team.name}</span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="truncate font-medium">{m.away_team.name}</span>
        </div>
        <Button asChild variant="flame" size="sm">
          <Link href={`/organiser/tournaments/${m.tournament_id}/matches/${m.id}/lineups`}>
            Set lineups & start
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
