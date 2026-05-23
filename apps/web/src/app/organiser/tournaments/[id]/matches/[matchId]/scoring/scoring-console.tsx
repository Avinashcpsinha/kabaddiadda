'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  ArrowRightLeft,
  Eye,
  Flame,
  Gavel,
  HelpCircle,
  LogOut,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Square as SquareIcon,
  Target,
  Timer,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { KABADDI } from '@kabaddiadda/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  beepCaution,
  beepTimeUp,
  beepUrgent,
  beepWarn,
  primeAudio,
} from '@/lib/audio';
import { cn, initials } from '@/lib/utils';
import {
  readRequireConfirm,
  writeRequireConfirm,
} from '@/lib/scoring-prefs';
import {
  adjustScoreAction,
  callReviewAction,
  deleteMatchEventAction,
  expireCardAction,
  persistTimerStateAction,
  recordCardAction,
  recordManualEventAction,
  recordMatchEventAction,
  recordDefenderOutOfBoundsAction,
  recordRaiderOutOfBoundsAction,
  recordSubstitutionAction,
  recordTechPointAction,
  setMatchStatusAction,
  swapPlayerStatesAction,
  type EventType,
} from '../actions';

// Per-match half length is now read from `initial.halfSeconds`. The
// constant in @kabaddiadda/shared remains as a default fallback only.
const RAID_SECONDS = KABADDI.RAID_TIME_SECONDS;

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface PlayerRef {
  fullName: string;
  jerseyNumber: number | null;
}

interface RecentEvent {
  id: string;
  type: string;
  half: number;
  clock_seconds: number;
  points_attacker: number;
  points_defender: number;
  attacking_team_id: string;
  /** details.reason flag — distinguishes raid_point variants (touch
   *  vs defender_self_out vs touch_plus_defender_self_out) and
   *  tackle_point variants (vanilla vs raider_self_out vs
   *  bonus_plus_tackle). Drives the commentary template. */
  reason?: string | null;
  created_at: string;
  raider: PlayerRef | null;
  defenders: PlayerRef[];
  /** Substitution-only — populated for type==='substitution' events. */
  playerIn?: PlayerRef | null;
  playerOut?: PlayerRef | null;
}

interface InitialState {
  status: string;
  homeScore: number;
  awayScore: number;
  currentHalf: number;
  clockSeconds: number;
  /** Length of one half in seconds, configured at lineup time. */
  halfSeconds: number;
  /** Persisted in-progress raid — restored on refresh. */
  currentRaiderId: string | null;
  currentAttackingTeamId: string | null;
  /** Remaining seconds on the persisted raid timer (0 if no active raid).
   *  Lets a refresh resume the 30s clock from where it was. */
  raidSecondsLeft: number;
  /** Empty-raid streak per team. 2 means the next raid is do-or-die. */
  homeDodCounter: number;
  awayDodCounter: number;
  homeReviewsUsed: number;
  awayReviewsUsed: number;
  home: TeamLite;
  away: TeamLite;
}

export interface PlayerSlot {
  playerId: string;
  /** Current match_player_state.state — 'on_mat' / 'bench' / 'out' / 'suspended' / 'red_carded' / 'injured'. */
  state: string;
  /** Revival queue position when OUT (lowest revives first). null otherwise. */
  outSeq: number | null;
  fullName: string;
  jerseyNumber: number | null;
  role: string;
  /** For yellow-card suspensions: clock-seconds at which the suspension expires. */
  suspendedUntilSeconds: number | null;
  suspendedUntilHalf: number | null;
}

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Raid',
  tackle_point: 'Tackle',
  bonus_point: 'Bonus',
  super_raid: 'Super raid',
  super_tackle: 'Super tackle',
  all_out: 'All out',
  do_or_die_raid: 'Do-or-die raid',
  empty_raid: 'Empty raid',
  time_out: 'Time out',
  substitution: 'Substitution',
  green_card: 'Green card',
  yellow_card: 'Yellow card',
  red_card: 'Red card',
  card_expired: 'Card expired',
  technical_point: 'Technical point',
  review_upheld: 'Review upheld',
  review_overturned: 'Review overturned',
};

function shortName(full: string): string {
  return (full.split(' ')[0] ?? full).slice(0, 12);
}

function formatPlayer(p: PlayerRef): string {
  const jersey = p.jerseyNumber != null ? ` #${p.jerseyNumber}` : '';
  return `${shortName(p.fullName)}${jersey}`;
}

function joinDefenders(defenders: PlayerRef[]): string {
  if (defenders.length === 0) return '';
  if (defenders.length <= 2) return defenders.map(formatPlayer).join(', ');
  return `${defenders.slice(0, 2).map(formatPlayer).join(', ')} +${defenders.length - 2}`;
}

/**
 * Describe a recorded event as a one-line broadcast-style sentence.
 *
 * The string is shown in the event log (right column) — narrow column,
 * so we keep it descriptive but not novel-length. Hover tooltip shows
 * the same string in full.
 *
 * `attackingTeamName` is the short name (e.g. "BEN", "MUM") of the
 * attacking team for the event, used to attribute scores. Falls back
 * to "the raiders" / "the defenders" when missing.
 */
function describeEvent(e: RecentEvent, attackingTeamName: string | null): string {
  const raider = e.raider ? formatPlayer(e.raider) : null;
  const raiderOrFallback = raider ?? 'the raider';
  const defenderText = joinDefenders(e.defenders);
  const defendersOrFallback = defenderText || 'a defender';
  const att = attackingTeamName ?? 'the raiders';
  const N = e.points_attacker;
  const reason = e.reason ?? null;
  const fallback = EVENT_LABEL[e.type] ?? e.type;

  switch (e.type) {
    case 'raid_point': {
      if (reason === 'defender_self_out' || reason === 'defender_out_of_bounds') {
        const verb =
          reason === 'defender_self_out'
            ? 'step off the mat'
            : 'pushed out of bounds';
        if (e.defenders.length > 1) {
          return `${defenderText} ${verb} — ${att} +${N}, ${e.defenders.length} defenders OUT.`;
        }
        return `${defendersOrFallback} ${verb} — ${att} +${N}, defender OUT.`;
      }
      if (reason === 'bonus_plus_defender_self_out') {
        return `${raiderOrFallback} grabs the bonus, ${defendersOrFallback} step off — ${att} +${N}.`;
      }
      if (reason === 'touch_plus_defender_self_out') {
        return `${raiderOrFallback} touches and ${defendersOrFallback} self-exit — ${att} +${N}, ${e.defenders.length} OUT.`;
      }
      if (reason === 'raider_self_out_plus_defender_self_out') {
        return `Mass exit — ${raiderOrFallback} and ${defendersOrFallback} all step off the mat. ${att} +${N}, defence +1.`;
      }
      // Vanilla touch.
      if (raider && defenderText) {
        if (e.defenders.length === 1)
          return `${raider} dives in, taps ${defenderText}, races home — ${att} +${N}.`;
        return `${raider} weaves through the defence and touches ${defenderText} — ${att} +${N}, ${e.defenders.length} defenders OUT.`;
      }
      if (raider) return `${raider} returns with the touch — ${att} +${N}.`;
      return `${fallback} — ${att} +${N}.`;
    }

    case 'super_raid':
      if (raider && defenderText)
        return `SUPER RAID! ${raider} touches ${defenderText} in one breathtaking dash — ${att} +${N}.`;
      if (raider)
        return `SUPER RAID! ${raider} clears the defence single-handedly — ${att} +${N}.`;
      return `Super Raid — ${att} +${N}.`;

    case 'bonus_point':
      if (raider)
        return `${raider} sails across the bonus line and returns home — ${att} +1.`;
      return `Bonus line crossed — ${att} +1.`;

    case 'tackle_point': {
      if (reason === 'bonus_plus_tackle')
        return `${raiderOrFallback} grabbed the bonus but couldn't escape — caught by ${defendersOrFallback}. Both teams +1.`;
      if (reason === 'bonus_plus_self_out')
        return `${raiderOrFallback} bonus then voluntarily steps off — ${att} +1, defence +1.`;
      if (reason === 'raider_self_out')
        return `${raiderOrFallback} steps off voluntarily — raid abandoned, defence +1.`;
      if (reason === 'raider_out_of_bounds')
        return `${raiderOrFallback} forced out of bounds under defender pressure — defence +1.`;
      if (raider && defenderText)
        return `${defenderText} bring down ${raider} — raid over, defence +1.`;
      if (raider) return `${raider} caught by the defence — defence +1.`;
      return `Tackle — defence +1.`;
    }

    case 'super_tackle':
      if (raider && defenderText)
        return `SUPER TACKLE! ${defenderText} catch ${raider} short-handed — defence +2.`;
      if (raider)
        return `SUPER TACKLE on ${raider} — defending side ≤3 on mat — defence +2.`;
      return `Super tackle — defence +2.`;

    case 'do_or_die_raid':
      if (e.points_attacker > 0) {
        if (raider && defenderText)
          return `Do-or-Die converted! ${raider} touches ${defenderText} — ${att} +${N}.`;
        if (raider)
          return `Do-or-Die converted! ${raider} brings home the points — ${att} +${N}.`;
        return `Do-or-Die converted — ${att} +${N}.`;
      }
      if (raider)
        return `Do-or-Die fails — ${raider} OUT, defence +1, counter resets.`;
      return `Do-or-Die fails — defence +1.`;

    case 'empty_raid':
      if (raider)
        return `${raider} returns empty-handed — do-or-die counter ticks up.`;
      return `Empty raid — do-or-die counter ticks up.`;

    case 'all_out':
      return `ALL OUT! ${att} sweep the mat — bonus +2 awarded.`;

    case 'substitution': {
      const inText = e.playerIn ? formatPlayer(e.playerIn) : null;
      const outText = e.playerOut ? formatPlayer(e.playerOut) : null;
      if (inText && outText)
        return `Substitution for ${att}: ${inText} comes on, ${outText} heads to the bench.`;
      if (inText) return `Substitution for ${att}: ${inText} enters the mat.`;
      if (outText) return `Substitution for ${att}: ${outText} comes off.`;
      return `${att} make a substitution.`;
    }

    case 'green_card':
      return raider
        ? `Green card shown to ${raider} — formal warning, no state change.`
        : 'Green card issued.';
    case 'yellow_card':
      return raider
        ? `Yellow card on ${raider} — 2-minute suspension.`
        : 'Yellow card issued.';
    case 'red_card':
      return raider
        ? `Red card on ${raider} — out for the rest of the match.`
        : 'Red card issued.';
    case 'card_expired':
      return raider
        ? `${raider}'s yellow-card suspension expires — back on the mat.`
        : 'Card suspension expires.';

    case 'technical_point':
      return `Technical point awarded — ${att} +${N || 1}.`;

    case 'review_upheld':
      return `Review upheld — last event for ${att} reversed.`;
    case 'review_overturned':
      return `Review overturned — call stands for ${att}.`;

    default:
      return fallback;
  }
}

export function ScoringConsole({
  matchId,
  tournamentId,
  initial,
  recentEvents,
  homeSlots,
  awaySlots,
}: {
  matchId: string;
  tournamentId: string;
  initial: InitialState;
  recentEvents: RecentEvent[];
  homeSlots: PlayerSlot[];
  awaySlots: PlayerSlot[];
}) {
  const router = useRouter();
  const [home, away] = [initial.home, initial.away];
  // Half length is fixed for the duration of the match (set at lineup time);
  // we just read it here. Default mirrors the Kabaddi domain constant in
  // case a stale row is missing the column.
  const halfSeconds = initial.halfSeconds || KABADDI.MATCH_halfSeconds;
  const [status, setStatus] = React.useState(initial.status);
  const [half, setHalf] = React.useState(initial.currentHalf);
  // Internally tracks ELAPSED seconds (matches DB schema + public live page).
  // Display computes remaining = halfSeconds - clock for the countdown.
  // Guard: if status is 'scheduled', start at 0 even if DB has stale clock.
  const [clock, setClock] = React.useState(
    initial.status === 'scheduled' ? 0 : initial.clockSeconds,
  );
  // Initialise running strictly from raid state: the global clock only
  // auto-resumes on entry when a raider is actively on the mat (mid-raid
  // refresh). Any other entry — Lock & Start, Continue scoring, between
  // raids, half-time return — lands paused at the persisted clock value.
  // The operator picks a raider (auto-start effect below) or hits play to
  // resume ticking. This prevents wasted seconds while they orient.
  const [running, setRunning] = React.useState(
    initial.status === 'live' && initial.currentRaiderId !== null,
  );
  // Raid timer: counts DOWN from RAID_SECONDS to 0. Initialised from
  // the persisted raid_seconds_left so a page refresh during an active
  // raid resumes the 30s clock from where it was (instead of arming
  // fresh at 30s every refresh).
  const [raidLeft, setRaidLeft] = React.useState(initial.raidSecondsLeft);
  const [raidRunning, setRaidRunning] = React.useState(
    initial.raidSecondsLeft > 0 && initial.currentRaiderId !== null,
  );
  // Restore the in-progress raid from the persisted match row so a refresh
  // keeps the raider/team selection intact.
  const [attackingId, setAttackingId] = React.useState(
    initial.currentAttackingTeamId ?? home.id,
  );
  const [raiderId, setRaiderId] = React.useState<string | null>(
    initial.currentRaiderId,
  );
  const [touchedDefenderIds, setTouchedDefenderIds] = React.useState<string[]>([]);
  // Swap-mode lets the operator reorder the OUT revival queue. When a raider
  // touches multiple defenders in one raid, the captured `out_seq` may not
  // match real-life order; this lets them fix it before the next revive fires.
  const [swapMode, setSwapMode] = React.useState(false);
  const [swapFirstId, setSwapFirstId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Modal state for the secondary actions (cards, sub, review, manual).
  const [openModal, setOpenModal] = React.useState<
    | null
    | { kind: 'card'; color: 'green' | 'yellow' | 'red'; teamId: string }
    | { kind: 'sub'; teamId: string }
    | { kind: 'review'; teamId: string }
    | { kind: 'manual'; teamId: string }
    | { kind: 'help' }
  >(null);

  // Confirm-before-recording flow. When `requireConfirm` is true (default),
  // tapping a scoring button stages the action into `pendingAction` instead of
  // executing immediately — a separate Confirm click records it. Persisted in
  // localStorage so the operator's choice carries across matches/sessions.
  const [requireConfirm, setRequireConfirm] = React.useState(true);
  React.useEffect(() => {
    setRequireConfirm(readRequireConfirm());
  }, []);
  function toggleRequireConfirm() {
    setRequireConfirm((prev) => {
      const next = !prev;
      writeRequireConfirm(next);
      return next;
    });
  }
  // Queue of staged actions waiting for Get Points / Complete Raid.
  // Each entry carries its own `run` closure that captured the picker
  // selection at click time, so the operator can stack multiple
  // actions (e.g. Touch + Bonus + Defender-out) before committing.
  const [pendingActions, setPendingActions] = React.useState<
    Array<{
      label: string;
      sub: string;
      tone: 'attack' | 'defend' | 'neutral';
      run: () => void;
      /** Whether THIS action terminates the raid. Information-only
       *  flag; the banner always offers both Get Points and Complete
       *  Raid regardless. */
      endsRaid: boolean;
    }>
  >([]);
  // Number of in-raid scoring events committed since the current raider
  // was picked. Drives the "30s auto-finish" empty-raid fallback and the
  // standalone Complete Raid button — if 0 when the raid ends, we fire
  // an empty_raid event automatically; otherwise we just clean up.
  const [actionsThisRaid, setActionsThisRaid] = React.useState(0);
  const actionsThisRaidRef = React.useRef(0);
  React.useEffect(() => {
    actionsThisRaidRef.current = actionsThisRaid;
  }, [actionsThisRaid]);
  const raiderIdRef = React.useRef<string | null>(raiderId);
  React.useEffect(() => {
    raiderIdRef.current = raiderId;
  }, [raiderId]);
  // Reset the counter whenever the raid context resets (raider cleared
  // or the attacking team flips).
  React.useEffect(() => {
    if (!raiderId) setActionsThisRaid(0);
  }, [raiderId]);
  // (No auto-cancel on selection change. Each queued action's run()
  // closure captured the touchedCount / raiderId at click time, so
  // changing selections after staging is safe — the next staged action
  // gets its own fresh snapshot.)
  // Multi-action raid flow:
  //   • stageOrRun stages the action (Confirm-before-scoring on) or runs it
  //     immediately (toggle off). After running, we either keep the raider
  //     and clear defenders only ("Get Points" — the raid continues), or
  //     fully clear and reset the raid timer ("Complete Raid" — raid ends).
  //   • Get Points only makes sense for actions that can chain inside the
  //     same raid (Touch / Bonus / Defender out / Def. self). Tackle /
  //     Empty / Super / Raider out / Self out inherently end the raid, so
  //     the staged banner only shows Complete Raid for those.
  //   • Standalone Complete Raid is always available once a raider has
  //     been picked. If no actions were committed during the raid, it
  //     fires an empty_raid event automatically; otherwise it just clears.
  // Hand the next raid to the opposing team. Kabaddi alternates raids
  // between the two teams — once the current raid resolves (Complete
  // Raid, 30s auto-finish, or an immediate-mode endsRaid action), the
  // attacking-team toggle flips automatically. Operator can still
  // override the toggle manually if a wrong team was set.
  function flipAttackingTeam() {
    setAttackingId((prev) => (prev === home.id ? away.id : home.id));
  }
  function stageOrRun(
    label: string,
    sub: string,
    tone: 'attack' | 'defend' | 'neutral',
    run: () => void,
    endsRaid: boolean,
  ) {
    if (!requireConfirm) {
      run();
      setActionsThisRaid((c) => c + 1);
      if (endsRaid) {
        clearSelections();
        setRaidRunning(false);
        setRaidLeft(0);
        flipAttackingTeam();
      } else {
        setTouchedDefenderIds([]);
      }
      return;
    }
    // Append to the queue. Each entry's run() closes over the current
    // raider / defender / clock state, so it stays correct even if the
    // operator changes the picker before committing. The queue panel
    // (rendered below the pickers) makes the running queue + commit
    // buttons visible without blocking the action grid.
    setPendingActions((q) => [...q, { label, sub, tone, run, endsRaid }]);
  }
  function getPointsPending() {
    if (pendingActions.length === 0) return;
    const queue = pendingActions;
    setPendingActions([]);
    for (const p of queue) p.run();
    setActionsThisRaid((c) => c + queue.length);
    // Raid continues — clear defenders only so the next action starts
    // with a fresh defender selection. Keep the raider + raid timer.
    // No team flip — same raid, same attackers.
    setTouchedDefenderIds([]);
  }
  function completeRaidPending() {
    const queue = pendingActions;
    setPendingActions([]);
    for (const p of queue) p.run();
    if (queue.length > 0) setActionsThisRaid((c) => c + queue.length);
    // Raid ends — clear picker, reset raid timer, hand next raid to
    // the opposing team.
    clearSelections();
    setRaidRunning(false);
    setRaidLeft(0);
    flipAttackingTeam();
  }
  function removePending(index: number) {
    setPendingActions((q) => q.filter((_, i) => i !== index));
  }
  function cancelPending() {
    // Cancel just discards the queue — no commit, no team flip.
    setPendingActions([]);
  }
  // Referee-restart: rewind the 30s raid clock, clear defender selection
  // and any staged actions, but keep the raider + attacking team. Used
  // when the ref blows the whistle a few seconds in and the raid
  // restarts. Disallowed once an action has been committed this raid
  // (those are real DB events; the operator should Complete Raid + pick
  // a new raid instead of trying to "restart").
  function resetRaidTimer() {
    if (actionsThisRaid > 0) return;
    setRaidLeft(RAID_SECONDS);
    setRaidRunning(true);
    setTouchedDefenderIds([]);
    setPendingActions([]);
  }
  // Operator-driven Complete Raid with no staged action. Used by both
  // the standalone button and the 30s auto-finish. Fires empty_raid only
  // if the current raid logged no committed actions yet.
  function completeRaidNow() {
    // Only flip the attacking team if a raid actually happened — i.e.
    // a raider was picked. Hitting Complete Raid before any selection
    // (rare, but possible) shouldn't rotate the toggle.
    const raidWasActive = !!raiderIdRef.current;
    if (raiderIdRef.current && actionsThisRaidRef.current === 0) {
      record('empty_raid', 0, 0, { includeRaider: true });
    }
    clearSelections();
    setRaidRunning(false);
    setRaidLeft(0);
    if (raidWasActive) flipAttackingTeam();
  }

  const isLive = status === 'live';
  const remaining = Math.max(0, halfSeconds - clock);

  // Match clock — counts up internally while running.
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Auto-stop at end of half (clock reaches halfSeconds).
  React.useEffect(() => {
    if (clock >= halfSeconds && running) {
      setRunning(false);
      setRaidRunning(false);
      beepTimeUp();
    }
  }, [clock, running]);

  // Raid timer — counts DOWN from 30s. Audio cues at 15 / 10 / 5 / 0.
  // Coupled to the global clock: it only ticks when BOTH the raid is running
  // AND the global match clock is running. Pausing the global automatically
  // pauses the raid; resuming the global resumes a still-active raid.
  // Also requires a raider to be picked — without a raider on the mat there's
  // no raid to time, so the interval no-ops even if raidRunning is somehow
  // still true.
  React.useEffect(() => {
    if (!raidRunning || !running || !raiderId) return;
    const t = setInterval(() => {
      setRaidLeft((prev) => {
        const next = prev - 1;
        if (next === 15) beepWarn();
        else if (next === 10) beepCaution();
        else if (next === 5) beepUrgent();
        else if (next <= 0) {
          beepTimeUp();
          setRaidRunning(false);
          // Timer hits 0 — beep + stop, but DO NOT auto-fire Complete
          // Raid. The scorer often needs an extra second or two to
          // record an action that happened right at the buzzer; an
          // auto-finish here would commit an empty_raid before they
          // can click. The picker stays open and the standalone
          // Complete Raid button is still available — the operator
          // commits manually whenever they're ready. The "Raid time
          // expired" banner below makes the prompt obvious.
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [raidRunning, running, raiderId]);

  // (No manual raid Start / Pause / Resume / Reset handlers — the
  // raid clock is fully automatic now: it arms on raider pick,
  // pauses with the global clock, and resets when the raid ends or
  // the raider is cleared.)

  // Reset raider + touched defenders when the attacking team flips.
  // Skip the first mount so a page refresh — which always fires this
  // effect once with the just-set initial attackingId — doesn't wipe
  // the server-restored raider out from under us.
  const skipFirstAttackingFlip = React.useRef(true);
  React.useEffect(() => {
    if (skipFirstAttackingFlip.current) {
      skipFirstAttackingFlip.current = false;
      return;
    }
    setRaiderId(null);
    setTouchedDefenderIds([]);
  }, [attackingId]);

  // Whenever the raider is cleared (manual Clear button, attacking-team
  // flip, end-of-raid cleanup, etc.), the raid timer must reset too —
  // otherwise it keeps ticking with no raider on the mat. The auto-start
  // effect below re-arms the timer the next time a raider is picked.
  React.useEffect(() => {
    if (raiderId === null) {
      setRaidRunning(false);
      setRaidLeft(0);
    }
  }, [raiderId]);

  // Persist the current raider to the matches row whenever it changes, so a
  // browser refresh resumes with the same in-progress raid.
  const lastPersistedRaider = React.useRef<string | null>(initial.currentRaiderId);
  React.useEffect(() => {
    if (raiderId === lastPersistedRaider.current) return;
    lastPersistedRaider.current = raiderId;
    void persistTimerStateAction({
      matchId,
      clockSeconds: clock,
      currentHalf: half,
      currentRaiderId: raiderId,
      currentAttackingTeamId: raiderId ? attackingId : null,
      // When picking a raider, snapshot the soon-to-be-armed 30s so a
      // refresh in the gap before the next 5s flush still shows a
      // sensible raid timer. When clearing the raider, persist 0.
      raidSecondsLeft: raiderId ? RAID_SECONDS : 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiderId]);

  // Periodic clock persistence — every 5 seconds while running, save the live
  // clock to the matches row. Worst-case loss on a hard refresh is ~5 seconds,
  // not "back to the last event". Uses a ref so the interval doesn't recreate
  // every tick.
  const clockRef = React.useRef(clock);
  const halfRef = React.useRef(half);
  const raidLeftRef = React.useRef(raidLeft);
  React.useEffect(() => {
    clockRef.current = clock;
    halfRef.current = half;
    raidLeftRef.current = raidLeft;
  }, [clock, half, raidLeft]);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      void persistTimerStateAction({
        matchId,
        clockSeconds: clockRef.current,
        currentHalf: halfRef.current,
        currentRaiderId: raiderId,
        currentAttackingTeamId: raiderId ? attackingId : null,
        raidSecondsLeft: raidLeftRef.current,
      });
    }, 5000);
    return () => clearInterval(id);
    // attackingId / raiderId already captured via closure refresh on re-render
  }, [running, matchId, raiderId, attackingId]);

  // Auto-start BOTH timers when a raider is picked. The raid timer only fires
  // fresh if there isn't already an active raid (don't restart mid-raid if the
  // operator changes their mind about who's raiding). The global match clock
  // is resumed whenever it's paused — picking a raider implies the match is on.
  // Skips the first mount so a refresh that restored a persisted
  // raidSecondsLeft of 0 (e.g. raid time expired but the operator
  // hasn't committed yet) doesn't get reset to 30s — the operator
  // sees the expired-banner instead.
  const skipFirstAutoStart = React.useRef(true);
  React.useEffect(() => {
    if (skipFirstAutoStart.current) {
      skipFirstAutoStart.current = false;
      return;
    }
    if (!raiderId || !isLive) return;
    primeAudio();
    if (!running) setRunning(true);
    if (!raidRunning && raidLeft === 0) {
      setRaidLeft(RAID_SECONDS);
      setRaidRunning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiderId]);

  function toggleDefender(id: string) {
    setTouchedDefenderIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function exitSwapMode() {
    setSwapMode(false);
    setSwapFirstId(null);
  }

  /**
   * Manually add minutes to the match clock. The clock counts UP to
   * halfSeconds, so "adding" minutes means rolling the elapsed value
   * BACK by that many seconds (extending the time remaining).
   *
   * Locked to status='live' AND running=false — can only adjust while
   * the match is paused. Otherwise the clock would tick over our write
   * within the next second. Persists immediately so a refresh / public
   * live page reflects the adjustment without waiting for the 5s flush.
   */
  function adjustMatchClock(addSeconds: number) {
    if (status !== 'live') {
      toast.error('Match must be live to adjust the clock');
      return;
    }
    if (running) {
      toast.error('Pause the clock first, then add time');
      return;
    }
    if (addSeconds <= 0) return;
    const next = Math.max(0, Math.min(halfSeconds, clock - addSeconds));
    setClock(next);
    void persistTimerStateAction({
      matchId,
      clockSeconds: next,
      currentHalf: half,
      currentRaiderId: raiderId,
      currentAttackingTeamId: raiderId ? attackingId : null,
      raidSecondsLeft: raidLeft,
    });
    const minutes = Math.round((addSeconds / 60) * 10) / 10;
    toast.success(
      `+${minutes} ${minutes === 1 ? 'minute' : 'minutes'} added to the match clock`,
    );
  }

  // Swap flow: tap any two players on the SAME team and their states +
  // revival-queue position exchange. Works for OUT ↔ ON-MAT (fix wrong
  // defender tag), ON-MAT ↔ BENCH (informal rotation), OUT ↔ BENCH, or
  // OUT ↔ OUT (reorder revival queue). Cross-team picks are rejected.
  function handleSwapTap(playerId: string) {
    if (swapFirstId === null) {
      setSwapFirstId(playerId);
      return;
    }
    if (swapFirstId === playerId) {
      // Tapped the same player twice — treat as cancel of the first pick.
      setSwapFirstId(null);
      return;
    }
    const allSlots = [...homeSlots, ...awaySlots];
    const firstPlayer = allSlots.find((s) => s.playerId === swapFirstId);
    const secondPlayer = allSlots.find((s) => s.playerId === playerId);
    const fmt = (slot: PlayerSlot | undefined) =>
      slot
        ? slot.jerseyNumber != null
          ? `${slot.fullName} #${slot.jerseyNumber}`
          : slot.fullName
        : 'player';
    const firstLabel = fmt(firstPlayer);
    const secondLabel = fmt(secondPlayer);

    // Same-team guard (also enforced server-side, but a clean toast is nicer
    // than a generic server error).
    const firstTeamId = homeSlots.some((s) => s.playerId === swapFirstId) ? home.id : away.id;
    const secondTeamId = homeSlots.some((s) => s.playerId === playerId) ? home.id : away.id;
    if (firstTeamId !== secondTeamId) {
      toast.error('Both players must be on the same team');
      setSwapFirstId(null);
      return;
    }

    const firstId = swapFirstId;
    exitSwapMode();
    const toastId = toast.loading(`Swapping ${firstLabel} ↔ ${secondLabel}…`);
    startTransition(async () => {
      const res = await swapPlayerStatesAction({
        matchId,
        tournamentId,
        outPlayerId: firstId,
        livePlayerId: playerId,
      });
      if (res?.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(`Swapped: ${firstLabel} ↔ ${secondLabel}`, { id: toastId });
        router.refresh();
      }
    });
  }

  function clearSelections() {
    setRaiderId(null);
    setTouchedDefenderIds([]);
  }

  // ============================================================
  // Secondary-action handlers (cards, sub, tech, forced out, review,
  // manual score adjust). Each wraps the server action and refreshes.
  // ============================================================
  function withSubmit(fn: () => Promise<{ error?: string } | void>) {
    startTransition(() => {
      void (async () => {
        const res = await fn();
        if (res && 'error' in res && res.error) {
          toast.error(res.error);
          return;
        }
        router.refresh();
      })();
    });
  }

  function handleCard(color: 'green' | 'yellow' | 'red', teamId: string, playerId: string) {
    withSubmit(async () => {
      const res = await recordCardAction({
        matchId,
        attackingTeamId: teamId,
        playerId,
        color,
        half,
        clockSeconds: clock,
      });
      if (!res?.error) {
        toast.success(
          `${color[0]?.toUpperCase()}${color.slice(1)} card recorded`,
        );
        setOpenModal(null);
      }
      return res;
    });
  }

  function handleSubstitution(teamId: string, playerInId: string, playerOutId: string) {
    withSubmit(async () => {
      const res = await recordSubstitutionAction({
        matchId,
        teamId,
        playerInId,
        playerOutId,
        half,
        clockSeconds: clock,
      });
      if (!res?.error) {
        toast.success('Substitution recorded');
        setOpenModal(null);
      }
      return res;
    });
  }

  function handleTechPoint(teamId: string) {
    if (!confirm(`Award 1 technical point to ${teamId === home.id ? home.name : away.name}?`)) return;
    withSubmit(() =>
      recordTechPointAction({
        matchId,
        receivingTeamId: teamId,
        half,
        clockSeconds: clock,
      }),
    );
  }

  function handleForcedOut() {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }
    if (!raiderId) {
      toast.error('Pick the raider who went out first.');
      return;
    }
    withSubmit(async () => {
      const res = await recordRaiderOutOfBoundsAction({
        matchId,
        attackingTeamId: attackingId,
        raiderId,
        half,
        clockSeconds: clock,
        reason: 'raider_out_of_bounds',
      });
      if (!res?.error) {
        if (res?.promotedToSuperTackle) {
          toast.success(
            '⚡ Super Tackle — defenders ≤3, raider forced out promoted to +2',
          );
        } else {
          toast.success('Raider out — defence +1');
        }
      }
      return res;
    });
  }

  // Raider voluntarily exits the field (no defender pressure).
  // Same scoring as forced-out; tagged differently for stats.
  function handleRaiderSelfOut() {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }
    if (!raiderId) {
      toast.error('Pick the raider who self-exited first.');
      return;
    }
    withSubmit(async () => {
      const res = await recordRaiderOutOfBoundsAction({
        matchId,
        attackingTeamId: attackingId,
        raiderId,
        half,
        clockSeconds: clock,
        reason: 'raider_self_out',
      });
      if (!res?.error) {
        toast.success('Self out — defence +1');
      }
      return res;
    });
  }

  function handleDefenderOut() {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }
    if (touchedDefenderIds.length === 0) {
      toast.error('Tap the defender(s) who stepped out first.');
      return;
    }
    withSubmit(async () => {
      const res = await recordDefenderOutOfBoundsAction({
        matchId,
        attackingTeamId: attackingId,
        raiderId,
        defenderIds: touchedDefenderIds,
        half,
        clockSeconds: clock,
        reason: 'defender_out_of_bounds',
      });
      if (!res?.error) {
        toast.success(`Defender out of bounds — attack +${touchedDefenderIds.length}`);
      }
      return res;
    });
  }

  // Defender voluntarily steps off the mat (tactical / unforced).
  // Same scoring as defender-out; tagged differently for stats.
  function handleDefenderSelfOut() {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }
    if (touchedDefenderIds.length === 0) {
      toast.error('Tap the defender(s) who self-exited first.');
      return;
    }
    withSubmit(async () => {
      const res = await recordDefenderOutOfBoundsAction({
        matchId,
        attackingTeamId: attackingId,
        raiderId,
        defenderIds: touchedDefenderIds,
        half,
        clockSeconds: clock,
        reason: 'defender_self_out',
      });
      if (!res?.error) {
        toast.success(`Defender self-out — attack +${touchedDefenderIds.length}`);
      }
      return res;
    });
  }

  function handleReview(outcome: 'upheld' | 'overturned', teamId: string, eventIds?: string[]) {
    withSubmit(async () => {
      const res = await callReviewAction({
        matchId,
        teamId,
        outcome,
        half,
        clockSeconds: clock,
        eventIds,
      });
      if (!res?.error) {
        const n = eventIds?.length ?? 0;
        toast.success(
          outcome === 'upheld'
            ? `Review upheld — ${n} event${n === 1 ? '' : 's'} reverted`
            : 'Review overturned — call stands',
        );
        setOpenModal(null);
      }
      return res;
    });
  }

  function handleManualEvent(input: {
    teamId: string;
    type: EventType;
    pointsAttacker: number;
    pointsDefender: number;
    raiderId: string | null;
    defenderIds: string[];
  }) {
    withSubmit(async () => {
      const res = await recordManualEventAction({
        matchId,
        attackingTeamId: input.teamId,
        type: input.type,
        pointsAttacker: input.pointsAttacker,
        pointsDefender: input.pointsDefender,
        raiderId: input.raiderId,
        defenderIds: input.defenderIds,
        half,
        clockSeconds: clock,
      });
      if (!res?.error) {
        toast.success(`Override recorded — ${EVENT_LABEL[input.type] ?? input.type}`);
        setOpenModal(null);
      }
      return res;
    });
  }

  function handleScoreAdjust(teamId: string, delta: 1 | -1) {
    const teamName = teamId === home.id ? home.name : away.name;
    if (!confirm(`Adjust ${teamName}'s score by ${delta > 0 ? '+1' : '-1'}? (referee correction)`)) return;
    withSubmit(() =>
      adjustScoreAction({
        matchId,
        teamId,
        delta,
        half,
        clockSeconds: clock,
      }),
    );
  }

  // Yellow-card auto-expiry: every second, look for any 'suspended' player
  // whose suspension end has passed (within the same half). Fire a
  // card_expired event so the trigger flips them back to on_mat.
  const expiredFiredRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      for (const slot of [...homeSlots, ...awaySlots]) {
        if (slot.state !== 'suspended') continue;
        if (slot.suspendedUntilHalf !== half) continue;
        if (slot.suspendedUntilSeconds == null) continue;
        if (clockRef.current < slot.suspendedUntilSeconds) continue;
        if (expiredFiredRef.current.has(slot.playerId)) continue;
        expiredFiredRef.current.add(slot.playerId);
        const teamId = homeSlots.some((s) => s.playerId === slot.playerId) ? home.id : away.id;
        void expireCardAction({
          matchId,
          teamId,
          playerId: slot.playerId,
          half,
          clockSeconds: clockRef.current,
        }).then(() => router.refresh());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, homeSlots, awaySlots, half, matchId, home.id, away.id, router]);

  // Slots split by attacking / defending side based on the toggle.
  // Show the active 7: on-mat players (selectable) + out/suspended/red-carded
  // (visible but greyed out so the operator sees who has died).
  // In swap mode the bench is also shown so the scorer can rotate any of
  // the full 12-player roster on/off without burning a substitution event.
  const isActive = (state: string) =>
    state === 'on_mat' || state === 'out' || state === 'suspended' || state === 'red_carded';
  const slotFilter = (s: PlayerSlot) => (swapMode ? true : isActive(s.state));
  const attackingSlots = (attackingId === home.id ? homeSlots : awaySlots).filter(slotFilter);
  const defendingSlots = (attackingId === home.id ? awaySlots : homeSlots).filter(slotFilter);
  const touchedCount = touchedDefenderIds.length;
  // Count defenders currently on mat — used to gate Super Tackle (PKL: only
  // counts when defending side has ≤3 on mat) and to validate other actions.
  const defendersOnMatCount = defendingSlots.filter((s) => s.state === 'on_mat').length;
  const superTackleEligible = defendersOnMatCount > 0 && defendersOnMatCount <= KABADDI.SUPER_TACKLE_DEFENDER_THRESHOLD;
  // Bonus is only valid when the defending side has ≥6 on mat (IKF rule).
  // Mirrors the server-side guard in recordMatchEventAction.
  const bonusEligible = defendersOnMatCount >= KABADDI.BONUS_MIN_DEFENDERS;
  // Super Raid requires ≥3 touches (3+ defenders selected) — anything less
  // can't reach 3 points without a bonus, which the T+B button covers.
  const superRaidEligible = touchedCount >= 3;
  const attacking = attackingId === home.id ? home : away;
  const defending = attackingId === home.id ? away : home;
  // Do-or-die raid is "live" when the attacking team has 2 empty raids
  // already. The next raid by that team must score; if it doesn't, the
  // raider is OUT. We use this to flip the Empty button into a DoD raid.
  const dodCounter =
    attackingId === home.id ? initial.homeDodCounter : initial.awayDodCounter;
  const isDodActive = dodCounter >= 2;

  // The raider currently in progress (raider picked + raid timer running).
  // Drives the "Raid in progress" banner here AND on the public live page.
  const currentRaider = React.useMemo(() => {
    if (!raiderId) return null;
    const slot = attackingSlots.find((s) => s.playerId === raiderId);
    if (!slot) return null;
    return {
      fullName: slot.fullName,
      jerseyNumber: slot.jerseyNumber,
      teamName: attacking.name,
    };
  }, [raiderId, attackingSlots, attacking.name]);

  // Realtime broadcast channel — pushes timer state to the public live page
  // so its global + raid timer mirror what the operator sees.
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`match-timer:${matchId}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [matchId]);

  // Broadcast timer snapshot on every change. The match clock interval already
  // bumps `clock` every second when running, which fires this effect — so the
  // live page receives a 1Hz heartbeat for free. `currentRaider` is included
  // so the live page can display "Raid in progress — Pawan" banners.
  React.useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: 'broadcast',
      event: 'timer',
      payload: {
        running,
        clockSeconds: clock,
        raidRunning,
        raidLeft,
        status,
        currentHalf: half,
        currentRaider,
      },
    });
  }, [running, clock, raidRunning, raidLeft, status, half, currentRaider]);

  function record(
    type: EventType,
    pointsAttacker: number,
    pointsDefender: number,
    options: {
      includeRaider?: boolean;
      includeDefenders?: boolean;
    } = {},
  ) {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }

    const useRaider = options.includeRaider ?? true;
    const useDefenders = options.includeDefenders ?? false;

    startTransition(async () => {
      const res = await recordMatchEventAction({
        matchId,
        type,
        attackingTeamId: attackingId,
        pointsAttacker,
        pointsDefender,
        half,
        clockSeconds: clock,
        raiderId: useRaider ? raiderId : null,
        defenderIds: useDefenders ? touchedDefenderIds : [],
      });
      if (res?.error) toast.error(res.error);
      else {
        // No selection / timer cleanup here — the staging flow
        // (getPointsPending / completeRaidPending / immediate-mode
        // stageOrRun) decides whether the raid continues or ends and
        // performs the right cleanup based on the action's endsRaid
        // flag.
        if (res && 'promotedToSuperTackle' in res && res.promotedToSuperTackle) {
          toast.success('⚡ Super Tackle — defenders ≤3, promoted to +2');
        }
        // Re-fetch server data (events, player_state, score) WITHOUT a full
        // page reload — preserves the client clock + running state so the
        // global timer keeps ticking right where it was.
        router.refresh();
      }
    });
  }

  function undo(eventId: string) {
    if (!confirm('Remove this event? The score will adjust automatically.')) return;
    startTransition(async () => {
      const res = await deleteMatchEventAction(eventId);
      if (res?.error) toast.error(res.error);
      else router.refresh();
    });
  }

  async function startMatch() {
    // First start always begins at 0:00 and PAUSED. The global match clock
    // doesn't tick until the first raider is picked (auto-started by the
    // raiderId effect above), or the operator presses play manually. This
    // prevents wasted seconds while the operator picks the opening raider.
    setClock(0);
    setRaidLeft(0);
    setRaidRunning(false);
    setStatus('live');
    setRunning(false);
    const res = await setMatchStatusAction(tournamentId, matchId, 'live', {
      current_half: half,
      clock_seconds: 0,
    });
    if (res?.error) toast.error(res.error);
  }

  async function pauseMatch() {
    setRunning(false);
    await setMatchStatusAction(tournamentId, matchId, 'half_time', {
      current_half: half,
      clock_seconds: clock,
    });
    setStatus('half_time');
  }

  async function nextHalf() {
    // Same pause-until-first-raider behavior as startMatch: the next half
    // begins live but paused at 0:00. The clock starts ticking when the
    // operator picks the opening raider of the half (auto-start effect)
    // or hits play manually.
    const next = half + 1;
    setHalf(next);
    setClock(0);
    setStatus('live');
    setRunning(false);
    await setMatchStatusAction(tournamentId, matchId, 'live', {
      current_half: next,
      clock_seconds: 0,
    });
  }

  async function endMatch() {
    if (!confirm('End the match? This sets the final result and exits live mode.')) return;
    setRunning(false);
    setRaidRunning(false);
    setStatus('completed');
    await setMatchStatusAction(tournamentId, matchId, 'completed', {
      current_half: half,
      clock_seconds: clock,
    });
    router.refresh();
  }

  const raidRingClass = cn(
    'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xl font-bold tabular-nums transition-colors',
    !raidRunning && raidLeft === 0 && 'border-border text-muted-foreground',
    raidRunning && raidLeft > 15 && 'border-emerald-500/60 text-emerald-500',
    raidRunning && raidLeft <= 15 && raidLeft > 10 && 'border-amber-500/60 text-amber-500',
    raidRunning && raidLeft <= 10 && raidLeft > 5 && 'border-orange-500/60 text-orange-500',
    raidRunning && raidLeft <= 5 && 'animate-pulse border-destructive text-destructive',
  );

  return (
    <div className="flex min-h-[640px] w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
      {/* HEADER BAR — score, clocks, match controls in a single tight row */}
      <Card className="shrink-0 overflow-hidden" data-tour="score-header">
        <CardContent className="grid grid-cols-1 items-center gap-4 p-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-2">
            <CompactTeamScore
              team={home}
              score={initial.homeScore}
              highlight={attackingId === home.id}
              align="left"
            />
            <ScoreAdjustControl
              onPlus={() => handleScoreAdjust(home.id, 1)}
              onMinus={() => handleScoreAdjust(home.id, -1)}
              disabled={pending}
            />
          </div>

          {/* Centre — flattened into a single horizontal row so the
              clock / raid timer / match controls all line up on the
              same baseline as the team scores on either side. */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {/* Match clock + status */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Q{half}
              </span>
              <span
                className={cn(
                  'font-mono text-3xl font-bold leading-none tabular-nums',
                  remaining <= 60 && remaining > 0 && 'text-amber-500',
                  remaining === 0 && 'text-destructive',
                )}
              >
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(remaining % 60).toString().padStart(2, '0')}
              </span>
              <StatusPill status={status} />
              {/* Add-time control. Only renders when the match is paused —
                  otherwise the next 1s tick would overwrite our adjustment.
                  Lets the operator extend the half (timeouts, injuries,
                  ref discussions) by 1 / 2 / 5 minutes via quick buttons,
                  or any whole number of minutes via the input. */}
              {status === 'live' && !running && (
                <AddTimeControl onAdd={adjustMatchClock} />
              )}
            </div>

            {/* Raid timer */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Timer className="mr-0.5 inline h-3 w-3" />
                Raid
              </span>
              <div
                className={cn(raidRingClass, 'h-9 w-9 text-base')}
                aria-label={`Raid timer: ${raidLeft}s`}
              >
                {raidLeft.toString().padStart(2, '0')}
              </div>
              {/* Reset button — for when the referee stops a raider
                  shortly after the raid begins and orders a restart.
                  Resets the 30s clock, clears defender selection +
                  pending action queue, and leaves the raider on the
                  picker. Disabled once any action has been committed
                  this raid — at that point Complete Raid + new pick is
                  the right path. Hidden entirely without a raider.  */}
              {raiderId && (
                <button
                  type="button"
                  onClick={resetRaidTimer}
                  disabled={actionsThisRaid > 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Reset raid timer"
                  title={
                    actionsThisRaid > 0
                      ? 'Cannot reset — actions already committed this raid. Use Complete Raid then pick a new raid.'
                      : 'Reset raid clock to 30s (referee restart)'
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Match controls */}
            <div className="flex items-center gap-1" data-tour="match-controls">
              {status === 'scheduled' && (
                <Button onClick={startMatch} variant="flame" size="sm">
                  <Play className="h-3 w-3" />
                  Start match
                </Button>
              )}
              {status === 'live' && (
                <>
                  <Button
                    onClick={() => setRunning((r) => !r)}
                    variant={running ? 'destructive' : 'flame'}
                    size="sm"
                    title="Pauses or resumes both clocks"
                  >
                    {running ? (
                      <>
                        <Pause className="h-3 w-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Resume
                      </>
                    )}
                  </Button>
                  <Button onClick={pauseMatch} variant="outline" size="sm">
                    Half time
                  </Button>
                  <Button onClick={endMatch} variant="destructive" size="sm">
                    End
                  </Button>
                </>
              )}
              {status === 'half_time' && (
                <Button onClick={nextHalf} variant="flame" size="sm">
                  <Play className="h-3 w-3" />
                  Start Q{half + 1}
                </Button>
              )}
              {status === 'completed' && <Badge variant="success">FINAL</Badge>}
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <ScoreAdjustControl
              onPlus={() => handleScoreAdjust(away.id, 1)}
              onMinus={() => handleScoreAdjust(away.id, -1)}
              disabled={pending}
            />
            <CompactTeamScore
              team={away}
              score={initial.awayScore}
              highlight={attackingId === away.id}
              align="right"
            />
          </div>
        </CardContent>
      </Card>

      {/* MAIN AREA — top row: pickers (left) + actions (right).
          Event log moves to a full-width row below so it doesn't
          fight the action grid for vertical space. */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        {/* LEFT (lg+) — toggle, banners, pickers. Action buttons split
            out into the right-hand Actions card below. */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            {/* Currently raiding toggle */}
            <div className="grid shrink-0 grid-cols-2 gap-2" data-tour="team-toggle">
              <RaidingTeamButton
                team={home}
                active={attackingId === home.id}
                slots={homeSlots}
                onClick={() => setAttackingId(home.id)}
                disabled={!!raiderId && attackingId !== home.id}
                disabledReason="Complete the current raid before switching teams"
              />
              <RaidingTeamButton
                team={away}
                active={attackingId === away.id}
                slots={awaySlots}
                onClick={() => setAttackingId(away.id)}
                disabled={!!raiderId && attackingId !== away.id}
                disabledReason="Complete the current raid before switching teams"
              />
            </div>

            {/* Do-or-die banner — appears when the attacking team has 2 empty raids */}
            {(() => {
              const dod =
                attackingId === home.id ? initial.homeDodCounter : initial.awayDodCounter;
              if (dod < 2) return null;
              return (
                <div className="flex shrink-0 items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">Do-or-die raid</span>
                  <span className="text-muted-foreground">
                    {attacking.name} must score (touch or bonus) — empty raid = raider out + defence +1
                  </span>
                </div>
              );
            })()}

            {/* Super Tackle Zone banner — auto-shows whenever the defending
                team has dropped to <=3 on mat. Any tackle / forced raider-out
                in this state auto-promotes to +2 (server-side promotion in
                recordMatchEventAction / B+T / Raider-out actions). */}
            {isLive && superTackleEligible && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Zap className="h-4 w-4 shrink-0 animate-pulse" />
                <span className="font-bold uppercase tracking-wider">Super Tackle Zone</span>
                <span className="text-muted-foreground">
                  {defending.name} have {defendersOnMatCount} on mat — any tackle or forced raider-out scores +2 instead of +1.
                </span>
              </div>
            )}

            {/* Raid time expired prompt — shown when the 30s raid timer
                has ticked to 0 with a raider still on the picker (i.e.
                the operator hasn't completed the raid yet). The timer
                no longer auto-fires Complete Raid so this stays
                visible until the operator commits manually. */}
            {raiderId && !raidRunning && raidLeft === 0 && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border-2 border-rose-500 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
                <span className="font-bold uppercase tracking-wider">
                  Raid time expired
                </span>
                <span className="text-muted-foreground">
                  Record what happened — Get Points (raid continues) or
                  Complete Raid to end. No auto-fire; you have unlimited
                  time to enter the events.
                </span>
              </div>
            )}

            {/* Raid-in-progress banner — visible the moment a raider is picked */}
            {currentRaider && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-semibold uppercase tracking-wider">Raid in progress —</span>
                <span className="font-medium">
                  {currentRaider.fullName}
                  {currentRaider.jerseyNumber != null && ` #${currentRaider.jerseyNumber}`}
                </span>
                <span className="text-muted-foreground">raiding for {currentRaider.teamName}</span>
              </div>
            )}

            {/* Pickers — grow to fill, internal scroll if rosters are long */}
            <div className="flex min-h-0 flex-1 flex-col" data-tour="player-picker">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {swapMode
                    ? swapFirstId
                      ? 'Swap · pick the second player on the same team to exchange states'
                      : 'Swap · pick any player (raider or defender side, any state)'
                    : raiderId
                      ? `Raid in progress · ${actionsThisRaid} action${actionsThisRaid === 1 ? '' : 's'} so far`
                      : 'Pick players for this raid'}
                </div>
                <div className="flex items-center gap-2">
                  {/* Always-available Complete Raid — ends the current raid
                      cleanly. If no actions were committed, fires
                      empty_raid; otherwise just clears the picker + raid
                      timer so the next raid can start. */}
                  {raiderId && pendingActions.length === 0 && !swapMode && (
                    <Button
                      size="sm"
                      variant="flame"
                      onClick={completeRaidNow}
                      disabled={pending}
                      title={
                        actionsThisRaid > 0
                          ? 'End the raid — picker and raid timer reset'
                          : 'End the raid as empty (raider returned without scoring)'
                      }
                    >
                      Complete Raid
                    </Button>
                  )}
                  {/* Swap toggle: exchange states between any two players on
                      the same team. Works across raider AND defender columns
                      and includes bench / out / on-mat picks. Hidden while a
                      raid action queue is pending so the operator finishes
                      the in-flight raid first. */}
                  {pendingActions.length === 0 && (
                    <button
                      type="button"
                      onClick={() => (swapMode ? exitSwapMode() : setSwapMode(true))}
                      disabled={pending}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                        swapMode
                          ? 'border-amber-500 bg-amber-500/15 text-amber-600'
                          : 'border-border text-muted-foreground hover:border-amber-500 hover:text-amber-600',
                      )}
                      title="Swap two players' states on the same team — on-mat, bench, and out are all valid picks"
                    >
                      {swapMode ? 'Cancel swap' : 'Swap'}
                    </button>
                  )}
                  {(raiderId || touchedCount > 0) && !swapMode && (
                    <button
                      type="button"
                      onClick={clearSelections}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="relative grid min-h-0 flex-1 gap-3 md:grid-cols-2">
                {/* Mid-mat divider — kabaddi mat hint between the two
                    halves. Only renders on md+ where the columns are
                    side-by-side. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-500/40 to-transparent md:block"
                />
                <PickerColumn
                  label="Raider"
                  teamName={attacking.name}
                  tone="attack"
                  helperText={
                    swapMode
                      ? swapFirstId
                        ? 'Pick second'
                        : 'Pick any'
                      : raiderId
                        ? '1 selected'
                        : 'Tap one'
                  }
                >
                  {attackingSlots.length === 0 ? (
                    <PickerEmpty />
                  ) : (
                    attackingSlots.map((s) => {
                      // In swap mode, any state is selectable on either side.
                      // After the first tap, only same-team picks are
                      // actionable (cross-team picks toast an error in the
                      // handler — leaving them clickable keeps the UI
                      // readable instead of disabling half the board).
                      return (
                        <PlayerChip
                          key={s.playerId}
                          slot={s}
                          selected={
                            swapMode
                              ? swapFirstId === s.playerId
                              : raiderId === s.playerId
                          }
                          tone="attack"
                          disabled={swapMode ? false : s.state !== 'on_mat'}
                          onClick={() =>
                            swapMode ? handleSwapTap(s.playerId) : setRaiderId(s.playerId)
                          }
                        />
                      );
                    })
                  )}
                </PickerColumn>
                <PickerColumn
                  label="Defenders"
                  teamName={defending.name}
                  tone="defend"
                  helperText={
                    swapMode
                      ? swapFirstId
                        ? 'Pick second'
                        : 'Pick any'
                      : touchedCount > 0
                        ? `${touchedCount} selected`
                        : 'Tap any'
                  }
                >
                  {defendingSlots.length === 0 ? (
                    <PickerEmpty />
                  ) : (
                    defendingSlots.map((s) => {
                      // In swap mode, any state on either column is selectable;
                      // the cross-team check happens in handleSwapTap.
                      return (
                        <PlayerChip
                          key={s.playerId}
                          slot={s}
                          selected={
                            swapMode
                              ? swapFirstId === s.playerId
                              : touchedDefenderIds.includes(s.playerId)
                          }
                          tone="defend"
                          disabled={swapMode ? false : s.state !== 'on_mat'}
                          onClick={() =>
                            swapMode ? handleSwapTap(s.playerId) : toggleDefender(s.playerId)
                          }
                        />
                      );
                    })
                  )}
                </PickerColumn>
              </div>
            </div>

            {/* Queued actions panel — sits directly below the Raider /
                Defenders pickers so the queue + commit buttons are right
                where the operator's eye is, without stealing space from
                the action button grid in the right card. */}
            {pendingActions.length > 0 && (
              <div className="flex shrink-0 flex-col gap-2 rounded-md border-2 border-amber-500 bg-amber-500/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-sm font-bold text-foreground">
                    {pendingActions.length} action
                    {pendingActions.length === 1 ? '' : 's'} queued
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — Get Points keeps the raid going · Complete Raid ends it
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="flame"
                      onClick={getPointsPending}
                      disabled={pending}
                      title="Commit the queue — raid continues, raider stays picked"
                    >
                      Get Points
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={completeRaidPending}
                      disabled={pending}
                      title="Commit the queue — raid ends, picker resets, other team raids next"
                    >
                      Complete Raid
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelPending}
                      className="text-destructive hover:text-destructive"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingActions.map((p, i) => (
                    <span
                      key={i}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
                        p.tone === 'attack'
                          ? 'bg-primary/15 text-primary'
                          : p.tone === 'defend'
                            ? 'bg-sky-500/15 text-sky-500'
                            : 'bg-foreground/10 text-foreground',
                      )}
                    >
                      <span className="font-mono text-[10px] opacity-60">{i + 1}.</span>
                      <span>{p.label}</span>
                      <span className="font-mono opacity-80">{p.sub}</span>
                      <button
                        type="button"
                        onClick={() => removePending(i)}
                        className="-mr-1 ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm hover:bg-foreground/10 hover:text-destructive"
                        aria-label={`Remove ${p.label} from queue`}
                        title="Remove from queue"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT (lg+) — Actions card. Primary + secondary action
            grids + help link. Split out from the picker card so the
            operator's eye can settle on actions without scrolling past
            the picker on tall screens. */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">

            {/* Action buttons row — single horizontal grid.
                "All out" is omitted: the DB trigger auto-fires it when a
                team's on-mat reaches 0, awarding +2 to the other side.
                Touch and T+B don't require defender selection — when none is
                picked, the trigger auto-strikes the lowest-jersey defender.
                Empty during a do-or-die raid is auto-routed to the
                do_or_die_raid event type so the raider goes OUT properly.
                3 cols on phone (full-width card), 6 cols on tablet (still
                full-width, more breathing room), 3 cols on desktop where
                this card is in the 320px right column. */}
            <div
              className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-border/50 pt-3 md:grid-cols-6 lg:grid-cols-3"
              data-tour="action-grid"
            >
              <ActionBtn
                icon={<Target />}
                label="Touch"
                sub={`+${Math.max(touchedCount, 1)}`}
                onClick={() => {
                  const points = touchedCount;
                  stageOrRun(
                    'Touch',
                    `+${points}`,
                    'attack',
                    () =>
                      record('raid_point', points, 0, {
                        includeRaider: true,
                        includeDefenders: true,
                      }),
                    false, // raider can keep raiding after a touch
                  );
                }}
                disabled={!isLive || pending || !raiderId || touchedCount === 0}
                tone="attack"
                title={
                  !raiderId
                    ? 'Pick the raider first'
                    : touchedCount === 0
                      ? 'Tap the defender(s) the raider touched'
                      : `Touch — raider can continue raiding after this; pick more defenders or click Complete Raid.`
                }
                staged={pendingActions.some((p) => p.label === 'Touch')}
              />
              <ActionBtn
                icon={<Sparkles />}
                label="Bonus"
                sub="+1"
                onClick={() =>
                  stageOrRun(
                    'Bonus',
                    '+1',
                    'attack',
                    () => record('bonus_point', 1, 0, { includeRaider: true }),
                    false, // raider can keep raiding after a bonus
                  )
                }
                disabled={!isLive || pending || !raiderId || !bonusEligible}
                tone="attack"
                title={
                  !raiderId
                    ? 'Pick the raider first — Bonus is awarded when the raider crosses the bonus line and returns'
                    : !bonusEligible
                      ? `Bonus requires ≥${KABADDI.BONUS_MIN_DEFENDERS} defenders on mat (currently ${defendersOnMatCount})`
                      : 'Bonus — attack +1, raider can continue raiding. Use Complete Raid when the raid ends.'
                }
                staged={pendingActions.some((p) => p.label === 'Bonus')}
              />
              <ActionBtn
                icon={<Sparkles />}
                label="Super"
                sub={`+${Math.max(touchedCount, 3)}`}
                onClick={() => {
                  const points = touchedCount;
                  stageOrRun(
                    'Super',
                    `+${points}`,
                    'attack',
                    () =>
                      record('super_raid', points, 0, {
                        includeRaider: true,
                        includeDefenders: true,
                      }),
                    true, // super raid = raider returned with 3+ touches, raid ends
                  );
                }}
                disabled={!isLive || pending || !raiderId || !superRaidEligible}
                tone="attack"
                title={
                  !raiderId
                    ? 'Pick the raider first'
                    : !superRaidEligible
                      ? 'Super Raid needs ≥3 defenders touched (or use T+B for 2 touches + bonus)'
                      : `Super Raid — ${touchedCount} defenders touched in one raid. Attack +${touchedCount}.`
                }
                staged={pendingActions.some((p) => p.label === 'Super')}
              />
              <ActionBtn
                label={isDodActive ? 'Empty (DoD)' : 'Empty'}
                sub={isDodActive ? 'def +1' : '0'}
                onClick={() =>
                  stageOrRun(
                    isDodActive ? 'Empty (DoD)' : 'Empty',
                    isDodActive ? 'def +1' : '0',
                    isDodActive ? 'defend' : 'neutral',
                    () =>
                      // During an active do-or-die raid, an unsuccessful raid
                      // means raider OUT and defence +1. Fire do_or_die_raid
                      // with points_attacker=0 — the SQL trigger handles the
                      // out + revival + counter reset.
                      record(
                        isDodActive ? 'do_or_die_raid' : 'empty_raid',
                        0,
                        isDodActive ? 1 : 0,
                        { includeRaider: true },
                      ),
                    true, // empty raid ends the raid
                  )
                }
                disabled={!isLive || pending || !raiderId}
                tone={isDodActive ? 'defend' : 'neutral'}
                title={
                  !raiderId
                    ? 'Pick the raider first'
                    : isDodActive
                      ? 'Do-or-die failed — raider returned without scoring. Raider OUT, defence +1, counter resets.'
                      : 'Empty raid — raider returned without scoring. Increments do-or-die counter.'
                }
                staged={pendingActions.some(
                  (p) => p.label === 'Empty' || p.label === 'Empty (DoD)',
                )}
              />
              <ActionBtn
                icon={<Shield />}
                label="Tackle"
                sub="+1"
                onClick={() =>
                  stageOrRun(
                    'Tackle',
                    '+1',
                    'defend',
                    () =>
                      record('tackle_point', 0, 1, {
                        includeRaider: true,
                        includeDefenders: true,
                      }),
                    true, // tackle puts raider OUT, raid ends
                  )
                }
                disabled={!isLive || pending || !raiderId || touchedCount === 0}
                tone="defend"
                title={
                  !raiderId
                    ? 'Pick the raider first'
                    : touchedCount === 0
                      ? 'Tap the defender(s) who tackled the raider'
                      : 'Tackle — defenders tackled the raider. Defence +1, raider OUT.'
                }
                staged={pendingActions.some((p) => p.label === 'Tackle')}
              />
              <ActionBtn
                icon={<Shield />}
                label="S.tackle"
                sub="+2"
                onClick={() =>
                  stageOrRun(
                    'S.tackle',
                    '+2',
                    'defend',
                    () =>
                      record('super_tackle', 0, 2, {
                        includeRaider: true,
                        includeDefenders: true,
                      }),
                    true, // super tackle puts raider OUT, raid ends
                  )
                }
                disabled={
                  !isLive ||
                  pending ||
                  !raiderId ||
                  touchedCount === 0 ||
                  !superTackleEligible
                }
                tone="defend"
                title={
                  !raiderId
                    ? 'Pick the raider first'
                    : touchedCount === 0
                      ? 'Tap the defender(s) who made the super tackle'
                      : !superTackleEligible
                        ? `Super Tackle only counts when ≤${KABADDI.SUPER_TACKLE_DEFENDER_THRESHOLD} defenders are on mat (currently ${defendersOnMatCount})`
                        : 'Super Tackle — tackle made with ≤3 defenders on mat. Defence +2, raider OUT.'
                }
                staged={pendingActions.some((p) => p.label === 'S.tackle')}
              />
            </div>

            {/* SECONDARY ACTIONS — outs (forced + self), referee, cards, sub, review.
                3 cols on phone, 5 cols on tablet (2 rows of 5), 3 cols on
                desktop's narrow right column. */}
            <div className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-border/50 pt-3 md:grid-cols-5 lg:grid-cols-3">
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Raider out"
                onClick={() =>
                  stageOrRun(
                    'Raider out',
                    'def +1',
                    'defend',
                    handleForcedOut,
                    true, // forced out — raider OUT, raid ends
                  )
                }
                disabled={!isLive || pending || !raiderId}
                tone="defend"
                title={
                  !raiderId
                    ? 'Pick the raider first — forced out (pushed out by defenders), defence +1, raider OUT'
                    : 'Raider out — forced out by defender pressure, defence +1, raider OUT'
                }
                staged={pendingActions.some((p) => p.label === 'Raider out')}
              />
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Self out"
                onClick={() =>
                  stageOrRun(
                    'Self out',
                    'def +1',
                    'defend',
                    handleRaiderSelfOut,
                    true, // self out — raider OUT, raid ends
                  )
                }
                disabled={!isLive || pending || !raiderId}
                tone="defend"
                title={
                  !raiderId
                    ? 'Pick the raider first — self out (voluntary, no pressure), defence +1, raider OUT'
                    : 'Self out — raider voluntarily exited, defence +1, raider OUT'
                }
                staged={pendingActions.some((p) => p.label === 'Self out')}
              />
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Defender out"
                onClick={() =>
                  stageOrRun(
                    'Defender out',
                    `att +${touchedDefenderIds.length}`,
                    'attack',
                    handleDefenderOut,
                    false, // defender goes out, raider can keep raiding
                  )
                }
                disabled={
                  !isLive ||
                  pending ||
                  !raiderId ||
                  touchedDefenderIds.length === 0
                }
                tone="attack"
                title={
                  !raiderId
                    ? 'Pick the raider first — defender forced out happens under raider pressure'
                    : touchedDefenderIds.length === 0
                      ? 'Tap the defender(s) the raider pushed off the mat — attack +1 each'
                      : `Defender(s) forced out — attack +${touchedDefenderIds.length}`
                }
                staged={pendingActions.some((p) => p.label === 'Defender out')}
              />
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Def. self"
                onClick={() =>
                  stageOrRun(
                    'Def. self',
                    `att +${touchedDefenderIds.length}`,
                    'attack',
                    handleDefenderSelfOut,
                    false, // defender self-exit, raider can keep raiding
                  )
                }
                disabled={!isLive || pending || touchedDefenderIds.length === 0}
                tone="attack"
                title={
                  touchedDefenderIds.length === 0
                    ? 'Pick the defender(s) — self out (voluntary / tactical), attack +1 each'
                    : `Defender(s) self-out — attack +${touchedDefenderIds.length}`
                }
                staged={pendingActions.some((p) => p.label === 'Def. self')}
              />
              <SmallActionBtn
                icon={<ArrowRightLeft className="h-3 w-3" />}
                label="Sub"
                onClick={() => setOpenModal({ kind: 'sub', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title="Substitute a player"
              />
              <SmallActionBtn
                icon={<SquareIcon className="h-3 w-3" style={{ fill: '#22c55e', color: '#22c55e' }} />}
                label="Green"
                onClick={() => setOpenModal({ kind: 'card', color: 'green', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title="Green card — formal warning"
              />
              <SmallActionBtn
                icon={<SquareIcon className="h-3 w-3" style={{ fill: '#eab308', color: '#eab308' }} />}
                label="Yellow"
                onClick={() => setOpenModal({ kind: 'card', color: 'yellow', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title="Yellow card — 2 min suspension"
              />
              <SmallActionBtn
                icon={<SquareIcon className="h-3 w-3" style={{ fill: '#ef4444', color: '#ef4444' }} />}
                label="Red"
                onClick={() => setOpenModal({ kind: 'card', color: 'red', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title="Red card — match suspension"
              />
              <SmallActionBtn
                icon={<Gavel className="h-3 w-3" />}
                label="Tech +1"
                onClick={() => handleTechPoint(attackingId)}
                disabled={pending}
                tone="neutral"
                title="Award 1 technical point to currently-attacking team"
              />
              <SmallActionBtn
                icon={<Eye className="h-3 w-3" />}
                label="Review"
                onClick={() => setOpenModal({ kind: 'review', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title={`Reviews used: ${attackingId === home.id ? initial.homeReviewsUsed : initial.awayReviewsUsed}`}
              />
              <SmallActionBtn
                icon={<Wrench className="h-3 w-3" />}
                label="Override"
                onClick={() => setOpenModal({ kind: 'manual', teamId: attackingId })}
                disabled={pending}
                tone="neutral"
                title="Override — record any event for any player (bench / out / suspended included), with custom point deltas. Use this to fix a missed call or attribute to a different player."
              />
            </div>

            {/* Action reference — opens a help modal documenting every button */}
            <div className="flex shrink-0 items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={toggleRequireConfirm}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                title="When on, scoring buttons stage an action — a separate Confirm click records it."
              >
                <span
                  className={cn(
                    'inline-flex h-3.5 w-6 items-center rounded-full border px-0.5 transition-colors',
                    requireConfirm
                      ? 'border-primary/60 bg-primary/30 justify-end'
                      : 'border-border bg-muted justify-start',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/80" />
                </span>
                Confirm before scoring · {requireConfirm ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => setOpenModal({ kind: 'help' })}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <HelpCircle className="h-3 w-3" />
                Action reference
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM ROW — Event log spans full width below the
          pickers + actions grid. Caps height with max-h so the log
          doesn't push the action grid off-screen on tall viewports. */}
      <Card
        className="flex shrink-0 flex-col overflow-hidden lg:max-h-[260px]"
        data-tour="event-log"
      >
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider">Event log</h3>
              <span className="text-[10px] text-muted-foreground">
                last {recentEvents.length}
              </span>
            </div>
            {recentEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No events yet. Tap a button on the left.
              </p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
                {recentEvents.map((e) => {
                  const homeAttacking = e.attacking_team_id === home.id;
                  const team = homeAttacking ? home : away;
                  return (
                    <li
                      key={e.id}
                      className="group flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/30"
                    >
                      <span className="w-12 shrink-0 font-mono text-muted-foreground">
                        Q{e.half}{' '}
                        {Math.floor(e.clock_seconds / 60)
                          .toString()
                          .padStart(2, '0')}
                        :{(e.clock_seconds % 60).toString().padStart(2, '0')}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {team.short_name || initials(team.name)}
                      </Badge>
                      <span
                        className="flex-1 truncate"
                        title={describeEvent(e, team.short_name || team.name)}
                      >
                        {describeEvent(e, team.short_name || team.name)}
                      </span>
                      <span className="font-mono">
                        {e.points_attacker > 0 && (
                          <span className="text-emerald-500">+{e.points_attacker}</span>
                        )}
                        {e.points_defender > 0 && (
                          <span className="text-sky-500">+{e.points_defender}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => undo(e.id)}
                        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Undo event"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

      {/* MODALS — cards, substitution, review */}
      {openModal?.kind === 'card' && (
        <Modal onClose={() => setOpenModal(null)} title={`${openModal.color[0]?.toUpperCase()}${openModal.color.slice(1)} card — pick player`}>
          <CardPlayerPicker
            slots={openModal.teamId === home.id ? homeSlots : awaySlots}
            color={openModal.color}
            onPick={(playerId) => handleCard(openModal.color, openModal.teamId, playerId)}
          />
        </Modal>
      )}

      {openModal?.kind === 'sub' && (
        <Modal onClose={() => setOpenModal(null)} title="Substitution">
          <SubPicker
            slots={openModal.teamId === home.id ? homeSlots : awaySlots}
            onConfirm={(playerInId, playerOutId) =>
              handleSubstitution(openModal.teamId, playerInId, playerOutId)
            }
          />
        </Modal>
      )}

      {openModal?.kind === 'review' && (
        <Modal onClose={() => setOpenModal(null)} title="Review the last call">
          <ReviewControls
            teamName={openModal.teamId === home.id ? home.name : away.name}
            reviewsUsed={openModal.teamId === home.id ? initial.homeReviewsUsed : initial.awayReviewsUsed}
            recentEvents={recentEvents}
            home={home}
            away={away}
            onUpheld={(eventIds) => handleReview('upheld', openModal.teamId, eventIds)}
            onOverturned={() => handleReview('overturned', openModal.teamId)}
          />
        </Modal>
      )}

      {openModal?.kind === 'manual' && (
        <Modal onClose={() => setOpenModal(null)} title="Override event">
          <ManualEventControls
            initialTeamId={openModal.teamId}
            home={home}
            away={away}
            homeSlots={homeSlots}
            awaySlots={awaySlots}
            onCancel={() => setOpenModal(null)}
            onConfirm={handleManualEvent}
          />
        </Modal>
      )}

      {openModal?.kind === 'help' && (
        <Modal
          onClose={() => setOpenModal(null)}
          title="Scoring action reference"
          widthClass="max-w-3xl"
        >
          <ActionReference />
        </Modal>
      )}

    </div>
  );
}

// ============================================================
// ActionReference — comprehensive help content for every scoring
// button. Grouped by row (Raid actions / Incidents & admin) so an
// operator can quickly find the right rule mid-match.
// ============================================================
interface ActionDoc {
  label: string;
  scoring: string;
  description: string;
  /** Special note (precondition, gating rule, etc.) — italicised. */
  note?: string;
  /** Required selection: 'raider' / 'defender(s)' / 'none'. */
  selection?: string;
  tone: 'attack' | 'defend' | 'neutral';
}

const PRIMARY_ACTION_DOCS: ActionDoc[] = [
  {
    label: 'Touch',
    scoring: 'Attack +N',
    description:
      'Raider touched N defender(s) and returned safely. Each touched defender goes OUT; revivals = number touched.',
    selection: 'Raider + 1+ defenders touched',
    tone: 'attack',
  },
  {
    label: 'Bonus',
    scoring: 'Attack +1',
    description:
      'Raider crossed the bonus line and returned safely. No defender out.',
    note: 'Requires ≥6 defenders on mat (rule blocks the call otherwise).',
    selection: 'Raider',
    tone: 'attack',
  },
  {
    label: 'Super',
    scoring: 'Attack +N (≥3)',
    description:
      'Super Raid: 3+ defenders touched in a single raid. Touched defenders OUT, raid flagged as super-raid in stats.',
    note: 'Disabled until ≥3 defenders are picked. Use T+B for 2 touches + bonus instead.',
    selection: 'Raider + ≥3 defenders touched',
    tone: 'attack',
  },
  {
    label: 'Empty / Empty (DoD)',
    scoring: '0  /  Defence +1 (DoD)',
    description:
      'Empty raid — raider returned without touch or bonus. Increments do-or-die counter. After 2 consecutive empty raids, the third raid is automatically a Do-or-Die — clicking Empty then becomes "Empty (DoD)" and marks the raider OUT (defence +1).',
    note: 'The button label and tone switch automatically when the DoD banner is showing.',
    selection: 'Raider',
    tone: 'neutral',
  },
  {
    label: 'Tackle',
    scoring: 'Defence +1',
    description:
      'Defenders successfully tackled the raider. Raider OUT, defence revives 1.',
    note: 'Auto-promotes to Super Tackle (+2) when ≤3 defenders are on mat at raid time.',
    selection: 'Raider + 1+ defenders (the tackler(s))',
    tone: 'defend',
  },
  {
    label: 'S.tackle',
    scoring: 'Defence +2',
    description:
      'Super Tackle — successful tackle when the defending team is short-handed. Raider OUT, defence revives 1.',
    note: 'Only counts when ≤3 defenders are on mat. Disabled otherwise.',
    selection: 'Raider + 1+ defenders (the tackler(s))',
    tone: 'defend',
  },
];

const SECONDARY_ACTION_DOCS: ActionDoc[] = [
  {
    label: 'Raider out',
    scoring: 'Defence +1',
    description:
      'Raider was forced out — pushed across the lobby/boundary line under defender pressure. Raider OUT, defence revives 1.',
    selection: 'Raider',
    tone: 'defend',
  },
  {
    label: 'Self out',
    scoring: 'Defence +1',
    description:
      'Raider voluntarily exited the field without defender pressure (e.g., gave up the raid). Same scoring as Raider out; tagged separately for stats.',
    selection: 'Raider',
    tone: 'defend',
  },
  {
    label: 'Defender out',
    scoring: 'Attack +N',
    description:
      'One or more defenders were forced out under raider pressure (stepped out while attempting tackle). Each picked defender goes OUT; attack scores +1 per defender.',
    selection: '1+ defenders',
    tone: 'attack',
  },
  {
    label: 'Def. self',
    scoring: 'Attack +N',
    description:
      'Defender(s) voluntarily stepped off the mat (tactical / unforced). Same scoring as Defender out; tagged separately for stats.',
    selection: '1+ defenders',
    tone: 'attack',
  },
  {
    label: 'Sub',
    scoring: '—',
    description:
      'Substitute a benched player onto the mat in place of an on-mat player. Modal asks for player-in / player-out.',
    selection: 'Picked inside the modal',
    tone: 'neutral',
  },
  {
    label: 'Green',
    scoring: '—',
    description:
      'Green card — formal warning to the picked player. No score change, no out. Recorded in the event log.',
    selection: 'Picked inside the modal',
    tone: 'neutral',
  },
  {
    label: 'Yellow',
    scoring: '—',
    description:
      'Yellow card — picked player suspended for 2 minutes (auto-returns when the half-clock crosses the suspension end). They are off-mat during suspension.',
    selection: 'Picked inside the modal',
    tone: 'neutral',
  },
  {
    label: 'Red',
    scoring: '—',
    description:
      'Red card — picked player removed for the rest of the match. They cannot return; their roster slot stays vacant.',
    selection: 'Picked inside the modal',
    tone: 'neutral',
  },
  {
    label: 'Tech +1',
    scoring: 'Attack +1',
    description:
      'Technical point awarded by the referee to the currently-attacking team (e.g., opposing-team infraction not tied to a specific play).',
    selection: 'None',
    tone: 'neutral',
  },
  {
    label: 'Review',
    scoring: 'Conditional',
    description:
      'Trigger a review on the most recent event. If upheld, the last event is removed and player_state recomputes; if overturned, the call stands. Each team has a limited number of reviews per match.',
    selection: 'Picked inside the modal',
    tone: 'neutral',
  },
];

function ActionReference() {
  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2 text-xs">
      <p className="text-[11px] text-muted-foreground">
        Quick reference for every button in the action area. Scoring shown is the standard
        outcome — server-side rules may auto-promote (e.g., tackle → super tackle when
        defenders are scarce) or block calls (e.g., bonus needs ≥6 defenders).
      </p>

      <ActionRefSection title="Raid actions (top row)" docs={PRIMARY_ACTION_DOCS} />
      <ActionRefSection title="Incidents & admin (bottom row)" docs={SECONDARY_ACTION_DOCS} />
    </div>
  );
}

function ActionRefSection({ title, docs }: { title: string; docs: ActionDoc[] }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">
        {docs.map((d) => (
          <ActionRefRow key={d.label} doc={d} />
        ))}
      </div>
    </section>
  );
}

function ActionRefRow({ doc }: { doc: ActionDoc }) {
  const toneClass =
    doc.tone === 'attack'
      ? 'border-primary/40 bg-primary/5'
      : doc.tone === 'defend'
        ? 'border-sky-500/40 bg-sky-500/5'
        : 'border-border bg-card';
  const scoringClass =
    doc.tone === 'attack'
      ? 'text-primary'
      : doc.tone === 'defend'
        ? 'text-sky-500'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-md border p-3', toneClass)}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{doc.label}</span>
        <span className={cn('font-mono text-[11px] font-semibold', scoringClass)}>
          {doc.scoring}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/90">{doc.description}</p>
      {doc.selection && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <span className="font-semibold">Required selection:</span> {doc.selection}
        </p>
      )}
      {doc.note && (
        <p className="mt-1 text-[10px] italic text-muted-foreground">⚠ {doc.note}</p>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  widthClass = 'max-w-md',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Tailwind max-width class for the modal card. Defaults to max-w-md. */
  widthClass?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card className={cn('w-full', widthClass)} onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function CardPlayerPicker({
  slots,
  color,
  onPick,
}: {
  slots: PlayerSlot[];
  color: 'green' | 'yellow' | 'red';
  onPick: (playerId: string) => void;
}) {
  // Cards apply to active players (on mat or suspended). Don't allow carding
  // a player who's on bench or already red-carded.
  const eligible = slots.filter(
    (s) => s.state === 'on_mat' || s.state === 'out' || s.state === 'suspended',
  );
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        {color === 'green' && 'Formal warning. No state change.'}
        {color === 'yellow' && '2-minute suspension — auto-revives at end of suspension.'}
        {color === 'red' && 'Match suspension — player out for the rest of the match.'}
      </p>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {eligible.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No eligible players.
          </p>
        ) : (
          eligible.map((s) => (
            <button
              key={s.playerId}
              type="button"
              onClick={() => onPick(s.playerId)}
              className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent/30"
            >
              <span className="font-mono text-xs text-muted-foreground">
                #{s.jerseyNumber ?? '?'}
              </span>
              <span className="flex-1 truncate font-medium">{s.fullName}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.state.replace('_', ' ')}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SubPicker({
  slots,
  onConfirm,
}: {
  slots: PlayerSlot[];
  onConfirm: (playerInId: string, playerOutId: string) => void;
}) {
  const onMat = slots.filter((s) => s.state === 'on_mat');
  const bench = slots.filter((s) => s.state === 'bench');
  const [playerOut, setPlayerOut] = React.useState<string | null>(null);
  const [playerIn, setPlayerIn] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-sky-500">Bench → Mat</div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {bench.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-muted-foreground">No bench players</p>
            ) : (
              bench.map((s) => (
                <button
                  key={s.playerId}
                  type="button"
                  onClick={() => setPlayerIn(s.playerId)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs',
                    playerIn === s.playerId
                      ? 'border-sky-500 bg-sky-500/15 text-sky-500'
                      : 'border-border hover:bg-accent/30',
                  )}
                >
                  <span className="font-mono text-[10px]">#{s.jerseyNumber ?? '?'}</span>
                  <span className="flex-1 truncate">{s.fullName}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-primary">Mat → Bench</div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {onMat.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-muted-foreground">No on-mat players</p>
            ) : (
              onMat.map((s) => (
                <button
                  key={s.playerId}
                  type="button"
                  onClick={() => setPlayerOut(s.playerId)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs',
                    playerOut === s.playerId
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border hover:bg-accent/30',
                  )}
                >
                  <span className="font-mono text-[10px]">#{s.jerseyNumber ?? '?'}</span>
                  <span className="flex-1 truncate">{s.fullName}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      <Button
        variant="flame"
        className="w-full"
        disabled={!playerIn || !playerOut}
        onClick={() => playerIn && playerOut && onConfirm(playerIn, playerOut)}
      >
        Confirm substitution
      </Button>
    </div>
  );
}

// Events that don't carry a score/state change can't be the subject of a
// review revert (cards, subs, time-outs, prior review markers, etc.).
const NON_REVERTABLE_EVENT_TYPES = new Set([
  'green_card',
  'yellow_card',
  'red_card',
  'card_expired',
  'review_upheld',
  'review_overturned',
  'substitution',
  'time_out',
  'lineup_set',
  'match_end',
]);

function ReviewControls({
  teamName,
  reviewsUsed,
  recentEvents,
  home,
  away,
  onUpheld,
  onOverturned,
}: {
  teamName: string;
  reviewsUsed: number;
  recentEvents: RecentEvent[];
  home: TeamLite;
  away: TeamLite;
  onUpheld: (eventIds: string[]) => void;
  onOverturned: () => void;
}) {
  const [stage, setStage] = React.useState<'choice' | 'pick'>('choice');
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const revertable = React.useMemo(
    () => recentEvents.filter((e) => !NON_REVERTABLE_EVENT_TYPES.has(e.type)),
    [recentEvents],
  );

  if (stage === 'choice') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Captain of <span className="font-medium text-foreground">{teamName}</span> has called a review.
          Reviews used so far: <span className="font-mono">{reviewsUsed}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setStage('pick')} variant="flame">
            Upheld — pick events to revert
          </Button>
          <Button onClick={onOverturned} variant="outline">
            Overturned — call stands
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Upheld: pick the event(s) to remove; player state is replayed once. Overturned: nothing
          changes; the review counter still increments.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tick the event(s) to revert. Player state replays once after all selections.
        </p>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
          onClick={() => {
            setPicked(new Set());
            setStage('choice');
          }}
        >
          ← Back
        </button>
      </div>
      {revertable.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No revertable events in the log yet.
        </p>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto rounded-md border">
          {revertable.map((e) => {
            const homeAttacking = e.attacking_team_id === home.id;
            const team = homeAttacking ? home : away;
            const checked = picked.has(e.id);
            return (
              <li key={e.id} className="border-b last:border-b-0">
                <label className="flex cursor-pointer items-start gap-2 px-2 py-1.5 text-xs hover:bg-accent/30">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(e.id)}
                    className="mt-0.5"
                  />
                  <span className="w-12 shrink-0 font-mono text-muted-foreground">
                    Q{e.half}{' '}
                    {Math.floor(e.clock_seconds / 60)
                      .toString()
                      .padStart(2, '0')}
                    :{(e.clock_seconds % 60).toString().padStart(2, '0')}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {team.short_name || initials(team.name)}
                  </Badge>
                  <span className="flex-1">
                    {describeEvent(e, team.short_name || team.name)}
                  </span>
                  <span className="shrink-0 font-mono">
                    {e.points_attacker > 0 && (
                      <span className="text-emerald-500">+{e.points_attacker}</span>
                    )}
                    {e.points_defender > 0 && (
                      <span className="text-sky-500">+{e.points_defender}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        onClick={() => onUpheld(Array.from(picked))}
        variant="flame"
        disabled={picked.size === 0}
        className="w-full"
      >
        Revert {picked.size > 0 ? `${picked.size} event${picked.size === 1 ? '' : 's'}` : 'selected'}
      </Button>
    </div>
  );
}

// Per-event-type config for the manual modal: which player pickers to
// show, validation requirements, and how to seed default point deltas
// when the event type changes. Operator can still edit the points after.
type ManualEventCfg = {
  label: string;
  group: 'raid' | 'tackle' | 'special';
  needsRaider: boolean;
  needsDefenders: boolean; // requires ≥1 to record
  /** Computes default attacker/defender point deltas given the picked
   *  defender count. Returns a tuple [pointsAttacker, pointsDefender]. */
  defaultPoints: (defenderCount: number) => [number, number];
};

const MANUAL_EVENT_TYPES: Array<{ type: EventType; cfg: ManualEventCfg }> = [
  {
    type: 'raid_point',
    cfg: {
      label: 'Raid',
      group: 'raid',
      needsRaider: true,
      needsDefenders: true,
      defaultPoints: (n) => [Math.max(n, 1), 0],
    },
  },
  {
    type: 'super_raid',
    cfg: {
      label: 'Super raid',
      group: 'raid',
      needsRaider: true,
      needsDefenders: true,
      defaultPoints: (n) => [Math.max(n, 3), 0],
    },
  },
  {
    type: 'bonus_point',
    cfg: {
      label: 'Bonus',
      group: 'raid',
      needsRaider: true,
      needsDefenders: false,
      defaultPoints: () => [1, 0],
    },
  },
  {
    type: 'do_or_die_raid',
    cfg: {
      label: 'Do-or-die',
      group: 'raid',
      needsRaider: true,
      needsDefenders: false,
      defaultPoints: (n) => (n > 0 ? [n, 0] : [0, 1]),
    },
  },
  {
    type: 'empty_raid',
    cfg: {
      label: 'Empty raid',
      group: 'raid',
      needsRaider: true,
      needsDefenders: false,
      defaultPoints: () => [0, 0],
    },
  },
  {
    type: 'tackle_point',
    cfg: {
      label: 'Tackle',
      group: 'tackle',
      needsRaider: true,
      needsDefenders: true,
      defaultPoints: () => [0, 1],
    },
  },
  {
    type: 'super_tackle',
    cfg: {
      label: 'Super tackle',
      group: 'tackle',
      needsRaider: true,
      needsDefenders: true,
      defaultPoints: () => [0, 2],
    },
  },
  {
    type: 'all_out',
    cfg: {
      label: 'All out',
      group: 'special',
      needsRaider: false,
      needsDefenders: false,
      defaultPoints: () => [2, 0],
    },
  },
  {
    type: 'technical_point',
    cfg: {
      label: 'Technical',
      group: 'special',
      needsRaider: false,
      needsDefenders: false,
      defaultPoints: () => [1, 0],
    },
  },
];

const MANUAL_CFG_BY_TYPE: Record<string, ManualEventCfg> = Object.fromEntries(
  MANUAL_EVENT_TYPES.map(({ type, cfg }) => [type, cfg]),
);

function ManualEventControls({
  initialTeamId,
  home,
  away,
  homeSlots,
  awaySlots,
  onCancel,
  onConfirm,
}: {
  initialTeamId: string;
  home: TeamLite;
  away: TeamLite;
  homeSlots: PlayerSlot[];
  awaySlots: PlayerSlot[];
  onCancel: () => void;
  onConfirm: (input: {
    teamId: string;
    type: EventType;
    pointsAttacker: number;
    pointsDefender: number;
    raiderId: string | null;
    defenderIds: string[];
  }) => void;
}) {
  const [teamId, setTeamId] = React.useState<string>(initialTeamId);
  const [type, setType] = React.useState<EventType>('raid_point');
  const [raiderId, setRaiderId] = React.useState<string | null>(null);
  const [defenderIds, setDefenderIds] = React.useState<string[]>([]);
  const [pointsAtt, setPointsAtt] = React.useState<number>(1);
  const [pointsDef, setPointsDef] = React.useState<number>(0);

  const cfg = MANUAL_CFG_BY_TYPE[type]!;
  const attackingSlots = teamId === home.id ? homeSlots : awaySlots;
  const defendingSlots = teamId === home.id ? awaySlots : homeSlots;
  // Override mode: show every roster slot regardless of state. Sort so
  // on-mat players surface first (most common pick), then bench, then
  // out / suspended / red-carded / injured.
  const stateRank: Record<string, number> = {
    on_mat: 0,
    bench: 1,
    out: 2,
    suspended: 3,
    red_carded: 4,
    injured: 5,
  };
  const sortSlots = (a: PlayerSlot, b: PlayerSlot) => {
    const r = (stateRank[a.state] ?? 99) - (stateRank[b.state] ?? 99);
    if (r !== 0) return r;
    return (a.jerseyNumber ?? 9999) - (b.jerseyNumber ?? 9999);
  };
  const raiderChoices = [...attackingSlots].sort(sortSlots);
  const defenderChoices = [...defendingSlots].sort(sortSlots);

  // Seed default points whenever the event type or defender count changes.
  // Operator can still tweak the inputs after — the next type change re-seeds.
  React.useEffect(() => {
    const [a, d] = cfg.defaultPoints(defenderIds.length);
    setPointsAtt(a);
    setPointsDef(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, defenderIds.length]);

  // If the team flips, clear player selections — they're scoped to a side.
  React.useEffect(() => {
    setRaiderId(null);
    setDefenderIds([]);
  }, [teamId]);

  function toggleDefender(id: string) {
    setDefenderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const validationError = (() => {
    if (cfg.needsRaider && !raiderId) return 'Pick a raider for this event type.';
    if (cfg.needsDefenders && defenderIds.length === 0)
      return 'Pick at least one defender for this event type.';
    return null;
  })();

  function submit() {
    if (validationError) return;
    onConfirm({
      teamId,
      type,
      pointsAttacker: pointsAtt,
      pointsDefender: pointsDef,
      raiderId: cfg.needsRaider ? raiderId : null,
      defenderIds: cfg.needsDefenders || defenderIds.length > 0 ? defenderIds : [],
    });
  }

  return (
    <div className="space-y-4">
      {/* Event type picker — grouped */}
      <div>
        <Label>Event type</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {MANUAL_EVENT_TYPES.map(({ type: t, cfg: c }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition-colors',
                t === type
                  ? 'border-primary bg-primary/15 font-medium text-primary'
                  : 'border-border bg-background hover:bg-accent/30',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team toggle */}
      <div>
        <Label>Attacking team</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {[home, away].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(t.id)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs transition-colors',
                t.id === teamId
                  ? 'border-primary bg-primary/15 font-medium text-primary'
                  : 'border-border bg-background hover:bg-accent/30',
              )}
            >
              {t.short_name || initials(t.name)} · {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Raider — required when needsRaider. Override mode shows ALL roster
          players (on-mat first, then bench / out / etc.) so the scorer can
          attribute an event to any player. */}
      {cfg.needsRaider && (
        <div>
          <Label>
            Raider <span className="text-muted-foreground">(any roster player)</span>
          </Label>
          {raiderChoices.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No roster players for this team.</p>
          ) : (
            <select
              value={raiderId ?? ''}
              onChange={(e) => setRaiderId(e.target.value || null)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— Select raider —</option>
              {raiderChoices.map((s) => (
                <option key={s.playerId} value={s.playerId}>
                  {s.jerseyNumber != null ? `#${s.jerseyNumber} ` : ''}
                  {s.fullName} · {formatPlayerState(s.state)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Defenders — required when needsDefenders, optional otherwise.
          Override mode shows everyone on the opposing roster regardless of state. */}
      {(cfg.needsDefenders || cfg.needsRaider) && (
        <div>
          <Label>
            Defenders{' '}
            <span className="text-muted-foreground">
              {cfg.needsDefenders ? '(at least 1, any roster player)' : '(optional, any roster player)'}
            </span>
          </Label>
          {defenderChoices.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No roster players for the other side.</p>
          ) : (
            <ul className="mt-1 grid max-h-[180px] grid-cols-2 gap-1 overflow-y-auto rounded-md border p-1">
              {defenderChoices.map((s) => {
                const checked = defenderIds.includes(s.playerId);
                return (
                  <li key={s.playerId}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent/30">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDefender(s.playerId)}
                      />
                      <span className="flex-1 truncate">
                        {s.jerseyNumber != null ? `#${s.jerseyNumber} ` : ''}
                        {s.fullName}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatPlayerState(s.state)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Point deltas */}
      <div className="grid grid-cols-2 gap-3">
        <NumberStepper
          label="Attacker points"
          value={pointsAtt}
          onChange={setPointsAtt}
        />
        <NumberStepper
          label="Defender points"
          value={pointsDef}
          onChange={setPointsDef}
        />
      </div>

      {validationError && (
        <p className="text-xs text-amber-500">{validationError}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
        <Button onClick={submit} variant="flame" disabled={!!validationError}>
          Record event
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

function formatPlayerState(state: string): string {
  switch (state) {
    case 'on_mat': return 'on mat';
    case 'bench': return 'bench';
    case 'out': return 'out';
    case 'suspended': return 'suspended';
    case 'red_carded': return 'red-carded';
    case 'injured': return 'injured';
    default: return state;
  }
}

function NumberStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-border">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="px-2 text-muted-foreground hover:bg-accent/30"
          aria-label="Decrease"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="w-full bg-background px-2 py-1 text-center text-sm font-mono"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="px-2 text-muted-foreground hover:bg-accent/30"
          aria-label="Increase"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  sub,
  onClick,
  disabled,
  tone,
  title,
  staged,
}: {
  icon?: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  tone: 'attack' | 'defend' | 'neutral';
  title?: string;
  staged?: boolean;
}) {
  const toneClass =
    tone === 'attack'
      ? 'border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/10'
      : tone === 'defend'
        ? 'border-sky-500/30 bg-sky-500/5 hover:border-sky-500/60 hover:bg-sky-500/10'
        : 'border-border hover:border-border/80 hover:bg-accent/30';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
        toneClass,
        staged && 'animate-pulse border-amber-500 bg-amber-500/15 ring-2 ring-amber-500',
      )}
    >
      {icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

function ScoreAdjustControl({
  onPlus,
  onMinus,
  disabled,
}: {
  onPlus: () => void;
  onMinus: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onPlus}
        disabled={disabled}
        title="Referee correction +1"
        className="flex h-5 w-5 items-center justify-center rounded border border-border text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"
      >
        <Plus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onMinus}
        disabled={disabled}
        title="Referee correction −1"
        className="flex h-5 w-5 items-center justify-center rounded border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}

function SmallActionBtn({
  icon,
  label,
  onClick,
  disabled,
  tone,
  title,
  staged,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: 'attack' | 'defend' | 'neutral';
  title?: string;
  staged?: boolean;
}) {
  const toneClass =
    tone === 'attack'
      ? 'border-primary/30 hover:border-primary/60 hover:bg-primary/10'
      : tone === 'defend'
        ? 'border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/10'
        : 'border-border hover:border-border/80 hover:bg-accent/30';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        toneClass,
        staged && 'animate-pulse border-amber-500 bg-amber-500/15 ring-2 ring-amber-500',
      )}
    >
      {icon}
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function PickerColumn({
  label,
  teamName,
  tone,
  helperText,
  children,
}: {
  label: string;
  teamName: string;
  tone: 'attack' | 'defend';
  helperText: string;
  children: React.ReactNode;
}) {
  const isAttack = tone === 'attack';
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden rounded-xl border-2 p-3 transition-colors',
        isAttack
          ? 'border-primary/40 bg-gradient-to-b from-primary/15 via-primary/5 to-primary/0'
          : 'border-sky-500/40 bg-gradient-to-b from-sky-500/15 via-sky-500/5 to-sky-500/0',
      )}
    >
      {/* Mat-zone hint — diagonal stripes evoke the kabaddi-mat surface */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 opacity-[0.04]',
          isAttack ? 'bg-primary' : 'bg-sky-500',
        )}
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 12px)',
        }}
      />
      <div className="relative mb-3 flex shrink-0 items-end justify-between gap-2">
        <div className="min-w-0">
          <div
            className={cn(
              'font-display text-2xl font-black uppercase leading-none tracking-[0.08em]',
              isAttack ? 'text-primary' : 'text-sky-500',
            )}
          >
            {label}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-foreground/80">
            {teamName}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
            isAttack
              ? 'bg-primary/20 text-primary'
              : 'bg-sky-500/20 text-sky-500',
          )}
        >
          {helperText}
        </span>
      </div>
      {/* 2-col grid; on short viewports the column scrolls internally so chips
          never spill over the action-buttons row below. */}
      <div className="relative grid grid-cols-2 content-start gap-1">
        {children}
      </div>
    </div>
  );
}

function CompactTeamScore({
  team,
  score,
  highlight,
  align,
}: {
  team: TeamLite;
  score: number;
  highlight?: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 transition-opacity',
        align === 'right' && 'flex-row-reverse',
        !highlight && 'opacity-60',
      )}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #0052a3)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
        <div className="truncate text-xs text-muted-foreground">{team.name}</div>
        <div className="font-mono text-3xl font-bold tabular-nums">{score}</div>
      </div>
    </div>
  );
}

function PickerEmpty() {
  return (
    <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-[10px] text-muted-foreground">
      No on-mat lineup. Set lineups before starting the match.
    </div>
  );
}

function PlayerChip({
  slot,
  selected,
  tone,
  disabled,
  onClick,
}: {
  slot: PlayerSlot;
  selected: boolean;
  /** 'attack' = single-select (raider). 'defend' = multi-select (defenders). */
  tone: 'attack' | 'defend';
  disabled?: boolean;
  onClick: () => void;
}) {
  const baseClass = 'flex items-center gap-2 rounded-md border-2 px-2 py-1.5 text-left text-xs transition-all';
  const stateClass = disabled
    ? 'cursor-not-allowed border-border/40 bg-muted/20 opacity-50'
    : selected
      ? tone === 'attack'
        ? 'border-primary bg-primary/20 text-primary font-semibold shadow-md ring-2 ring-primary/40'
        : 'border-sky-500 bg-sky-500/20 text-sky-500 font-semibold shadow-md ring-2 ring-sky-500/40'
      : 'border-border bg-card hover:bg-accent/30';

  // Indicator on the LEFT shows the selection mode at a glance:
  //   raider column → circular radio (single-select)
  //   defender column → square checkbox (multi-select)
  const indicator =
    tone === 'attack' ? (
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-primary bg-primary' : 'border-border bg-card',
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    ) : (
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
          selected ? 'border-sky-500 bg-sky-500' : 'border-border bg-card',
        )}
      >
        {selected && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
            <path
              d="M2 6 L5 9 L10 3"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    );

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(baseClass, stateClass)}>
      {indicator}
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold',
          selected
            ? tone === 'attack'
              ? 'bg-primary text-primary-foreground'
              : 'bg-sky-500 text-white'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {slot.jerseyNumber ?? '?'}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-medium',
          slot.state !== 'on_mat' && 'text-muted-foreground line-through',
        )}
      >
        {slot.fullName}
      </span>
      {slot.state === 'out' && (
        <span className="rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500">
          OUT{slot.outSeq != null ? ` ${slot.outSeq}` : ''}
        </span>
      )}
      {slot.state === 'bench' && (
        <span className="rounded bg-slate-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          BENCH
        </span>
      )}
      {slot.state === 'suspended' && (
        <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
          SUSP
        </span>
      )}
      {slot.state === 'red_carded' && (
        <span className="rounded bg-red-700/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700">
          RED
        </span>
      )}
    </button>
  );
}

/**
 * Inline popover for adding minutes to the paused match clock. Quick
 * buttons (+1m / +2m / +5m) for the common cases plus a freeform input
 * for arbitrary minutes. Closes on outside click or after a successful
 * add. The visibility gate (only when paused) is enforced by the
 * caller — this component itself stays simple.
 */
function AddTimeControl({ onAdd }: { onAdd: (seconds: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState('1');
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function commit(seconds: number) {
    onAdd(seconds);
    setOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(minutes, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    commit(n * 60);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        title="Add time to the match clock (paused only)"
        aria-label="Add time to the match clock"
        aria-expanded={open}
      >
        <Plus className="h-3 w-3" />
        Time
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Add to match clock
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {[1, 2, 5].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => commit(m * 60)}
                className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
              >
                +{m}m
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Minutes to add"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">min</span>
            <button
              type="submit"
              className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add
            </button>
          </form>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Adds time to the half. Use for timeouts, injuries, ref discussions.
          </p>
        </div>
      )}
    </div>
  );
}

function RaidingTeamButton({
  team,
  active,
  slots,
  onClick,
  disabled = false,
  disabledReason,
}: {
  team: TeamLite;
  active: boolean;
  slots: PlayerSlot[];
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  // Active roster on the field = on_mat + out + suspended (red-carded
  // players are removed from the field; bench is the substitute pool).
  const activeSlots = slots.filter(
    (s) => s.state === 'on_mat' || s.state === 'out' || s.state === 'suspended',
  );
  const onMatCount = activeSlots.filter((s) => s.state === 'on_mat').length;
  const totalSlots = activeSlots.length;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled}
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-md border-2 px-3 py-3 text-sm font-semibold transition-all sm:px-4',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-border/80',
        disabled && 'cursor-not-allowed opacity-50 hover:border-border',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Flame className="h-4 w-4 shrink-0" />
        <span className="truncate">{team.name}</span>
      </div>
      {totalSlots > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1" aria-label={`${onMatCount} on mat, ${totalSlots - onMatCount} out`}>
            {activeSlots.map((slot, i) => (
              <span
                key={i}
                className={cn(
                  'h-2.5 w-2.5 rounded-full ring-1 transition-colors',
                  slot.state === 'on_mat'
                    ? 'bg-emerald-500 ring-emerald-500/40'
                    : 'bg-red-500 ring-red-500/40',
                )}
                title={slot.state === 'on_mat' ? 'On mat' : `Out (${slot.state})`}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {onMatCount}/{totalSlots}
          </span>
        </div>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return (
        <Badge variant="live" className="mt-1">
          ● LIVE
        </Badge>
      );
    case 'half_time':
      return <Badge className="mt-1">HALF TIME</Badge>;
    case 'completed':
      return (
        <Badge variant="success" className="mt-1">
          FINAL
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="mt-1">
          NOT STARTED
        </Badge>
      );
  }
}
