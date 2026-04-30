import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ScoringConsole } from './scoring-console';

export default async function ScoringPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds, current_raider_id, current_attacking_team_id, home_dod_counter, away_dod_counter, home_reviews_used, away_reviews_used, home_timeouts_used, away_timeouts_used, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
    )
    .eq('id', matchId)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!match) notFound();

  const { data: events } = await supabase
    .from('match_events')
    .select(
      'id, type, half, clock_seconds, points_attacker, points_defender, attacking_team_id, raider_id, defender_ids, created_at',
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(30);

  const [lineupsRes, statesRes] = await Promise.all([
    supabase
      .from('match_lineups')
      .select('team_id, starting_player_ids')
      .eq('match_id', matchId),
    supabase
      .from('match_player_state')
      .select('player_id, team_id, state, suspended_until_seconds, suspended_until_half')
      .eq('match_id', matchId),
  ]);

  const stateById = new Map<string, string>(
    (statesRes.data ?? []).map((s) => [s.player_id, s.state]),
  );

  // Player IDs we need names + jerseys for: every rostered player (state row)
  // PLUS every raider / defender referenced in recent events (for commentary).
  const referencedIds = new Set<string>();
  for (const s of statesRes.data ?? []) referencedIds.add(s.player_id);
  for (const e of events ?? []) {
    if (e.raider_id) referencedIds.add(e.raider_id);
    const defenders = (e.defender_ids as string[] | null) ?? [];
    for (const id of defenders) referencedIds.add(id);
  }

  const playerById = new Map<
    string,
    { full_name: string; jersey_number: number | null; role: string }
  >();
  if (referencedIds.size > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name, jersey_number, role')
      .in('id', Array.from(referencedIds));
    for (const p of players ?? []) {
      playerById.set(p.id, {
        full_name: p.full_name,
        jersey_number: p.jersey_number,
        role: p.role,
      });
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

  // Build slots from match_player_state — gives ALL rostered players (mat,
  // bench, out, suspended, red-carded), not just the original starters.
  // The UI filters to whichever subset it needs (raider picker, sub picker,
  // dots, etc.). Sorted by jersey for deterministic ordering.
  type StateRow = (typeof statesRes.data extends (infer R)[] | null ? R : never);
  function buildSlots(teamId: string) {
    const rows = (statesRes.data ?? [])
      .filter((s: StateRow) => s.team_id === teamId)
      .map((s: StateRow) => {
        const p = playerById.get(s.player_id);
        return {
          playerId: s.player_id,
          state: s.state,
          suspendedUntilSeconds: s.suspended_until_seconds,
          suspendedUntilHalf: s.suspended_until_half,
          fullName: p?.full_name ?? 'Unknown',
          jerseyNumber: p?.jersey_number ?? null,
          role: p?.role ?? 'all_rounder',
        };
      });
    rows.sort((a, b) => {
      const aj = a.jerseyNumber ?? 9999;
      const bj = b.jerseyNumber ?? 9999;
      return aj - bj;
    });
    return rows;
  }
  // Use the lineup (if not yet initialized via initialize_match_player_state)
  // as a fallback so a freshly-locked lineup with no state rows yet still works.
  void lineupsRes;
  void stateById;

  // @ts-expect-error supabase nested join
  const homeId: string = match.home_team.id;
  // @ts-expect-error supabase nested join
  const awayId: string = match.away_team.id;
  const homeSlots = buildSlots(homeId);
  const awaySlots = buildSlots(awayId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/organiser/tournaments/${id}/matches/${matchId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Match details
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href={`/live/${matchId}`} target="_blank">
            <ExternalLink className="h-3 w-3" />
            Public live page
          </Link>
        </Button>
      </div>

      <ScoringConsole
        matchId={matchId}
        tournamentId={id}
        initial={{
          status: match.status,
          homeScore: match.home_score,
          awayScore: match.away_score,
          currentHalf: match.current_half,
          clockSeconds: match.clock_seconds,
          currentRaiderId: match.current_raider_id ?? null,
          currentAttackingTeamId: match.current_attacking_team_id ?? null,
          homeDodCounter: match.home_dod_counter ?? 0,
          awayDodCounter: match.away_dod_counter ?? 0,
          homeReviewsUsed: match.home_reviews_used ?? 0,
          awayReviewsUsed: match.away_reviews_used ?? 0,
          // @ts-expect-error supabase nested join
          home: match.home_team,
          // @ts-expect-error supabase nested join
          away: match.away_team,
        }}
        recentEvents={enrichedEvents}
        homeSlots={homeSlots}
        awaySlots={awaySlots}
      />
    </div>
  );
}
