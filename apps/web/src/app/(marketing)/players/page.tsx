import Link from 'next/link';
import { Search, Shield, Sparkles, Target, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;
export const metadata = { title: 'Players · Kabaddiadda' };

const ROLE_META: Record<string, { label: string; icon: typeof Target; tone: string }> = {
  raider:           { label: 'Raider',           icon: Target, tone: 'text-primary' },
  defender_corner:  { label: 'Corner defender',  icon: Shield, tone: 'text-sky-500' },
  defender_cover:   { label: 'Cover defender',   icon: Shield, tone: 'text-sky-500' },
  all_rounder:      { label: 'All-rounder',      icon: Sparkles, tone: 'text-emerald-500' },
};

interface PlayerRow {
  id: string;
  full_name: string;
  jersey_number: number | null;
  role: string;
  team_id: string | null;
  tenant_id: string | null;
}

interface TeamLookup {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}
interface TenantLookup {
  id: string;
  slug: string;
  name: string;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; league?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const roleFilter = sp.role ?? '';
  const leagueFilter = sp.league ?? '';

  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('status', 'active')
    .order('name');

  // public_players is the security-defined view that exposes non-PII
  // columns. The team / tenant joins use Supabase's foreign-key embedding
  // through the underlying players table.
  let query = supabase
    .from('public_players')
    .select(
      'id, full_name, jersey_number, role, team_id, tenant_id',
    )
    .order('full_name')
    .limit(120);

  if (q) {
    query = query.ilike('full_name', `%${q}%`);
  }
  if (roleFilter && Object.keys(ROLE_META).includes(roleFilter)) {
    query = query.eq('role', roleFilter);
  }
  if (leagueFilter) {
    const tenant = (tenants ?? []).find((t) => t.slug === leagueFilter);
    if (tenant) query = query.eq('tenant_id', tenant.id);
  }

  const { data: rows } = await query;
  const players = (rows ?? []) as unknown as PlayerRow[];

  // Batch-load teams + tenants for the rows we got
  const teamIds = Array.from(new Set(players.map((p) => p.team_id).filter(Boolean) as string[]));
  const tenantIds = Array.from(new Set(players.map((p) => p.tenant_id).filter(Boolean) as string[]));
  const teamById = new Map<string, TeamLookup>();
  const tenantById = new Map<string, TenantLookup>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, short_name, primary_color')
      .in('id', teamIds);
    for (const t of teams ?? []) teamById.set(t.id, t as TeamLookup);
  }
  if (tenantIds.length > 0) {
    const { data: tens } = await supabase
      .from('tenants')
      .select('id, slug, name')
      .in('id', tenantIds);
    for (const t of tens ?? []) tenantById.set(t.id, t as TenantLookup);
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div>
        <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5">
          <Users className="h-3 w-3 text-primary" />
          <span className="text-primary">Players</span>
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight">Players directory</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every registered player across the platform. Search by name, filter by role or league, and
          tap into a profile for season stats and current rank.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <form className="relative flex-1 min-w-[240px]" action="/players" method="get">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search player name…" className="pl-9" />
            {roleFilter && <input type="hidden" name="role" value={roleFilter} />}
            {leagueFilter && <input type="hidden" name="league" value={leagueFilter} />}
          </form>
          <div className="flex flex-wrap gap-2">
            <RolePill href="/players" label="All" active={!roleFilter} q={q} league={leagueFilter} />
            {(Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map((r) => (
              <RolePill
                key={r}
                href={`/players?${new URLSearchParams({
                  role: r,
                  ...(q ? { q } : {}),
                  ...(leagueFilter ? { league: leagueFilter } : {}),
                }).toString()}`}
                label={ROLE_META[r].label}
                active={roleFilter === r}
                q={q}
                league={leagueFilter}
              />
            ))}
          </div>
          {tenants && tenants.length > 0 && (
            <form className="flex items-center gap-2" action="/players" method="get">
              {q && <input type="hidden" name="q" value={q} />}
              {roleFilter && <input type="hidden" name="role" value={roleFilter} />}
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

      {players.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No players match"
          description={
            q ? `Nothing matches "${q}". Try a different search.` : 'Try clearing the filters.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/40">
              {players.map((p) => {
                const meta = ROLE_META[p.role] ?? ROLE_META.all_rounder;
                const team = p.team_id ? teamById.get(p.team_id) : null;
                const tenant = p.tenant_id ? tenantById.get(p.tenant_id) : null;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/players/${p.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{
                          background: team?.primary_color
                            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
                            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
                        }}
                      >
                        {p.jersey_number ?? '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{p.full_name}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          {team?.name && <span>{team.name}</span>}
                          {tenant?.name && (
                            <>
                              <span>·</span>
                              <span>{tenant.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[9px] ${meta.tone}`}>
                        <meta.icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RolePill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
  q?: string;
  league?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
