import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useSession } from './use-session';

export type FollowTargetType = 'tournament' | 'team' | 'player';

// Hook that returns the current follow state + a toggle function for one
// (target_type, target_id) pair. Optimistically flips local state on toggle
// and reverts if the DB write fails. Mirrors apps/web/src/app/feed/follow-actions.ts.
export function useFollow(targetType: FollowTargetType, targetId: string | null) {
  const { user } = useSession();
  const [following, setFollowing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !targetId) {
      setFollowing(false);
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from('follows')
      .select('target_id')
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();
    setFollowing(!!data);
    setLoaded(true);
  }, [user, targetType, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!user || !targetId) return false;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic

    if (next) {
      const { error } = await supabase.from('follows').insert({
        user_id: user.id,
        target_type: targetType,
        target_id: targetId,
      });
      // 23505 means it already exists — treat that as a successful follow.
      if (error && error.code !== '23505') {
        setFollowing(false);
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      if (error) {
        setFollowing(true);
      }
    }
    setBusy(false);
    return next;
  }, [user, targetType, targetId, following]);

  return { following, loaded, busy, toggle, signedIn: !!user };
}
