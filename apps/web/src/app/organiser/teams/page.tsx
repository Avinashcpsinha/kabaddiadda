import Link from 'next/link';
import { ArrowRight, Crown, Shield, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export const metadata = { title: 'Teams' };

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  city: string | null;
  captain_id: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  player_count: number;
  captain_name: string | null;
}

export default async function TeamsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  const { data: rawTeams } = await supabase
    .from('teams')
    .select(
      'id, name, short_name, primary_color, city, captain_id, tournament_id, tournament:tournament_id(name)',
    )
    .eq('tenant_id', tenantId)
    .order('name');

  const teams = (rawTeams ?? []) as unknown as Array<{
    id: string;
    name: string;
    short_name: string | null;
    primary_color: string | null;
    city: string | null;
    captain_id: string | null;
    tournament_id: string | null;
    tournament: { name: string | null } | null;
  }>;

  const playerCounts = new Map<string, number>();
  const captainNames = new Map<string, string>();

  if (teams.length > 0) {
    const teamIds = teams.map((t) => t.id);
    const captainIds = teams.map((t) => t.captain_id).filter((id): id is string => !!id);

    const [{ data: players }, { data: captains }] = await Promise.all([
      supabase.from('players').select('id, team_id').in('team_id', teamIds),
      captainIds.length > 0
        ? supabase.from('players').select('id, full_name').in('id', captainIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

    for (const p of players ?? []) {
      if (p.team_id) {
        playerCounts.set(p.team_id, (playerCounts.get(p.team_id) ?? 0) + 1);
      }
    }
    for (const c of captains ?? []) {
      captainNames.set(c.id, c.full_name);
    }
  }

  const rows: TeamRow[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    primary_color: t.primary_color,
    city: t.city,
    captain_id: t.captain_id,
    tournament_id: t.tournament_id,
    tournament_name: t.tournament?.name ?? null,
    player_count: playerCounts.get(t.id) ?? 0,
    captain_name: t.captain_id ? (captainNames.get(t.captain_id) ?? null) : null,
  }));

  // Group by tournament name (or "Unassigned").
  const grouped = new Map<string, TeamRow[]>();
  for (const r of rows) {
    const key = r.tournament_name ?? 'Unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <p className="mt-1 text-muted-foreground">
          Every team across every tournament in your league. Click a team to manage its roster.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Teams are added per-tournament. Open a tournament to add its first teams."
        />
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([tournament, teamsInGroup]) => (
            <section key={tournament} className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {tournament}
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  {teamsInGroup.length} {teamsInGroup.length === 1 ? 'team' : 'teams'}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {teamsInGroup.map((t) => (
                  <TeamCard key={t.id} team={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: TeamRow }) {
  const href = team.tournament_id
    ? `/organiser/tournaments/${team.tournament_id}/teams/${team.id}`
    : `/organiser/teams`;

  return (
    <Link href={href} className="group">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{
              background: team.primary_color
                ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
                : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
            }}
          >
            {team.short_name || initials(team.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{team.name}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            {team.city && <div className="text-xs text-muted-foreground">{team.city}</div>}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {team.player_count} {team.player_count === 1 ? 'player' : 'players'}
              </span>
              {team.captain_name && (
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" />
                  {team.captain_name}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
