import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Crown,
  Shield,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

const ROLE_META: Record<string, { label: string; icon: typeof Target; tone: string }> = {
  raider:           { label: 'Raider',           icon: Target, tone: 'text-primary' },
  defender_corner:  { label: 'Corner defender',  icon: Shield, tone: 'text-sky-500' },
  defender_cover:   { label: 'Cover defender',   icon: Shield, tone: 'text-sky-500' },
  all_rounder:      { label: 'All-rounder',      icon: Sparkles, tone: 'text-emerald-500' },
};

const TIER_STYLES: Record<string, string> = {
  S: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-amber-400/40 shadow-amber-500/30',
  A: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  B: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  C: 'bg-muted text-muted-foreground border-border',
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from('public_players')
    .select('full_name')
    .eq('id', id)
    .maybeSingle();
  return { title: p ? `${p.full_name} · Player profile` : 'Player not found' };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: player } = await supabase
    .from('public_players')
    .select(
      'id, full_name, jersey_number, role, height_cm, weight_kg, photo_url, team_id, tenant_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (!player) notFound();

  // Look up team + tenant separately (view doesn't expose foreign-key embeds)
  const [{ data: team }, { data: tenant }] = await Promise.all([
    player.team_id
      ? supabase
          .from('teams')
          .select('id, name, short_name, primary_color')
          .eq('id', player.team_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    player.tenant_id
      ? supabase
          .from('tenants')
          .select('slug, name')
          .eq('id', player.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const meta = ROLE_META[player.role] ?? ROLE_META.all_rounder;

  // Career and per-tournament stats + career ranking
  const [careerRes, seasonRes, careerRankRes] = await Promise.all([
    supabase.from('player_career_stats').select('*').eq('player_id', id).maybeSingle(),
    supabase
      .from('player_season_stats')
      .select('*')
      .eq('player_id', id)
      .order('matches_played', { ascending: false }),
    supabase
      .from('player_rankings_career')
      .select('rank, tier, composite_score, matches_played')
      .eq('player_id', id)
      .maybeSingle(),
  ]);

  const career = careerRes.data;
  const seasonRows = seasonRes.data ?? [];
  const careerRank = careerRankRes.data;

  // Resolve tournament names for the season-stats list
  const tournamentIds = Array.from(new Set(seasonRows.map((r) => r.tournament_id).filter(Boolean)));
  const tournamentNameById = new Map<string, { name: string; slug: string; tenant_slug: string }>();
  if (tournamentIds.length > 0) {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, slug, tenant:tenant_id(slug)')
      .in('id', tournamentIds);
    for (const t of tournaments ?? []) {
      tournamentNameById.set(t.id, {
        name: t.name,
        slug: t.slug,
        // @ts-expect-error supabase nested
        tenant_slug: t.tenant?.slug ?? '',
      });
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-12">
      <Link
        href="/players"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All players
      </Link>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div
          className="h-32 w-full"
          style={{
            background: team?.primary_color
              ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
              : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
          }}
        />
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div className="-mt-16">
            {player.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="h-24 w-24 rounded-2xl border-4 border-background object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-muted text-2xl font-bold text-muted-foreground shadow-xl">
                {player.jersey_number ?? '?'}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{player.full_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className={meta.tone}>
                <meta.icon className="h-3 w-3" />
                {meta.label}
              </Badge>
              {player.jersey_number != null && (
                <span className="font-mono text-xs">#{player.jersey_number}</span>
              )}
              {team?.name && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground/40">·</span>
                  {team.name}
                </span>
              )}
              {tenant?.name && tenant?.slug && (
                <Link
                  href={`/t/${tenant.slug}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Crown className="h-3 w-3" />
                  {tenant.name}
                </Link>
              )}
            </div>
          </div>
          {careerRank && (
            <div className="flex flex-col items-center gap-1 self-start sm:self-end">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Career rank
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold ${TIER_STYLES[careerRank.tier] ?? TIER_STYLES.C}`}
                >
                  {careerRank.tier}
                </span>
                <span className="font-mono text-2xl font-bold">#{careerRank.rank}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Career stat tiles */}
      {career ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Matches played" value={career.matches_played} icon={Calendar} />
          <StatTile label="Tournaments" value={career.tournaments_played} icon={Trophy} />
          <StatTile
            label="Raid points"
            value={career.raid_points}
            icon={Target}
            sub={career.raid_success_pct != null ? `${career.raid_success_pct}% success` : undefined}
          />
          <StatTile label="Tackle points" value={career.tackle_points} icon={Shield} />
        </div>
      ) : (
        <EmptyState
          icon={Trophy}
          title="No match data yet"
          description="Stats will appear here once this player participates in scored matches."
        />
      )}

      {/* Per-tournament breakdown */}
      {seasonRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per tournament</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Tournament</th>
                    <th className="px-4 py-3 text-right">M</th>
                    <th className="px-4 py-3 text-right">Raid pts</th>
                    <th className="px-4 py-3 text-right">Tackle pts</th>
                    <th className="px-4 py-3 text-right">Super raids</th>
                    <th className="px-4 py-3 text-right">Super tackles</th>
                    <th className="px-4 py-3 text-right">Total pts</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonRows.map((row) => {
                    const t = tournamentNameById.get(row.tournament_id);
                    return (
                      <tr
                        key={row.tournament_id}
                        className="border-b border-border/40 transition-colors hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          {t ? (
                            <Link
                              href={`/t/${t.tenant_slug}/${t.slug}`}
                              className="font-medium hover:text-primary"
                            >
                              {t.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.matches_played}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.raid_points}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.tackle_points}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.super_raids}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{row.super_tackles}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {row.total_points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: typeof Target;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="font-mono text-3xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
