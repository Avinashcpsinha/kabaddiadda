import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Target, Shield, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { ScoreProgressionChart, type ProgressionPoint } from '@/components/reports/score-progression-chart';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

interface MatchEventRow {
  id: string;
  type: string;
  half: number;
  clock_seconds: number;
  raider_id: string | null;
  defender_ids: string[] | null;
  points_attacker: number;
  points_defender: number;
  attacking_team_id: string | null;
  is_super_raid: boolean;
  is_super_tackle: boolean;
  is_all_out: boolean;
  created_at: string;
}

export default async function MatchReportPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, scheduled_at, status, round, home_score, away_score, current_half, tournament_id, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
    )
    .eq('id', matchId)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!match) notFound();

  // Pull all match events (chronological) + per-player stats for this match
  const [eventsRes, playerStatsRes] = await Promise.all([
    supabase
      .from('match_events')
      .select(
        'id, type, half, clock_seconds, raider_id, defender_ids, points_attacker, points_defender, attacking_team_id, is_super_raid, is_super_tackle, is_all_out, created_at',
      )
      .eq('match_id', matchId)
      .order('created_at', { ascending: true }),
    supabase
      .from('player_match_stats')
      .select('*')
      .eq('match_id', matchId),
  ]);

  const events = (eventsRes.data ?? []) as MatchEventRow[];
  const playerStats = playerStatsRes.data ?? [];

  // Resolve player names for the player-contribution leaderboard
  const playerIds = playerStats.map((p) => p.player_id);
  const playerById = new Map<string, { full_name: string; jersey_number: number | null; team_id: string | null }>();
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name, jersey_number, team_id')
      .in('id', playerIds);
    for (const p of players ?? []) {
      playerById.set(p.id, {
        full_name: p.full_name,
        jersey_number: p.jersey_number ?? null,
        team_id: p.team_id ?? null,
      });
    }
  }

  // @ts-expect-error supabase nested
  const home = match.home_team as { id: string; name: string; short_name: string | null; primary_color: string | null };
  // @ts-expect-error supabase nested
  const away = match.away_team as { id: string; name: string; short_name: string | null; primary_color: string | null };

  // Build score-progression data: walk events chronologically, keep running totals
  const progression: ProgressionPoint[] = [];
  let homeScore = 0;
  let awayScore = 0;
  for (const e of events) {
    if (e.points_attacker === 0 && e.points_defender === 0) continue;
    const attackingHome = e.attacking_team_id === home.id;
    if (attackingHome) {
      homeScore += e.points_attacker;
      awayScore += e.points_defender;
    } else {
      awayScore += e.points_attacker;
      homeScore += e.points_defender;
    }
    progression.push({
      t: `Q${e.half} ${formatClock(e.clock_seconds)}`,
      home: homeScore,
      away: awayScore,
    });
  }

  const homeContribs = playerStats
    .filter((p) => playerById.get(p.player_id)?.team_id === home.id)
    .sort((a, b) => (b.raid_points + b.tackle_points) - (a.raid_points + a.tackle_points));
  const awayContribs = playerStats
    .filter((p) => playerById.get(p.player_id)?.team_id === away.id)
    .sort((a, b) => (b.raid_points + b.tackle_points) - (a.raid_points + a.tackle_points));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/organiser/reports/tournaments/${match.tournament_id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Tournament report
        </Link>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/reports/export?type=match_events&match=${matchId}`}>
            <Download className="h-3 w-3" />
            Match events CSV
          </a>
        </Button>
      </div>

      {/* Box score */}
      <Card>
        <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 p-6">
          <BoxScoreSide team={home} score={match.home_score} align="left" />
          <div className="text-center">
            <Badge
              variant={match.status === 'live' ? 'live' : 'outline'}
              className="text-[10px] uppercase"
            >
              {match.status === 'live' ? `● LIVE Q${match.current_half}` : match.status}
            </Badge>
            {match.round && (
              <div className="mt-2 text-xs text-muted-foreground">{match.round}</div>
            )}
          </div>
          <BoxScoreSide team={away} score={match.away_score} align="right" />
        </CardContent>
      </Card>

      {/* Score progression chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Score progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreProgressionChart
            data={progression}
            homeName={home.name}
            awayName={away.name}
            homeColor={home.primary_color}
            awayColor={away.primary_color}
          />
        </CardContent>
      </Card>

      {/* Player contributions side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PlayerContribCard
          team={home}
          rows={homeContribs}
          playerById={playerById}
          align="left"
        />
        <PlayerContribCard
          team={away}
          rows={awayContribs}
          playerById={playerById}
          align="right"
        />
      </div>
    </div>
  );
}

function BoxScoreSide({
  team,
  score,
  align,
}: {
  team: { name: string; short_name: string | null; primary_color: string | null };
  score: number;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex items-center gap-4 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name ?? team.name.slice(0, 3).toUpperCase()}
      </div>
      <div>
        <div className="text-sm font-medium text-muted-foreground">{team.name}</div>
        <div className="font-mono text-5xl font-bold tabular-nums">{score}</div>
      </div>
    </div>
  );
}

function PlayerContribCard({
  team,
  rows,
  playerById,
  align,
}: {
  team: { name: string };
  rows: Array<{
    player_id: string;
    raid_points: number;
    tackle_points: number;
    super_raids: number;
    super_tackles: number;
    bonus_points: number;
  }>;
  playerById: Map<string, { full_name: string; jersey_number: number | null; team_id: string | null }>;
  align: 'left' | 'right';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className={`h-4 w-4 ${align === 'right' ? 'text-sky-500' : 'text-primary'}`} />
          {team.name} — contributions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No contributions yet"
            description="Player stats appear once raids are recorded."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((p) => {
              const meta = playerById.get(p.player_id);
              return (
                <li key={p.player_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {meta?.jersey_number ?? '?'}
                    </div>
                    <span className="font-medium">{meta?.full_name ?? 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono">
                      <span className="text-muted-foreground">R</span> {p.raid_points}
                    </span>
                    <span className="font-mono">
                      <span className="text-muted-foreground">T</span> {p.tackle_points}
                    </span>
                    {(p.super_raids > 0 || p.super_tackles > 0) && (
                      <Badge variant="outline" className="text-[9px]">
                        {p.super_raids > 0 && `${p.super_raids}× SR`}
                        {p.super_raids > 0 && p.super_tackles > 0 && ' '}
                        {p.super_tackles > 0 && `${p.super_tackles}× ST`}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
