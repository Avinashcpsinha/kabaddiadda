import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Radio, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Raid',
  tackle_point: 'Tackle',
  bonus_point: 'Bonus',
  super_raid: 'Super raid',
  super_tackle: 'Super tackle',
  all_out: 'All out',
  do_or_die_raid: 'Do-or-die raid',
  empty_raid: 'Empty raid',
  time_out: 'Time out',
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
    )
    .eq('id', matchId)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!match) notFound();

  const { data: events } = await supabase
    .from('match_events')
    .select('id, type, half, clock_seconds, points_attacker, points_defender, attacking_team_id, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(50);

  // @ts-expect-error supabase nested type
  const home = match.home_team;
  // @ts-expect-error supabase nested type
  const away = match.away_team;

  return (
    <div className="space-y-6">
      <Link
        href={`/organiser/tournaments/${id}/fixtures`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Fixtures
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{match.round ?? 'Match'}</span>
            <span>
              {new Date(match.scheduled_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <StatusBadge status={match.status} />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <TeamColumn team={home} side="home" />
            <div className="text-center">
              <div className="font-mono text-5xl font-bold tabular-nums">
                {match.home_score} <span className="text-muted-foreground/30">·</span>{' '}
                {match.away_score}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                Q{match.current_half} ·{' '}
                {Math.floor(match.clock_seconds / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(match.clock_seconds % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <TeamColumn team={away} side="away" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {match.status === 'scheduled' ? (
              <Button asChild variant="flame" size="lg">
                <Link href={`/organiser/tournaments/${id}/matches/${matchId}/lineups`}>
                  <Users className="h-4 w-4" />
                  Set lineups & start
                </Link>
              </Button>
            ) : (
              <Button asChild variant="flame" size="lg">
                <Link href={`/organiser/tournaments/${id}/matches/${matchId}/scoring`}>
                  <Radio className="h-4 w-4" />
                  {match.status === 'live' ? 'Continue scoring' : 'Open scoring console'}
                </Link>
              </Button>
            )}
            {match.status !== 'scheduled' && (
              <Button asChild variant="outline">
                <Link href={`/organiser/tournaments/${id}/matches/${matchId}/lineups`}>
                  <Users className="h-4 w-4" />
                  View lineups
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/live/${matchId}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
                Public live page
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No events recorded yet. Open the scoring console to start.
            </p>
          ) : (
            <div className="space-y-1">
              {events.map((e) => {
                const homeAttacking = e.attacking_team_id === home?.id;
                const team = homeAttacking ? home : away;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/30"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                      Q{e.half}{' '}
                      {Math.floor(e.clock_seconds / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(e.clock_seconds % 60).toString().padStart(2, '0')}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {team?.short_name || initials(team?.name ?? '?')}
                    </Badge>
                    <span className="flex-1 text-foreground">
                      {EVENT_LABEL[e.type] ?? e.type}
                    </span>
                    <span className="font-mono text-xs">
                      {e.points_attacker > 0 && (
                        <span className="text-emerald-500">+{e.points_attacker}</span>
                      )}
                      {e.points_attacker > 0 && e.points_defender > 0 && ' / '}
                      {e.points_defender > 0 && (
                        <span className="text-sky-500">+{e.points_defender}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamColumn({
  team,
  side,
}: {
  team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  side: 'home' | 'away';
}) {
  if (!team) return <div />;
  return (
    <div className={`flex flex-col items-center gap-2 ${side === 'home' ? '' : ''}`}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <div className="text-center text-sm font-semibold">{team.name}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return <Badge variant="live">● LIVE</Badge>;
    case 'half_time':
      return <Badge variant="default">HALF TIME</Badge>;
    case 'completed':
      return <Badge variant="success">FINAL</Badge>;
    default:
      return <Badge variant="outline">{status.toUpperCase()}</Badge>;
  }
}
