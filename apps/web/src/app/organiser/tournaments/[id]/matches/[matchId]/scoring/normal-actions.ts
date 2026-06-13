'use server';

import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

/**
 * Undo the most recent event in a Normal (v1) match.
 *
 * The score trigger (apply_match_event_score) reverses the points on
 * DELETE, so removing the latest event corrects the scoreboard. No
 * player-state recompute is needed — the v2 out/revival engine is dormant
 * for v1 matches, so there is nothing to replay.
 */
export async function undoLastEventAction(input: { matchId: string }) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { data: last, error: readErr } = await supabase
    .from('match_events')
    .select('id')
    .eq('match_id', input.matchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!last) return { error: 'Nothing to undo yet.' };

  const { error } = await supabase.from('match_events').delete().eq('id', last.id);
  if (error) return { error: error.message };
  return { ok: true };
}
