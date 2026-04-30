import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, Crown, Download, Shield, Target, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { HorizontalBarChart } from '@/components/reports/horizontal-bar-chart';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + Knockout',
  double_elimination: 'Double Elim.',
};

interface TeamStanding {
  team_id: string;
  team_name: string;
  short_name: string | null;
  primary_color: string | null;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points_against: number;
  points_diff: number;
  league_points: number;
}

interface PlayerSeasonRow {
  player_id: string;
  full_name: string;
  jersey_number: number | null;
  team_id: string | null;
  matches_played: number;
  raid_points: number;
  tackle_points: number;
  super_raids: number;
  super_tackles: number;
  total_points: number;
  raid_success_pct: number | null;
}

export default async function TournamentReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, slug, name, format, status, start_date, end_date, tenant_id')
    .eq('id', id)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!tournament) notFound();

  // Standings, top scorers, top defenders, all-rounders, recent matches in parallel
  const [standingsRes, topScorersRes, topDefendersRes, matchesRes] = await Promise.all([
    supabase
      .from('team_season_stats')
      .select('*')
      .eq('tournament_id', id)
      .order('league_points', { ascending: false })
      .order('points_diff', { ascending: false }),
    supabase
      .from('player_season_stats')
      .select(
        'player_id, full_name, jersey_number, team_id, matches_played, raid_points, tackle_points, super_raids, super_tackles, total_points, raid_success_pct',
      )
      .eq('tournament_id', id)
      .order('raid_points', { ascending: false })
      .limit(10),
    supabase
      .from('player_season_stats')
      .select(
        'player_id, full_name, jersey_number, team_id, matches_played, raid_points, tackle_points, super_raids, super_tackles, total_points, raid_success_pct',
      )
      .eq('tournament_id', id)
      .order('tackle_points', { ascending: false })
      .limit(10),
    supabase
      .from('matches')
      .select(
        'id, scheduled_at, status, round, home_score, away_score, home_team:home_team_id(name, short_name), away_team:away_team_id(name, short_name)',
      )
      .eq('tournament_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(20),
  ]);

  const standings = (standingsRes.data ?? []) as TeamStanding[];
  const topScorers = (topScorersRes.data ?? []) as PlayerSeasonRow[];
  const topDefenders = (topDefendersRes.data ?? []) as PlayerSeasonRow[];
  const matches = matchesRes.data ?? [];

  // Filter top scorers / defenders to those who actually have points
  const scorerRows = topScorers
    .filter((p) => p.raid_points > 0)
    .slice(0, 8)
    .map((p) => ({
      label: `${p.full_name}${p.jersey_number != null ? ` #${p.jersey_number}` : ''}`,
      value: p.raid_points,
    }));
  const defenderRows = topDefenders
    .filter((p) => p.tackle_points > 0)
    .slice(0, 8)
    .map((p) => ({
      label: `${p.full_name}${p.jersey_number != null ? ` #${p.jersey_number}` : ''}`,
      value: p.tackle_points,
      color: '#0ea5e9',
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/organiser/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All reports
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-2 gap-1.5 border-primary/30 bg-primary/5">
            <Trophy className="h-3 w-3 text-primary" />
            <span className="text-primary">Tournament report</span>
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{FORMAT_LABEL[tournament.format] ?? tournament.format}</span>
            {tournament.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(tournament.start_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                {tournament.end_date && (
                  <>
                    {' → '}
                    {new Date(tournament.end_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </>
                )}
              </span>
            )}
            <Badge variant={tournament.status === 'live' ? 'live' : 'outline'} className="text-[10px] uppercase">
              {tournament.status === 'live' ? '● LIVE' : tournament.status}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/export?type=standings&tournament=${id}`}>
              <Download className="h-3 w-3" />
              Standings CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/export?type=players&tournament=${id}`}>
              <Download className="h-3 w-3" />
              Players CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/export?type=matches&tournament=${id}`}>
              <Download className="h-3 w-3" />
              Matches CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Standings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Standings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {standings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No completed matches yet"
              description="Standings appear after matches finish."
              className="border-0 py-6"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 text-right">P</th>
                    <th className="px-4 py-3 text-right">W</th>
                    <th className="px-4 py-3 text-right">D</th>
                    <th className="px-4 py-3 text-right">L</th>
                    <th className="px-4 py-3 text-right">PF</th>
                    <th className="px-4 py-3 text-right">PA</th>
                    <th className="px-4 py-3 text-right">+/-</th>
                    <th className="px-4 py-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.team_id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: s.primary_color ?? 'hsl(var(--primary))' }}
                          />
                          <span className="font-medium">{s.team_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{s.matches_played}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-emerald-500">{s.wins}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{s.draws}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-red-500">{s.losses}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{s.points_for}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{s.points_against}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.points_diff > 0 ? '+' : ''}
                        {s.points_diff}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{s.league_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top scorers + defenders charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Top raiders (by raid points)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={scorerRows} valueFormatter={(n) => `${n} pts`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-sky-500" />
              Top defenders (by tackle points)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={defenderRows}
              valueFormatter={(n) => `${n} pts`}
              accentColor="#0ea5e9"
            />
          </CardContent>
        </Card>
      </div>

      {/* Match list with drill-in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-500" />
            Recent matches
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {matches.length === 0 ? (
            <EmptyState
              icon={Crown}
              title="No matches scheduled yet"
              description="Add fixtures from the tournament page."
              className="border-0 py-6"
            />
          ) : (
            <ul className="divide-y divide-border/40">
              {matches.map((m) => {
                // @ts-expect-error supabase nested
                const home = m.home_team;
                // @ts-expect-error supabase nested
                const away = m.away_team;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/organiser/reports/matches/${m.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={m.status === 'live' ? 'live' : 'outline'}
                          className="shrink-0 text-[10px] uppercase"
                        >
                          {m.status === 'live' ? '● LIVE' : m.status}
                        </Badge>
                        <div>
                          <div className="text-sm font-medium">
                            {home?.name ?? 'TBD'}{' '}
                            <span className="text-muted-foreground">vs</span>{' '}
                            {away?.name ?? 'TBD'}
                          </div>
                          {m.round && (
                            <div className="text-[11px] text-muted-foreground">{m.round}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-semibold tabular-nums">
                          {m.home_score} <span className="text-muted-foreground/40">·</span>{' '}
                          {m.away_score}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
