'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

export type EventType =
  | 'raid_point'
  | 'tackle_point'
  | 'bonus_point'
  | 'super_raid'
  | 'super_tackle'
  | 'all_out'
  | 'do_or_die_raid'
  | 'empty_raid'
  | 'time_out'
  | 'green_card'
  | 'yellow_card'
  | 'red_card'
  | 'card_expired'
  | 'technical_point'
  | 'substitution'
  | 'review_upheld'
  | 'review_overturned';

const KABADDI_BONUS_MIN_DEFENDERS = 6;
const SUPER_TACKLE_THRESHOLD = 3;

interface RecordEventInput {
  matchId: string;
  type: EventType;
  attackingTeamId: string;
  pointsAttacker: number;
  pointsDefender: number;
  half: number;
  clockSeconds: number;
  /** Player ID of the raider for this event. Used by the v2 state trigger. */
  raiderId?: string | null;
  /** Player IDs of defenders involved (touched, or tackling). */
  defenderIds?: string[];
}

export async function recordMatchEventAction(input: RecordEventInput) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();

  // Look up the match's team layout once for both auto-promotion and the
  // bonus precondition check. v1 matches skip these (legacy console).
  const { data: m } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, scoring_version')
    .eq('id', input.matchId)
    .maybeSingle();

  let effectiveType = input.type;
  let effectivePointsDefender = input.pointsDefender;

  if (m && m.scoring_version === 2 && input.attackingTeamId) {
    const defendingTeamId =
      m.home_team_id === input.attackingTeamId ? m.away_team_id : m.home_team_id;

    // Count defenders on mat at the moment the event fires (BEFORE any state
    // change). Used by both the super-tackle promotion + the bonus precondition.
    const { count: defendersOnMat } = await supabase
      .from('match_player_state')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', input.matchId)
      .eq('team_id', defendingTeamId)
      .eq('state', 'on_mat');

    // AUTO-PROMOTE TACKLE → SUPER-TACKLE
    // Per IKF/PKL: a tackle made when ≤3 defenders are on mat at raid start
    // is a Super Tackle (+2 instead of +1). The operator might tap "Tackle"
    // by reflex; auto-promote here so the score is right.
    if (input.type === 'tackle_point' && defendersOnMat !== null && defendersOnMat <= SUPER_TACKLE_THRESHOLD) {
      effectiveType = 'super_tackle';
      effectivePointsDefender = 2;
    }

    // BONUS PRECONDITION
    // Bonus point requires ≥6 defenders on mat. Block pure bonus_point if not.
    // (Touch+Bonus combos are recorded as raid_point and we trust the operator.)
    if (input.type === 'bonus_point' && defendersOnMat !== null && defendersOnMat < KABADDI_BONUS_MIN_DEFENDERS) {
      return {
        error: `Bonus point requires ≥${KABADDI_BONUS_MIN_DEFENDERS} defenders on mat (only ${defendersOnMat} present).`,
      };
    }
  }

  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: effectiveType,
    attacking_team_id: input.attackingTeamId,
    points_attacker: input.pointsAttacker,
    points_defender: effectivePointsDefender,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId ?? null,
    defender_ids: input.defenderIds && input.defenderIds.length > 0 ? input.defenderIds : null,
    is_super_raid: effectiveType === 'super_raid',
    is_super_tackle: effectiveType === 'super_tackle',
    is_all_out: effectiveType === 'all_out',
    created_by: user.id,
  });

  if (error) return { error: error.message };

  // Persist the live clock + half AND clear the in-progress raider so a
  // refresh sees the right time and the raid banner disappears.
  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  // The match score is updated by the apply_match_event_score trigger.
  // The match_player_state is updated by trg_maintain_player_state.
  // The client calls router.refresh() to re-fetch server data without losing
  // local clock state.
  const promotedToSuperTackle = effectiveType === 'super_tackle' && input.type === 'tackle_point';
  return { ok: true, promotedToSuperTackle };
}

/**
 * Lightweight persist for in-progress timer + raid state.
 * Called by the scoring console:
 *   • every ~5 seconds while the clock is running (so a refresh resumes
 *     within ~5s of where the clock actually was)
 *   • on raider pick / unpick (so the in-progress raid survives a refresh)
 */
export async function persistTimerStateAction(input: {
  matchId: string;
  clockSeconds: number;
  currentHalf: number;
  currentRaiderId: string | null;
  currentAttackingTeamId: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.currentHalf,
      current_raider_id: input.currentRaiderId,
      current_attacking_team_id: input.currentAttackingTeamId,
    })
    .eq('id', input.matchId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteMatchEventAction(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('match_events').delete().eq('id', eventId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================
// Card events (green / yellow / red)
// ============================================================
export async function recordCardAction(input: {
  matchId: string;
  attackingTeamId: string; // The team the carded player belongs to
  playerId: string;
  color: 'green' | 'yellow' | 'red';
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const eventType: EventType =
    input.color === 'green' ? 'green_card' : input.color === 'yellow' ? 'yellow_card' : 'red_card';

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: eventType,
    attacking_team_id: input.attackingTeamId,
    points_attacker: 0,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.playerId,
    card_color: input.color,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Called by the client when a yellow-card suspension expires (after 2 min
 * of half clock). Records a `card_expired` event so the trigger can revive
 * the player and the timeline shows the lifecycle.
 */
export async function expireCardAction(input: {
  matchId: string;
  teamId: string;
  playerId: string;
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'card_expired',
    attacking_team_id: input.teamId,
    points_attacker: 0,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.playerId,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================
// Substitution
// ============================================================
export async function recordSubstitutionAction(input: {
  matchId: string;
  teamId: string;
  playerInId: string; // bench → on_mat
  playerOutId: string; // on_mat → bench
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  if (input.playerInId === input.playerOutId) {
    return { error: 'Cannot substitute a player with themselves.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'substitution',
    attacking_team_id: input.teamId,
    points_attacker: 0,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    details: { in: input.playerInId, out: input.playerOutId },
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================
// Technical point (referee award)
// ============================================================
export async function recordTechPointAction(input: {
  matchId: string;
  receivingTeamId: string;
  reason?: string;
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'technical_point',
    attacking_team_id: input.receivingTeamId,
    points_attacker: 1,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    details: input.reason ? { reason: input.reason } : null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================
// Raider out of bounds — covers both forced-out (raider pushed out
// by defenders) and self-out (raider voluntarily exits without
// pressure). Same scoring (defence +1, raider OUT); differentiated
// in stats via details.reason. Modeled as a tackle_point.
// ============================================================
export async function recordRaiderOutOfBoundsAction(input: {
  matchId: string;
  attackingTeamId: string; // raiding team (the raider belongs here)
  raiderId: string | null;
  half: number;
  clockSeconds: number;
  reason?: 'raider_out_of_bounds' | 'raider_self_out';
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'tackle_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: 0,
    points_defender: 1,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    details: { reason: input.reason ?? 'raider_out_of_bounds' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  // Clear in-progress raider since the raid resolved.
  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Defender out of bounds — covers both forced-out (defender pushed
// off the mat under raider pressure) and self-out (defender
// voluntarily steps off — tactical or unforced). Attacking team
// gets +1 per defender, those defenders go out. Modeled as a
// raid_point so the existing trigger handles outs correctly.
// ============================================================
export async function recordDefenderOutOfBoundsAction(input: {
  matchId: string;
  attackingTeamId: string;
  raiderId: string | null;
  defenderIds: string[]; // 1+ defenders that stepped out
  half: number;
  clockSeconds: number;
  reason?: 'defender_out_of_bounds' | 'defender_self_out';
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (input.defenderIds.length === 0) {
    return { error: 'Pick at least one defender who stepped out.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'raid_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: input.defenderIds.length,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    defender_ids: input.defenderIds,
    details: { reason: input.reason ?? 'defender_out_of_bounds' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Bonus + Tackle — raider crosses bonus line (attack +1) AND is then
// tackled before reaching mid-line (defence +1, raider OUT, defender
// revives). Modeled as one tackle_point event with both point sides
// non-zero: score trigger sums both, player_state trigger handles the
// out + revival. details.reason flagged so stats can split this from
// a vanilla tackle.
//
// Bonus precondition (≥6 defenders on mat) is enforced here so the
// rule matches the standalone Bonus button.
// ============================================================
const KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO = 6;

export async function recordBonusPlusTackleAction(input: {
  matchId: string;
  attackingTeamId: string; // raiding team
  raiderId: string; // required — the raider who got bonus + got tackled
  defenderIds: string[]; // optional — defenders who made the tackle
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (!input.raiderId) return { error: 'Pick the raider first.' };

  const supabase = await createClient();

  // Bonus precondition — same rule as the standalone Bonus button.
  const { data: m } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, scoring_version')
    .eq('id', input.matchId)
    .maybeSingle();

  if (m && m.scoring_version === 2) {
    const defendingTeamId =
      m.home_team_id === input.attackingTeamId ? m.away_team_id : m.home_team_id;
    const { count: defendersOnMat } = await supabase
      .from('match_player_state')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', input.matchId)
      .eq('team_id', defendingTeamId)
      .eq('state', 'on_mat');
    if (defendersOnMat !== null && defendersOnMat < KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO) {
      return {
        error: `Bonus + Tackle requires ≥${KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO} defenders on mat (only ${defendersOnMat} present).`,
      };
    }
  }

  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'tackle_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: 1, // bonus
    points_defender: 1, // tackle
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    defender_ids: input.defenderIds.length > 0 ? input.defenderIds : null,
    details: { reason: 'bonus_plus_tackle' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  // Raid resolved — clear in-progress raider.
  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Bonus + Raider self-out — raider crosses bonus line (attack +1) and
// then voluntarily steps off the mat (defence +1, raider OUT, defender
// revives). One tackle_point event with both point sides set; trigger
// handles the out + revival. Bonus precondition (≥6 defenders on mat)
// applies, same as B+T.
// ============================================================
export async function recordBonusPlusSelfOutAction(input: {
  matchId: string;
  attackingTeamId: string;
  raiderId: string;
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (!input.raiderId) return { error: 'Pick the raider first.' };

  const supabase = await createClient();

  const { data: m } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, scoring_version')
    .eq('id', input.matchId)
    .maybeSingle();

  if (m && m.scoring_version === 2) {
    const defendingTeamId =
      m.home_team_id === input.attackingTeamId ? m.away_team_id : m.home_team_id;
    const { count: defendersOnMat } = await supabase
      .from('match_player_state')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', input.matchId)
      .eq('team_id', defendingTeamId)
      .eq('state', 'on_mat');
    if (defendersOnMat !== null && defendersOnMat < KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO) {
      return {
        error: `Bonus + Self-out requires ≥${KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO} defenders on mat (only ${defendersOnMat} present).`,
      };
    }
  }

  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'tackle_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: 1, // bonus
    points_defender: 1, // raider out
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    defender_ids: null,
    details: { reason: 'bonus_plus_self_out' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Bonus + Defender self-out(s) — raider crosses bonus line (attack +1)
// AND one or more defenders voluntarily step off the mat
// (attack +N, those defenders OUT, attackers revive N). Modeled as a
// single raid_point with points_attacker = 1 (bonus) + N (defender outs)
// so the existing trigger routes the outs + revivals correctly.
// ============================================================
export async function recordBonusPlusDefenderSelfOutAction(input: {
  matchId: string;
  attackingTeamId: string;
  raiderId: string | null;
  defenderIds: string[];
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (input.defenderIds.length === 0) {
    return { error: 'Pick at least one defender who stepped out.' };
  }

  const supabase = await createClient();

  const { data: m } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, scoring_version')
    .eq('id', input.matchId)
    .maybeSingle();

  if (m && m.scoring_version === 2) {
    const defendingTeamId =
      m.home_team_id === input.attackingTeamId ? m.away_team_id : m.home_team_id;
    const { count: defendersOnMat } = await supabase
      .from('match_player_state')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', input.matchId)
      .eq('team_id', defendingTeamId)
      .eq('state', 'on_mat');
    if (defendersOnMat !== null && defendersOnMat < KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO) {
      return {
        error: `Bonus + Defender out requires ≥${KABADDI_BONUS_MIN_DEFENDERS_FOR_COMBO} defenders on mat at raid start (only ${defendersOnMat} present).`,
      };
    }
  }

  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'raid_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: 1 + input.defenderIds.length,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    defender_ids: input.defenderIds,
    details: { reason: 'bonus_plus_defender_self_out' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Touch + Defender self-out — raider touches some defenders AND one or
// more other defenders voluntarily step off during the same raid. Net:
// attack +(touches + self-outs), every involved defender OUT, attackers
// revive N. Modeled as a single raid_point event so the existing
// trigger handles the outs + revivals; reason flag distinguishes from
// a vanilla touch in stats.
// ============================================================
export async function recordTouchPlusDefenderSelfOutAction(input: {
  matchId: string;
  attackingTeamId: string;
  raiderId: string;
  defenderIds: string[]; // every defender involved (touched + self-out)
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };
  if (!input.raiderId) return { error: 'Pick the raider first.' };
  if (input.defenderIds.length === 0) {
    return { error: 'Pick at least one defender involved in the raid.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'raid_point',
    attacking_team_id: input.attackingTeamId,
    points_attacker: input.defenderIds.length,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    raider_id: input.raiderId,
    defender_ids: input.defenderIds,
    details: { reason: 'touch_plus_defender_self_out' },
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase
    .from('matches')
    .update({
      clock_seconds: input.clockSeconds,
      current_half: input.half,
      current_raider_id: null,
      current_attacking_team_id: null,
    })
    .eq('id', input.matchId);

  return { ok: true };
}

// ============================================================
// Review — operator reverses the most recent event for a team if the
// review was upheld. The undo deletes the event; recompute is run via
// the SQL function so player_state stays consistent.
// ============================================================
export async function callReviewAction(input: {
  matchId: string;
  teamId: string; // The team that called the review
  outcome: 'upheld' | 'overturned';
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();

  // Log the review outcome event for the timeline.
  await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: input.outcome === 'upheld' ? 'review_upheld' : 'review_overturned',
    attacking_team_id: input.teamId,
    points_attacker: 0,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    created_by: user.id,
  });

  // Track review counts on the match row.
  const { data: match } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_reviews_used, away_reviews_used')
    .eq('id', input.matchId)
    .maybeSingle();

  if (match) {
    const isHome = match.home_team_id === input.teamId;
    const patch = isHome
      ? { home_reviews_used: (match.home_reviews_used ?? 0) + 1 }
      : { away_reviews_used: (match.away_reviews_used ?? 0) + 1 };
    await supabase.from('matches').update(patch).eq('id', input.matchId);
  }

  if (input.outcome === 'upheld') {
    // Find and delete the most recent scoring event for this team.
    const { data: lastEvent } = await supabase
      .from('match_events')
      .select('id')
      .eq('match_id', input.matchId)
      .eq('attacking_team_id', input.teamId)
      .not('type', 'in', '(green_card,yellow_card,red_card,card_expired,review_upheld,review_overturned,substitution,time_out,lineup_set,match_end)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEvent) {
      await supabase.from('match_events').delete().eq('id', lastEvent.id);
      // Replay state from scratch so player_state matches the now-shorter event log.
      await supabase.rpc('recompute_match_player_state', { p_match_id: input.matchId });
    }
  }

  return { ok: true };
}

// ============================================================
// Manual score adjustment — referee correction (e.g., scoring system glitch).
// Logged as a technical_point with a "manual_adjust" reason and a delta of ±1.
// ============================================================
export async function adjustScoreAction(input: {
  matchId: string;
  teamId: string;
  delta: 1 | -1;
  reason?: string;
  half: number;
  clockSeconds: number;
}) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: 'Not authorised' };

  const supabase = await createClient();
  const { error } = await supabase.from('match_events').insert({
    tenant_id: user.tenantId,
    match_id: input.matchId,
    type: 'technical_point',
    attacking_team_id: input.teamId,
    // Negative score adjustments stored as negative attacker points; the
    // existing apply_match_event_score trigger handles either sign correctly.
    points_attacker: input.delta,
    points_defender: 0,
    half: input.half,
    clock_seconds: input.clockSeconds,
    details: { reason: input.reason ?? 'manual_adjust', delta: input.delta },
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setMatchStatusAction(
  tournamentId: string,
  matchId: string,
  status: 'scheduled' | 'live' | 'half_time' | 'completed' | 'abandoned',
  patch?: { current_half?: number; clock_seconds?: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('matches')
    .update({ status, ...(patch ?? {}) })
    .eq('id', matchId);

  if (error) return { error: error.message };

  // Bump the tournament to live when its first match goes live.
  if (status === 'live') {
    await supabase
      .from('tournaments')
      .update({ status: 'live' })
      .eq('id', tournamentId)
      .eq('status', 'scheduled');
  }

  revalidatePath(`/organiser/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/organiser/tournaments/${tournamentId}/fixtures`);
  return { ok: true };
}
