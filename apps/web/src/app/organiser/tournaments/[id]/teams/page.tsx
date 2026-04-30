import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';
import { AddTeamForm } from './add-team-form';

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, max_teams')
    .eq('id', id)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!tournament) notFound();

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, city, primary_color')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  const playerCounts = await Promise.all(
    (teams ?? []).map(async (t) => {
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', t.id);
      return [t.id, count ?? 0] as const;
    }),
  );
  const countByTeam = Object.fromEntries(playerCounts);

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
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {teams?.length ?? 0} registered{tournament.max_teams ? ` of ${tournament.max_teams}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!teams || teams.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No teams yet"
              description="Use the form on the right to register your first team."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/organiser/tournaments/${id}/teams/${t.id}`}
                  className="group flex items-center gap-4 rounded-lg border border-border/50 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
                    style={{
                      background: t.primary_color
                        ? `linear-gradient(135deg, ${t.primary_color}, ${t.primary_color}cc)`
                        : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
                    }}
                  >
                    {t.short_name || initials(t.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {countByTeam[t.id] ?? 0} player{countByTeam[t.id] === 1 ? '' : 's'}
                      {t.city && ` · ${t.city}`}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">Register a team</h3>
            <AddTeamForm tournamentId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
