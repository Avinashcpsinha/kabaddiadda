'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

interface CreateMatchInput {
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  round?: string;
  venueId?: string;
}

export async function createMatchAction(tournamentId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const home = String(formData.get('homeTeamId') ?? '');
  const away = String(formData.get('awayTeamId') ?? '');
  const scheduledAt = String(formData.get('scheduledAt') ?? '');
  const round = String(formData.get('round') ?? '').trim() || null;

  if (!home || !away) return { error: 'Pick both teams' };
  if (home === away) return { error: 'A team cannot play itself' };
  if (!scheduledAt) return { error: 'Pick a date and time' };

  const supabase = await createClient();
  const { error } = await supabase.from('matches').insert({
    tenant_id: user.tenantId,
    tournament_id: tournamentId,
    home_team_id: home,
    away_team_id: away,
    scheduled_at: new Date(scheduledAt).toISOString(),
    round,
    status: 'scheduled',
  });

  if (error) return { error: error.message };

  revalidatePath(`/organiser/tournaments/${tournamentId}/fixtures`);
  revalidatePath(`/organiser/tournaments/${tournamentId}`);
  return { ok: true };
}

/** Generate every team-vs-team pairing (round-robin) for the tournament. */
export async function autoGenerateRoundRobinAction(tournamentId: string, startIso: string) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .order('name');

  if (!teams || teams.length < 2) {
    return { error: 'Add at least 2 teams before generating fixtures.' };
  }

  // Avoid duplicating fixtures if some already exist.
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  if ((count ?? 0) > 0) {
    return { error: 'Fixtures already exist. Delete them first or add manually.' };
  }

  const start = new Date(startIso);
  const inserts: Array<Record<string, unknown>> = [];
  let matchIndex = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      // Schedule one match per day at the same hour for now.
      const when = new Date(start.getTime() + matchIndex * 24 * 60 * 60 * 1000);
      inserts.push({
        tenant_id: user.tenantId,
        tournament_id: tournamentId,
        home_team_id: teams[i].id,
        away_team_id: teams[j].id,
        scheduled_at: when.toISOString(),
        round: `Round ${matchIndex + 1}`,
        status: 'scheduled',
      });
      matchIndex++;
    }
  }

  const { error } = await supabase.from('matches').insert(inserts);
  if (error) return { error: error.message };

  revalidatePath(`/organiser/tournaments/${tournamentId}/fixtures`);
  revalidatePath(`/organiser/tournaments/${tournamentId}`);
  return { ok: true, count: inserts.length };
}

export async function deleteMatchAction(tournamentId: string, matchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) return { error: error.message };
  revalidatePath(`/organiser/tournaments/${tournamentId}/fixtures`);
  return { ok: true };
}
