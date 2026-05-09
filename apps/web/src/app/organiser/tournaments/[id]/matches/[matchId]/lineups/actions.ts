'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { KABADDI } from '@kabaddiadda/shared';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface LineupInput {
  teamId: string;
  startingPlayerIds: string[];
  benchPlayerIds: string[];
  captainId: string | null;
}

export async function setMatchLineupsAndStartAction(
  tournamentId: string,
  matchId: string,
  lineups: LineupInput[],
  options: { startMatch: boolean; halfSeconds?: number } = { startMatch: true },
) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  // Half-length sanity bounds. 5 min minimum is short enough for a
  // demo / friendly; 60 min is more than any kabaddi format ever runs.
  // Anything outside is almost certainly a typo.
  if (options.halfSeconds != null) {
    if (
      !Number.isFinite(options.halfSeconds) ||
      options.halfSeconds < 5 * 60 ||
      options.halfSeconds > 60 * 60
    ) {
      return { error: 'Half length must be between 5 and 60 minutes' };
    }
  }

  for (const l of lineups) {
    if (l.startingPlayerIds.length !== KABADDI.PLAYERS_PER_SIDE) {
      return {
        error: `Each team must have exactly ${KABADDI.PLAYERS_PER_SIDE} starters on the mat`,
      };
    }
    if (l.benchPlayerIds.length > KABADDI.MAX_BENCH_SIZE) {
      return { error: `Bench can have at most ${KABADDI.MAX_BENCH_SIZE} players` };
    }
    const all = [...l.startingPlayerIds, ...l.benchPlayerIds];
    if (new Set(all).size !== all.length) {
      return { error: 'A player cannot be both on the mat and on the bench' };
    }
    if (l.captainId && !l.startingPlayerIds.includes(l.captainId)) {
      return { error: 'Captain must be in the starting lineup' };
    }
  }

  const supabase = await createClient();

  for (const l of lineups) {
    const { error } = await supabase.from('match_lineups').upsert(
      {
        tenant_id: user.tenantId,
        match_id: matchId,
        team_id: l.teamId,
        starting_player_ids: l.startingPlayerIds,
        bench_player_ids: l.benchPlayerIds,
        captain_id: l.captainId,
      },
      { onConflict: 'match_id,team_id' },
    );
    if (error) return { error: error.message };
  }

  // Persist the half length whenever it's provided — both on Save draft
  // (so reopening the lineup remembers the choice) and on Lock & start.
  if (options.halfSeconds != null) {
    const { error: hsErr } = await supabase
      .from('matches')
      .update({ half_seconds: options.halfSeconds })
      .eq('id', matchId);
    if (hsErr) return { error: hsErr.message };
  }

  if (options.startMatch) {
    const { error: rpcErr } = await supabase.rpc('initialize_match_player_state', {
      p_match_id: matchId,
    });
    if (rpcErr) return { error: rpcErr.message };

    const { error: matchErr } = await supabase
      .from('matches')
      .update({ status: 'live', current_half: 1, clock_seconds: 0 })
      .eq('id', matchId);
    if (matchErr) return { error: matchErr.message };

    await supabase
      .from('tournaments')
      .update({ status: 'live' })
      .eq('id', tournamentId)
      .eq('status', 'scheduled');
  }

  revalidatePath(`/organiser/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/organiser/tournaments/${tournamentId}/matches/${matchId}/lineups`);
  revalidatePath(`/organiser/tournaments/${tournamentId}/fixtures`);

  if (options.startMatch) {
    redirect(`/organiser/tournaments/${tournamentId}/matches/${matchId}/scoring`);
  }
  return { ok: true };
}
