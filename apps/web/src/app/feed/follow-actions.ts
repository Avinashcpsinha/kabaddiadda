'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type FollowTargetType = 'tournament' | 'team' | 'player';

export async function toggleFollowAction(
  targetType: FollowTargetType,
  targetId: string,
  currentlyFollowing: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in to follow.' };

  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('follows').insert({
      user_id: user.id,
      target_type: targetType,
      target_id: targetId,
    });
    if (error && error.code !== '23505') return { error: error.message };
  }

  revalidatePath('/feed/following');
  return { ok: true, following: !currentlyFollowing };
}
