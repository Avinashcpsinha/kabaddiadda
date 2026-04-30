import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/logo';
import { createClient } from '@/lib/supabase/server';
import { LiveMatchDisplay } from './live-display';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from('matches')
    .select('home_team:home_team_id(name), away_team:away_team_id(name), home_score, away_score')
    .eq('id', matchId)
    .maybeSingle();
  if (!m) return { title: 'Match not found' };
  // @ts-expect-error supabase nested
  const h = m.home_team?.name ?? 'Home';
  // @ts-expect-error supabase nested
  const a = m.away_team?.name ?? 'Away';
  return {
    title: `${h} ${m.home_score} — ${m.away_score} ${a} · Live`,
  };
}

export default async function PublicLivePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      `id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, tournament_id, current_raider_id, current_attacking_team_id,
       home_team:home_team_id(id, name, short_name, primary_color),
       away_team:away_team_id(id, name, short_name, primary_color),
       tournament:tournament_id(name, slug, tenant:tenant_id(slug, name))`,
    )
    .eq('id', matchId)
    .maybeSingle();

  if (!match) notFound();

  const { data: events } = await supabase
    .from('match_events')
    .select(
      'id, type, half, clock_seconds, points_attacker, points_defender, attacking_team_id, raider_id, defender_ids, created_at',
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Resolve player names for raider + defenders referenced in any event.
  const referencedIds = new Set<string>();
  for (const e of events ?? []) {
    if (e.raider_id) referencedIds.add(e.raider_id);
    for (const id of (e.defender_ids as string[] | null) ?? []) referencedIds.add(id);
  }
  // Also include the in-progress raider so the banner can resolve their name
  // on first paint (they may not yet appear in any event).
  if (match.current_raider_id) referencedIds.add(match.current_raider_id);
  const playerById = new Map<string, { full_name: string; jersey_number: number | null }>();
  if (referencedIds.size > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name, jersey_number')
      .in('id', Array.from(referencedIds));
    for (const p of players ?? []) {
      playerById.set(p.id, { full_name: p.full_name, jersey_number: p.jersey_number });
    }
  }
  function lookupPlayer(id: string | null | undefined) {
    if (!id) return null;
    const p = playerById.get(id);
    if (!p) return null;
    return { fullName: p.full_name, jerseyNumber: p.jersey_number };
  }
  const enrichedEvents = (events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    half: e.half,
    clock_seconds: e.clock_seconds,
    points_attacker: e.points_attacker,
    points_defender: e.points_defender,
    attacking_team_id: e.attacking_team_id,
    created_at: e.created_at,
    raider: lookupPlayer(e.raider_id),
    defenders: ((e.defender_ids as string[] | null) ?? [])
      .map((id) => lookupPlayer(id))
      .filter((p): p is { fullName: string; jerseyNumber: number | null } => p !== null),
  }));

  // Lineup-derived player slots — drives the green/red on-mat indicators
  // under each team name. Mirrors what the scoring console shows.
  const [lineupsRes, statesRes] = await Promise.all([
    supabase
      .from('match_lineups')
      .select('team_id, starting_player_ids')
      .eq('match_id', matchId),
    supabase
      .from('match_player_state')
      .select('player_id, team_id, state')
      .eq('match_id', matchId),
  ]);
  const stateById = new Map<string, string>(
    (statesRes.data ?? []).map((s) => [s.player_id, s.state]),
  );
  function buildSlots(teamId: string) {
    const lineup = lineupsRes.data?.find((l) => l.team_id === teamId);
    const ids = (lineup?.starting_player_ids ?? []) as string[];
    return ids.map((playerId) => ({
      playerId,
      state: stateById.get(playerId) ?? 'on_mat',
    }));
  }
  // @ts-expect-error supabase nested join
  const homeId: string = match.home_team.id;
  // @ts-expect-error supabase nested join
  const awayId: string = match.away_team.id;
  const homeSlots = buildSlots(homeId);
  const awaySlots = buildSlots(awayId);

  // Persisted in-progress raid → drives the "Raid in progress" banner on
  // first paint, before any broadcast arrives.
  let initialRaider: {
    fullName: string;
    jerseyNumber: number | null;
    teamName: string;
  } | null = null;
  if (match.current_raider_id && match.current_attacking_team_id) {
    const raiderPlayer = playerById.get(match.current_raider_id);
    if (raiderPlayer) {
      const teamName =
        match.current_attacking_team_id === homeId
          ? // @ts-expect-error supabase nested join
            (match.home_team.name as string)
          : // @ts-expect-error supabase nested join
            (match.away_team.name as string);
      initialRaider = {
        fullName: raiderPlayer.full_name,
        jerseyNumber: raiderPlayer.jersey_number,
        teamName,
      };
    }
  }

  // @ts-expect-error supabase nested
  const tournament = match.tournament;
  // @ts-expect-error supabase nested
  const tenant = tournament?.tenant;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          {tournament && tenant && (
            <Link
              href={`/t/${tenant.slug}/${tournament.slug}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {tournament.name} →
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LiveMatchDisplay
          matchId={matchId}
          initial={{
            status: match.status,
            homeScore: match.home_score,
            awayScore: match.away_score,
            currentHalf: match.current_half,
            clockSeconds: match.clock_seconds,
            scheduledAt: match.scheduled_at,
            round: match.round,
            // @ts-expect-error supabase nested
            home: match.home_team,
            // @ts-expect-error supabase nested
            away: match.away_team,
          }}
          initialEvents={enrichedEvents}
          homeSlots={homeSlots}
          awaySlots={awaySlots}
          initialRaider={initialRaider}
        />
      </main>
    </div>
  );
}
