import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  LineupBuilder,
  type InitialLineup,
  type RosterPlayer,
  type TeamLite,
} from './lineup-builder';

const EMPTY_LINEUP: InitialLineup = { startingPlayerIds: [], benchPlayerIds: [], captainId: null };

export default async function LineupsPage({
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
      'id, status, scheduled_at, round, home_team_id, away_team_id, home_team:home_team_id(id, name, short_name, primary_color), away_team:away_team_id(id, name, short_name, primary_color)',
    )
    .eq('id', matchId)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!match) notFound();

  const teamIds = [match.home_team_id, match.away_team_id];

  const { data: players } = await supabase
    .from('players')
    .select('id, full_name, jersey_number, role, photo_url, is_captain, team_id')
    .in('team_id', teamIds)
    .order('jersey_number', { ascending: true, nullsFirst: false });

  const { data: existingLineups } = await supabase
    .from('match_lineups')
    .select('team_id, starting_player_ids, bench_player_ids, captain_id')
    .eq('match_id', matchId);

  const homeRoster: RosterPlayer[] = (players ?? [])
    .filter((p) => p.team_id === match.home_team_id)
    .map(stripTeam);
  const awayRoster: RosterPlayer[] = (players ?? [])
    .filter((p) => p.team_id === match.away_team_id)
    .map(stripTeam);

  const initialHome = lineupToInitial(
    existingLineups?.find((l) => l.team_id === match.home_team_id),
  );
  const initialAway = lineupToInitial(
    existingLineups?.find((l) => l.team_id === match.away_team_id),
  );

  // Supabase typegen incorrectly infers single foreign-key embeds as arrays.
  const home = match.home_team as unknown as TeamLite;
  const away = match.away_team as unknown as TeamLite;

  const locked = match.status !== 'scheduled';

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
        {match.round && (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {match.round}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set the lineup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the 7 starters on the mat and up to 5 substitutes on the bench for each team.
          Locking the lineup starts the match and opens the scoring console.
        </p>
      </div>

      <LineupBuilder
        matchId={matchId}
        tournamentId={id}
        home={home}
        away={away}
        homeRoster={homeRoster}
        awayRoster={awayRoster}
        initialHome={initialHome}
        initialAway={initialAway}
        locked={locked}
      />
    </div>
  );
}

function stripTeam(p: {
  id: string;
  full_name: string;
  jersey_number: number | null;
  role: string;
  photo_url: string | null;
  is_captain: boolean;
}): RosterPlayer {
  return {
    id: p.id,
    full_name: p.full_name,
    jersey_number: p.jersey_number,
    role: p.role,
    photo_url: p.photo_url,
    is_captain: p.is_captain,
  };
}

function lineupToInitial(
  l:
    | {
        starting_player_ids: string[] | null;
        bench_player_ids: string[] | null;
        captain_id: string | null;
      }
    | undefined,
): InitialLineup {
  if (!l) return EMPTY_LINEUP;
  return {
    startingPlayerIds: l.starting_player_ids ?? [],
    benchPlayerIds: l.bench_player_ids ?? [],
    captainId: l.captain_id,
  };
}
