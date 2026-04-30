import { Activity, BarChart3, Crown, Shield, Target, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  // Headline counts.
  const [tournamentsRes, completedMatchesRes, eventsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('matches')
      .select('id, home_score, away_score, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed'),
    supabase
      .from('match_events')
      .select('type, raider_id, points_attacker, points_defender, defender_ids, is_super_raid, is_super_tackle, is_all_out')
      .eq('tenant_id', tenantId),
  ]);

  const completed = completedMatchesRes.data ?? [];
  const events = eventsRes.data ?? [];

  const totalPoints = completed.reduce((s, m) => s + m.home_score + m.away_score, 0);
  const allOuts = events.filter((e) => e.is_all_out).length;
  const superRaids = events.filter((e) => e.is_super_raid).length;
  const superTackles = events.filter((e) => e.is_super_tackle).length;

  // Top raiders by raid points (events of type raid_point + bonus_point + super_raid + do_or_die_raid where raider scored).
  // Top defenders by tackle points (events of type tackle_point + super_tackle, attributed to all defender_ids).
  const raiderPoints = new Map<string, number>();
  const defenderPoints = new Map<string, number>();

  for (const e of events) {
    const raidTypes = ['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid'];
    const tackleTypes = ['tackle_point', 'super_tackle'];

    if (raidTypes.includes(e.type) && e.raider_id) {
      raiderPoints.set(e.raider_id, (raiderPoints.get(e.raider_id) ?? 0) + (e.points_attacker ?? 0));
    }
    if (tackleTypes.includes(e.type) && Array.isArray(e.defender_ids)) {
      const share = (e.points_defender ?? 0) / Math.max(e.defender_ids.length, 1);
      for (const id of e.defender_ids) {
        defenderPoints.set(id, (defenderPoints.get(id) ?? 0) + share);
      }
    }
  }

  const topRaiderIds = Array.from(raiderPoints.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  const topDefenderIds = Array.from(defenderPoints.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  // Resolve player names.
  const allIds = Array.from(new Set([...topRaiderIds, ...topDefenderIds]));
  const nameById = new Map<string, { full_name: string; jersey_number: number | null; team_name: string | null }>();

  if (allIds.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name, jersey_number, team:team_id(name)')
      .in('id', allIds);

    for (const p of (players ?? []) as unknown as Array<{
      id: string;
      full_name: string;
      jersey_number: number | null;
      team: { name: string | null } | null;
    }>) {
      nameById.set(p.id, {
        full_name: p.full_name,
        jersey_number: p.jersey_number,
        team_name: p.team?.name ?? null,
      });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          League-wide stats and top performers across every tournament you run.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tournaments" value={tournamentsRes.count ?? 0} icon={Trophy} />
        <StatCard label="Completed matches" value={completed.length} icon={Activity} />
        <StatCard label="Total points scored" value={totalPoints} icon={Target} />
        <StatCard label="All-outs delivered" value={allOuts} icon={Zap} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard label="Super raids (3+ pt single raid)" value={superRaids} icon={Zap} />
        <StatCard label="Super tackles (≤3 defenders)" value={superTackles} icon={Shield} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-500" />
              Top raiders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRaiderIds.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No raid points yet"
                description="Stats appear once matches start scoring."
                className="border-0 py-6"
              />
            ) : (
              <Leaderboard
                ids={topRaiderIds}
                values={raiderPoints}
                names={nameById}
                accent="text-primary"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-sky-500" />
              Top defenders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDefenderIds.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No tackle points yet"
                description="Stats appear once matches start scoring."
                className="border-0 py-6"
              />
            ) : (
              <Leaderboard
                ids={topDefenderIds}
                values={defenderPoints}
                names={nameById}
                accent="text-sky-500"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/[0.02]">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Coming in Phase 6:</span> per-tournament
            and per-match breakdowns, exportable CSVs, comparison charts, and player-page deep-dive
            with raid efficiency and tackle success rates.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Leaderboard({
  ids,
  values,
  names,
  accent,
}: {
  ids: string[];
  values: Map<string, number>;
  names: Map<string, { full_name: string; jersey_number: number | null; team_name: string | null }>;
  accent: string;
}) {
  return (
    <ol className="space-y-1">
      {ids.map((id, i) => {
        const name = names.get(id);
        const pts = values.get(id) ?? 0;
        return (
          <li key={id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/30">
            <span className="w-5 text-center font-mono text-xs text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{name?.full_name ?? 'Unknown player'}</span>
                {name?.jersey_number != null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    #{name.jersey_number}
                  </span>
                )}
              </div>
              {name?.team_name && (
                <div className="text-[10px] text-muted-foreground">{name.team_name}</div>
              )}
            </div>
            <Badge variant="outline" className={accent}>
              {Math.round(pts)} pts
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
