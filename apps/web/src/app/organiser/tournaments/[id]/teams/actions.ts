'use server';

import { revalidatePath } from 'next/cache';
import { teamCreateSchema } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

export async function createTeamAction(tournamentId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const parsed = teamCreateSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    shortName: String(formData.get('shortName') ?? '').trim() || undefined,
    city: String(formData.get('city') ?? '').trim() || undefined,
    primaryColor: String(formData.get('primaryColor') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('teams').insert({
    tenant_id: user.tenantId,
    tournament_id: tournamentId,
    name: parsed.data.name,
    short_name: parsed.data.shortName,
    city: parsed.data.city,
    primary_color: parsed.data.primaryColor,
  });

  if (error) return { error: error.message };
  revalidatePath(`/organiser/tournaments/${tournamentId}/teams`);
  revalidatePath(`/organiser/tournaments/${tournamentId}`);
  return { ok: true };
}

export async function deleteTeamAction(tournamentId: string, teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) return { error: error.message };
  revalidatePath(`/organiser/tournaments/${tournamentId}/teams`);
  revalidatePath(`/organiser/tournaments/${tournamentId}`);
  return { ok: true };
}
