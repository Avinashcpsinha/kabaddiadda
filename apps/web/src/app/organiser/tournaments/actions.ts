'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tournamentCreateSchema } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { slugify } from '@/lib/slug';

function readFormString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v === null || v === '') return undefined;
  return String(v);
}

function readFormInt(fd: FormData, key: string): number | undefined {
  const v = readFormString(fd, key);
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function createTournamentAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'You must set up a league first.' };

  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const slug = rawSlug || slugify(name);

  const parsed = tournamentCreateSchema.safeParse({
    name,
    slug,
    description: readFormString(formData, 'description'),
    format: readFormString(formData, 'format') ?? 'league',
    startDate: readFormString(formData, 'startDate'),
    endDate: readFormString(formData, 'endDate'),
    maxTeams: readFormInt(formData, 'maxTeams'),
    entryFee: readFormInt(formData, 'entryFee'),
    prizePool: readFormInt(formData, 'prizePool'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      tenant_id: user.tenantId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      format: parsed.data.format,
      status: 'draft',
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      max_teams: parsed.data.maxTeams,
      entry_fee: parsed.data.entryFee,
      prize_pool: parsed.data.prizePool,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A tournament with that slug already exists.' };
    }
    return { error: error.message };
  }

  revalidatePath('/organiser');
  revalidatePath('/organiser/tournaments');
  redirect(`/organiser/tournaments/${data.id}`);
}

export async function updateTournamentStatusAction(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tournaments')
    .update({ status })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/organiser/tournaments/${id}`);
  revalidatePath('/organiser/tournaments');
  return { ok: true };
}

export async function deleteTournamentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('tournaments').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/organiser/tournaments');
  redirect('/organiser/tournaments');
}
