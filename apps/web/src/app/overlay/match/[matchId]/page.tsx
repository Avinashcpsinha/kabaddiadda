import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OverlayStrip } from './overlay-strip';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return { title: `Overlay · ${matchId.slice(0, 8)}`, robots: { index: false } };
}

/**
 * Broadcaster overlay — meant to be loaded as an OBS / Streamyard browser
 * source. Renders a transparent strip pinned to the bottom of the canvas
 * with team logos, scores, dual timers (match + raid), per-side status
 * dots (green = on mat, red = OUT), and side-specific text:
 *   • the attacking team's side shows the current raider name
 *   • the other side shows the most recent event's commentary
 *
 * Recommended OBS settings: 1920×220 browser source, transparent canvas.
 */
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { matchId } = await params;
  const { preview } = await searchParams;
  const previewMode = preview === '1' || preview === 'true';
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      `id, status, home_score, away_score, current_half, clock_seconds, half_seconds,
       current_raider_id, current_attacking_team_id,
       home_dod_counter, away_dod_counter,
       home_team_id, away_team_id,
       home_team:home_team_id(id, name, short_name, primary_color),
       away_team:away_team_id(id, name, short_name, primary_color)`,
    )
    .eq('id', matchId)
    .maybeSingle();

  if (!match) notFound();

  // Lineups + per-player state — drives the green/red dots.
  const [lineupsRes, statesRes, lastEventsRes] = await Promise.all([
    supabase
      .from('match_lineups')
      .select('team_id, starting_player_ids')
      .eq('match_id', matchId),
    supabase
      .from('match_player_state')
      .select('player_id, team_id, state')
      .eq('match_id', matchId),
    supabase
      .from('match_events')
      .select(
        'id, type, attacking_team_id, points_attacker, points_defender, raider_id, defender_ids, details, created_at',
      )
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  // Build slots from EVERY match_player_state row for the team (not just
  // the original starting 7) so a substitute who's been subbed in shows
  // up correctly. Mirrors the scoring console's slot logic so the dot
  // strip in the broadcast overlay matches the operator's view.
  void lineupsRes;
  function buildSlots(teamId: string) {
    return (statesRes.data ?? [])
      .filter((s) => s.team_id === teamId)
      .map((s) => ({ playerId: s.player_id, state: s.state }));
  }

  // Fetch every rostered player for both teams in one go — gives the client
  // a complete name lookup so realtime events arriving with raw player IDs
  // (raider_id / defender_ids) can render with names without a round-trip.
  const { data: players } = await supabase
    .from('players')
    .select('id, full_name, jersey_number')
    .in('team_id', [match.home_team_id, match.away_team_id]);

  const playerMap: Record<string, { fullName: string; jerseyNumber: number | null }> = {};
  for (const p of players ?? []) {
    playerMap[p.id] = { fullName: p.full_name, jerseyNumber: p.jersey_number };
  }

  function lookupPlayer(id: string | null | undefined) {
    if (!id) return null;
    const p = playerMap[id];
    if (!p) return null;
    return { fullName: p.fullName, jerseyNumber: p.jerseyNumber };
  }

  // Resolve in-progress raider name for first paint.
  let initialRaider: {
    fullName: string;
    jerseyNumber: number | null;
    teamName: string;
  } | null = null;
  if (match.current_raider_id && match.current_attacking_team_id) {
    const p = lookupPlayer(match.current_raider_id);
    if (p) {
      // @ts-expect-error supabase nested join
      const homeId: string = match.home_team.id;
      const teamName =
        match.current_attacking_team_id === homeId
          ? // @ts-expect-error supabase nested join
            (match.home_team.name as string)
          : // @ts-expect-error supabase nested join
            (match.away_team.name as string);
      initialRaider = { ...p, teamName };
    }
  }

  // Last event, enriched with player refs for the commentary line.
  const last = lastEventsRes.data?.[0];
  const initialLastEvent = last
    ? {
        type: last.type,
        attackingTeamId: last.attacking_team_id,
        pointsAttacker: last.points_attacker,
        pointsDefender: last.points_defender,
        raider: lookupPlayer(last.raider_id),
        defenders: ((last.defender_ids as string[] | null) ?? [])
          .map((id) => lookupPlayer(id))
          .filter((p): p is { fullName: string; jerseyNumber: number | null } => p !== null),
        details: (last.details as Record<string, unknown> | null) ?? null,
      }
    : null;

  // @ts-expect-error supabase nested join
  const homeId: string = match.home_team.id;
  // @ts-expect-error supabase nested join
  const awayId: string = match.away_team.id;

  return (
    <OverlayStrip
      matchId={matchId}
      previewMode={previewMode}
      initial={{
        status: match.status,
        homeScore: match.home_score,
        awayScore: match.away_score,
        currentHalf: match.current_half,
        clockSeconds: match.clock_seconds,
        halfSeconds: match.half_seconds ?? 1800,
        currentAttackingTeamId: match.current_attacking_team_id ?? null,
        homeDodCounter: match.home_dod_counter ?? 0,
        awayDodCounter: match.away_dod_counter ?? 0,
        currentRaider: initialRaider,
        // @ts-expect-error supabase nested join
        home: match.home_team,
        // @ts-expect-error supabase nested join
        away: match.away_team,
        homeSlots: buildSlots(homeId),
        awaySlots: buildSlots(awayId),
        lastEvent: initialLastEvent,
        playerMap,
      }}
    />
  );
}
