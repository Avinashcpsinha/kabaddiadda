import Link from 'next/link';
import { Crown, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export const revalidate = 60;
export const metadata = { title: 'Teams · Kabaddiadda' };

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  primary_color: string | null;
  tournament: { id: string; slug: string; name: string } | null;
  tenant: { slug: string; name: string } | null;
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; league?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const leagueFilter = sp.league ?? '';

  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('status', 'active')
    .order('name');

  let query = supabase
    .from('teams')
    .select(
      'id, name, short_name, city, primary_color, tournament:tournament_id(id, slug, name), tenant:tenant_id(slug, name)',
    )
    .order('name')
    .limit(120);

  if (q) {
    // Match team name OR city, case-insensitive
    query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
  }
  if (leagueFilter) {
    const tenant = (tenants ?? []).find((t) => t.slug === leagueFilter);
    if (tenant) query = query.eq('tenant_id', tenant.id);
  }

  const { data: rows } = await query;
  const teams = (rows ?? []) as unknown as TeamRow[];

  // Player counts in one batched query
  const teamIds = teams.map((t) => t.id);
  const playerCountByTeam = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('team_id')
      .in('team_id', teamIds);
    for (const p of players ?? []) {
      playerCountByTeam.set(p.team_id, (playerCountByTeam.get(p.team_id) ?? 0) + 1);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div>
        <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5">
          <Users className="h-3 w-3 text-primary" />
          <span className="text-primary">Teams</span>
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight">Teams across the platform</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every registered team. Search by name or city, filter by league, and tap into a
          tournament to see fixtures and standings.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <form className="relative flex-1 min-w-[240px]" action="/teams" method="get">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search team or city…"
              className="pl-9"
            />
            {leagueFilter && <input type="hidden" name="league" value={leagueFilter} />}
          </form>
          {tenants && tenants.length > 0 && (
            <form className="flex items-center gap-2" action="/teams" method="get">
              {q && <input type="hidden" name="q" value={q} />}
              <span className="text-xs text-muted-foreground">League:</span>
              <select
                name="league"
                defaultValue={leagueFilter}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All leagues</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>
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
        </CardContent>
      </Card>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams match"
          description={q ? `Nothing matches "${q}". Try a different search.` : 'No teams found.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const playerCount = playerCountByTeam.get(t.id) ?? 0;
            const tournamentHref =
              t.tenant?.slug && t.tournament?.slug
                ? `/t/${t.tenant.slug}/${t.tournament.slug}`
                : t.tenant?.slug
                  ? `/t/${t.tenant.slug}`
                  : '#';
            return (
              <Link
                key={t.id}
                href={tournamentHref}
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
                  style={{
                    background: t.primary_color
                      ? `linear-gradient(135deg, ${t.primary_color}, ${t.primary_color}cc)`
                      : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
                  }}
                >
                  {t.short_name ?? initials(t.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  {t.city && (
                    <div className="text-xs text-muted-foreground">{t.city}</div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {t.tenant?.name && (
                      <span className="flex items-center gap-1">
                        <Crown className="h-2.5 w-2.5" />
                        {t.tenant.name}
                      </span>
                    )}
                    {playerCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{playerCount} players</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
