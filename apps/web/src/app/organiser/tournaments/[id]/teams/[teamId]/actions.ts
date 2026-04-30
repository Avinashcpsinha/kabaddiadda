'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { playerCreateSchema, mobileSchema } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function readInt(fd: FormData, key: string): number | undefined {
  const v = fd.get(key);
  if (v === null || v === '') return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

function readTrimmed(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

async function uploadPlayerPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  teamId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (file.size === 0) return {};
  if (file.size > MAX_PHOTO_BYTES) return { error: 'Photo must be under 2MB.' };
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return { error: 'Photo must be JPEG, PNG, or WebP.' };
  }

  const path = `${tenantId}/${teamId}/${randomUUID()}.${extFromMime(file.type)}`;
  const { error } = await supabase.storage
    .from('player-photos')
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) return { error: `Photo upload failed: ${error.message}` };

  const { data } = supabase.storage.from('player-photos').getPublicUrl(path);
  return { url: data.publicUrl };
}

interface PersonInput {
  mobile: string;
  fullName: string;
  pan?: string;
  aadhaar?: string;
  photoUrl?: string;
}

/**
 * Find a person by mobile, or create one if missing. If found and the caller
 * has new fields the existing record lacks, fill those in. Returns the
 * person's UUID.
 */
async function findOrCreatePerson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PersonInput,
): Promise<string> {
  const { data: existing } = await supabase
    .from('people')
    .select('id, full_name, photo_url, pan, aadhaar')
    .eq('mobile', input.mobile)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, string> = {};
    if (input.pan && !existing.pan) patch.pan = input.pan;
    if (input.aadhaar && !existing.aadhaar) patch.aadhaar = input.aadhaar;
    if (input.photoUrl) patch.photo_url = input.photoUrl;
    if (Object.keys(patch).length > 0) {
      await supabase.from('people').update(patch).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      mobile: input.mobile,
      full_name: input.fullName,
      pan: input.pan,
      aadhaar: input.aadhaar,
      photo_url: input.photoUrl,
    })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

export async function createPlayerAction(
  tournamentId: string,
  teamId: string,
  formData: FormData,
) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const parsed = playerCreateSchema.safeParse({
    fullName: String(formData.get('fullName') ?? '').trim(),
    jerseyNumber: readInt(formData, 'jerseyNumber'),
    role: String(formData.get('role') ?? 'all_rounder'),
    heightCm: readInt(formData, 'heightCm'),
    weightKg: readInt(formData, 'weightKg'),
    isCaptain: formData.get('isCaptain') === 'on',
    mobile: readTrimmed(formData, 'mobile'),
    pan: readTrimmed(formData, 'pan')?.toUpperCase(),
    aadhaar: readTrimmed(formData, 'aadhaar')?.replace(/\s+/g, ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  let photoUrl: string | undefined;
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const res = await uploadPlayerPhoto(supabase, user.tenantId, teamId, photo);
    if (res.error) return { error: res.error };
    photoUrl = res.url;
  }

  let personId: string | null = null;
  if (parsed.data.mobile) {
    try {
      personId = await findOrCreatePerson(supabase, {
        mobile: parsed.data.mobile,
        fullName: parsed.data.fullName,
        pan: parsed.data.pan,
        aadhaar: parsed.data.aadhaar,
        photoUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register person';
      return { error: msg };
    }
  }

  const { error } = await supabase.from('players').insert({
    tenant_id: user.tenantId,
    team_id: teamId,
    person_id: personId,
    full_name: parsed.data.fullName,
    jersey_number: parsed.data.jerseyNumber,
    role: parsed.data.role,
    height_cm: parsed.data.heightCm,
    weight_kg: parsed.data.weightKg,
    is_captain: parsed.data.isCaptain,
    photo_url: photoUrl,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'This person is already on this team.' };
    }
    if (error.code === '23514') {
      return { error: 'A field failed format validation (PAN / Aadhaar).' };
    }
    return { error: error.message };
  }

  if (parsed.data.isCaptain) {
    await supabase
      .from('players')
      .update({ is_captain: false })
      .eq('team_id', teamId)
      .neq('full_name', parsed.data.fullName);
  }

  revalidatePath(`/organiser/tournaments/${tournamentId}/teams/${teamId}`);
  return { ok: true };
}

export async function deletePlayerAction(
  tournamentId: string,
  teamId: string,
  playerId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) return { error: error.message };
  revalidatePath(`/organiser/tournaments/${tournamentId}/teams/${teamId}`);
  return { ok: true };
}

export interface PersonLookupResult {
  id: string;
  fullName: string;
  photoUrl: string | null;
  hasPan: boolean;
  hasAadhaar: boolean;
  rosterCount: number;
}

/**
 * Look up a person by mobile so the form can autofill name/photo and signal
 * "this human already exists". Used by the Add Player form on field blur.
 */
export async function lookupPersonByMobileAction(
  mobileRaw: string,
): Promise<{ found: false } | { found: true; person: PersonLookupResult } | { error: string }> {
  const parsed = mobileSchema.safeParse(mobileRaw);
  if (!parsed.success) return { error: 'Invalid mobile format' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('people')
    .select('id, full_name, photo_url, pan, aadhaar')
    .eq('mobile', parsed.data)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { found: false };

  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', data.id);

  return {
    found: true,
    person: {
      id: data.id,
      fullName: data.full_name,
      photoUrl: data.photo_url,
      hasPan: Boolean(data.pan),
      hasAadhaar: Boolean(data.aadhaar),
      rosterCount: count ?? 0,
    },
  };
}
