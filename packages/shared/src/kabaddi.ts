/**
 * Kabaddi domain rules — single source of truth used by web, mobile, and the
 * scoring engine. If standard PKL rules ever change, edit here.
 */

export const KABADDI = {
  /** Standard PKL half length (20 min). Reference value — NOT used by the
   * scoring console clock; that uses MATCH_HALF_SECONDS below. */
  HALF_DURATION_SECONDS: 20 * 60,
  /** Half length the scoring console counts down from. Configurable per
   * league preference; defaults to 30 min as set by the league owner. */
  MATCH_HALF_SECONDS: 30 * 60,
  HALVES: 2,
  /** Players on the mat per side at the start of a half. */
  PLAYERS_PER_SIDE: 7,
  /** Total squad size (starters + bench) per team in a match. */
  MAX_SQUAD_SIZE: 12,
  /** Bench substitutes per team in a match. */
  MAX_BENCH_SIZE: 5,
  /** Time a raider has to attempt a raid. */
  RAID_TIME_SECONDS: 30,
  /** Successive empty raids that trigger a do-or-die raid. */
  DO_OR_DIE_TRIGGER: 2,
  /** Bonus points awarded when an empty mat is cleared (all-out). */
  ALL_OUT_BONUS: 2,
  /** Super tackle: defending side has 3 or fewer players on the mat. */
  SUPER_TACKLE_DEFENDER_THRESHOLD: 3,
  SUPER_TACKLE_BONUS: 1,
  /** Super raid: 3+ points scored in a single raid. */
  SUPER_RAID_MIN_POINTS: 3,
  /** Yellow-card temporary suspension. */
  YELLOW_CARD_SUSPENSION_SECONDS: 2 * 60,
  /** Team time-outs per match. */
  TIMEOUTS_PER_MATCH: 2,
  /** TV reviews per team per half. */
  REVIEWS_PER_HALF: 1,
  /** Substitutions per team per half. */
  SUBSTITUTIONS_PER_HALF: 5,
  /** Minimum on-mat to claim bonus point. */
  BONUS_MIN_DEFENDERS: 6,
} as const;

export type KabaddiClock = {
  half: number;
  seconds: number;
};

export function formatClock(clock: KabaddiClock): string {
  const mm = Math.floor(clock.seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (clock.seconds % 60).toString().padStart(2, '0');
  return `Q${clock.half} · ${mm}:${ss}`;
}
