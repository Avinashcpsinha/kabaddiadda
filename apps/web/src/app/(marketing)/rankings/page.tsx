import Link from 'next/link';
import { Crown, Shield, Sparkles, Target, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';
import { cn, initials } from '@/lib/utils';

// Public leaderboard. No auth required — anyone can browse rankings.
export const revalidate = 60;
export const metadata = { title: 'Rankings · Kabaddiadda' };

type Scope = 'career' | 'tournament';
type RoleFilter = 'raider' | 'defender_corner' | 'defender_cover' | 'all_rounder';

const ROLE_META: Record<RoleFilter, { label: string; icon: typeof Target; primaryStat: string }> = {
  raider:           { label: 'Raiders',          icon: Target, primaryStat: 'Raid pts' },
  defender_corner:  { label: 'Corner defenders', icon: Shield, primaryStat: 'Tackle pts' },
  defender_cover:   { label: 'Cover defenders',  icon: Shield, primaryStat: 'Tackle pts' },
  all_rounder:      { label: 'All-rounders',     icon: Sparkles, primaryStat: 'Total pts' },
};

const TIER_STYLES: Record<string, string> = {
  S: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-amber-400/40 shadow-amber-500/30',
  A: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  B: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  C: 'bg-muted text-muted-foreground border-border',
};

interface RankingRow {
  player_id: string;
  full_name: string;
  jersey_number: number | null;
  team_id: string | null;
  matches_played: number;
  raid_points: number;
  tackle_points: number;
  bonus_points: number;
  super_raids: number;
  super_tackles: number;
  empty_raids: number;
  dod_conversions: number;
  raid_success_pct: number | null;
  total_points: number;
  composite_score: number;
  rank: number;
  tier: string;
  tournaments_played?: number;
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; scope?: string; tournament?: string }>;
}) {
  const sp = await searchParams;
  const role: RoleFilter = (['raider', 'defender_corner', 'defender_cover', 'all_rounder'] as const).includes(
    sp.role as RoleFilter,
  )
    ? (sp.role as RoleFilter)
    : 'raider';
  const scope: Scope = sp.scope === 'tournament' ? 'tournament' : 'career';
  const tournamentId = scope === 'tournament' ? sp.tournament ?? null : null;

  const supabase = await createClient();

  // Tournament dropdown — only non-draft so anonymous visitors see what's published.
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, status')
    .neq('status', 'draft')
    .order('start_date', { ascending: false });

  // Rankings query — pick view based on scope
  let rows: RankingRow[] = [];
  if (scope === 'tournament' && tournamentId) {
    const res = await supabase
      .from('player_rankings_tournament')
      .select(
        'player_id, full_name, jersey_number, team_id, matches_played, raid_points, tackle_points, bonus_points, super_raids, super_tackles, empty_raids, dod_conversions, raid_success_pct, total_points, composite_score, rank, tier',
      )
      .eq('tournament_id', tournamentId)
      .eq('role', role)
      .order('rank', { ascending: true })
      .limit(50);
    rows = (res.data as RankingRow[]) ?? [];
  } else {
    const res = await supabase
      .from('player_rankings_career')
      .select(
        'player_id, full_name, jersey_number, team_id, matches_played, tournaments_played, raid_points, tackle_points, bonus_points, super_raids, super_tackles, empty_raids, dod_conversions, raid_success_pct, total_points, composite_score, rank, tier',
      )
      .eq('role', role)
      .order('rank', { ascending: true })
      .limit(50);
    rows = (res.data as RankingRow[]) ?? [];
  }

  // Pull team names for the rows we got, in one shot
  const teamIds = Array.from(new Set(rows.map((r) => r.team_id).filter(Boolean) as string[]));
  const teamById = new Map<string, { name: string; short_name: string | null; primary_color: string | null }>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, short_name, primary_color')
      .in('id', teamIds);
    for (const t of teams ?? []) {
      teamById.set(t.id, {
        name: t.name,
        short_name: t.short_name ?? null,
        primary_color: t.primary_color ?? null,
      });
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div>
        <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5">
          <Trophy className="h-3 w-3 text-primary" />
          <span className="text-primary">Leaderboard</span>
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight">Player rankings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Top performers across every league on Kabaddiadda. Scores are weighted per role.
          Players with fewer than 3 matches are excluded so a single hot game can&apos;t top the
          chart. Tiers are relative — S is the top 10%, A the next 20%, B the next 30%, C the
          rest.
        </p>
      </div>

      {/* Filters: role + scope (career/tournament) */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <RoleTabs current={role} scope={scope} tournamentId={tournamentId} />
          <ScopeTabs
            current={scope}
            role={role}
            tournamentId={tournamentId}
            tournaments={tournaments ?? []}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No players qualify yet"
          description={
            scope === 'tournament'
              ? 'This tournament does not have any players with 3+ completed matches in this role yet.'
              : 'No players have played 3 or more matches in this role across the platform yet. Rankings will populate as more matches are scored.'
          }
        />
      ) : (
        <RankingsTable rows={rows} role={role} teamById={teamById} scope={scope} />
      )}
    </div>
  );
}

function RoleTabs({
  current,
  scope,
  tournamentId,
}: {
  current: RoleFilter;
  scope: Scope;
  tournamentId: string | null;
}) {
  const roles: RoleFilter[] = ['raider', 'defender_corner', 'defender_cover', 'all_rounder'];
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((r) => {
        const meta = ROLE_META[r];
        const active = r === current;
        const params = new URLSearchParams({ role: r, scope });
        if (tournamentId) params.set('tournament', tournamentId);
        return (
          <Link
            key={r}
            href={`/rankings?${params.toString()}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
            )}
          >
            <meta.icon className="h-3 w-3" />
            {meta.label}
          </Link>
        );
      })}
    </div>
  );
}

function ScopeTabs({
  current,
  role,
  tournamentId,
  tournaments,
}: {
  current: Scope;
  role: RoleFilter;
  tournamentId: string | null;
  tournaments: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Scope:</span>
      <Link
        href={`/rankings?role=${role}&scope=career`}
        className={cn(
          'rounded-md border px-3 py-1.5 font-medium transition-colors',
          current === 'career'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
        )}
      >
        All time
      </Link>
      {tournaments.length > 0 && (
        <form className="contents" action="/rankings" method="get">
          <span className="text-muted-foreground">·</span>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="scope" value="tournament" />
          <select
            name="tournament"
            defaultValue={current === 'tournament' ? tournamentId ?? '' : ''}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">— pick tournament —</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}

function RankingsTable({
  rows,
  role,
  teamById,
  scope,
}: {
  rows: RankingRow[];
  role: RoleFilter;
  teamById: Map<string, { name: string; short_name: string | null; primary_color: string | null }>;
  scope: Scope;
}) {
  // Column layout differs by role — raiders show raid stats, defenders show tackle stats
  const isRaider = role === 'raider';
  const isDefender = role === 'defender_corner' || role === 'defender_cover';

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="px-4 py-3 text-right">M</th>
                {scope === 'career' && <th className="px-4 py-3 text-right">T</th>}
                {isRaider && (
                  <>
                    <th className="px-4 py-3 text-right">Raid pts</th>
                    <th className="px-4 py-3 text-right">Super raids</th>
                    <th className="px-4 py-3 text-right">DOD wins</th>
                    <th className="px-4 py-3 text-right">Success %</th>
                  </>
                )}
                {isDefender && (
                  <>
                    <th className="px-4 py-3 text-right">Tackle pts</th>
                    <th className="px-4 py-3 text-right">Super tackles</th>
                    <th className="px-4 py-3 text-right">Empty</th>
                  </>
                )}
                {role === 'all_rounder' && (
                  <>
                    <th className="px-4 py-3 text-right">Raid pts</th>
                    <th className="px-4 py-3 text-right">Tackle pts</th>
                    <th className="px-4 py-3 text-right">Bonus</th>
                  </>
                )}
                <th className="px-4 py-3 text-right">Total pts</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = row.team_id ? teamById.get(row.team_id) : null;
                return (
                  <tr
                    key={row.player_id}
                    className="border-b border-border/40 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                          row.rank === 1 && 'bg-amber-500/20 text-amber-600',
                          row.rank === 2 && 'bg-zinc-400/20 text-zinc-500',
                          row.rank === 3 && 'bg-orange-500/20 text-orange-600',
                          row.rank > 3 && 'text-muted-foreground',
                        )}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                          {initials(row.full_name)}
                        </div>
                        <div>
                          <div className="font-medium">{row.full_name}</div>
                          {row.jersey_number != null && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              #{row.jersey_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {team ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: team.primary_color ?? 'hsl(var(--primary))' }}
                          />
                          <span className="text-xs">{team.short_name ?? team.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-bold',
                          TIER_STYLES[row.tier] ?? TIER_STYLES.C,
                        )}
                      >
                        {row.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.matches_played}</td>
                    {scope === 'career' && (
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {row.tournaments_played ?? '—'}
                      </td>
                    )}
                    {isRaider && (
                      <>
                        <td className="px-4 py-3 text-right font-mono">{row.raid_points}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.super_raids}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {row.dod_conversions}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {row.raid_success_pct != null ? `${row.raid_success_pct}%` : '—'}
                        </td>
                      </>
                    )}
                    {isDefender && (
                      <>
                        <td className="px-4 py-3 text-right font-mono">{row.tackle_points}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.super_tackles}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.empty_raids}</td>
                      </>
                    )}
                    {role === 'all_rounder' && (
                      <>
                        <td className="px-4 py-3 text-right font-mono">{row.raid_points}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.tackle_points}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.bonus_points}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right font-mono font-semibold">{row.total_points}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {Number(row.composite_score).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
