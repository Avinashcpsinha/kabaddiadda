import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';
import { AddMatchForm } from './add-match-form';
import { AutoGenerateButton } from './auto-generate-button';

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .eq('id', id)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!tournament) notFound();

  const [{ data: teams }, { data: matches }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, short_name, primary_color')
      .eq('tournament_id', id)
      .order('name'),
    supabase
      .from('matches')
      .select(
        'id, scheduled_at, status, round, home_score, away_score, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
      )
      .eq('tournament_id', id)
      .order('scheduled_at'),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href={`/organiser/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        {tournament.name}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {matches?.length ?? 0} matches scheduled · {teams?.length ?? 0} teams
          </p>
        </div>
        <AutoGenerateButton
          tournamentId={id}
          teamCount={teams?.length ?? 0}
          existingMatches={matches?.length ?? 0}
          defaultStart={tournament.start_date ?? new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {!matches || matches.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No fixtures yet"
              description="Add matches manually on the right, or use Auto-generate to create a full round-robin."
            />
          ) : (
            matches.map((m) => (
              <Card key={m.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium uppercase tracking-wider">
                        {m.round ?? 'Match'}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(m.scheduled_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <MatchStatusBadge status={m.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <TeamSide
                      // @ts-expect-error supabase nested join typing
                      team={m.home_team}
                      side="home"
                    />
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold tabular-nums">
                        {m.home_score} <span className="text-muted-foreground/40">·</span>{' '}
                        {m.away_score}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        vs
                      </div>
                    </div>
                    <TeamSide
                      // @ts-expect-error supabase nested join typing
                      team={m.away_team}
                      side="away"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                    {m.status !== 'completed' && (
                      <Button asChild variant="flame" size="sm">
                        <Link
                          href={`/organiser/tournaments/${id}/matches/${m.id}/scoring`}
                        >
                          <Radio className="h-3.5 w-3.5" />
                          {m.status === 'live' ? 'Continue scoring' : 'Open scoring'}
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/organiser/tournaments/${id}/matches/${m.id}`}>
                        Match details
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">Add a match</h3>
            <AddMatchForm tournamentId={id} teams={teams ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

function TeamSide({ team, side }: { team: TeamLite | null; side: 'home' | 'away' }) {
  if (!team) return <div />;
  const align = side === 'home' ? 'flex-row' : 'flex-row-reverse text-right';
  return (
    <div className={`flex items-center gap-3 ${align}`}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{team.name}</div>
      </div>
    </div>
  );
}

function MatchStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return <Badge variant="live">● LIVE</Badge>;
    case 'half_time':
      return <Badge variant="default">HALF TIME</Badge>;
    case 'completed':
      return <Badge variant="success">COMPLETED</Badge>;
    case 'abandoned':
      return <Badge variant="destructive">ABANDONED</Badge>;
    default:
      return <Badge variant="outline">SCHEDULED</Badge>;
  }
}
