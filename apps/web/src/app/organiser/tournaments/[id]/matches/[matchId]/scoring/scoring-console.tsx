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
  adjustScoreAction,
  callReviewAction,
  deleteMatchEventAction,
  expireCardAction,
  persistTimerStateAction,
  recordCardAction,
  recordMatchEventAction,
  recordDefenderOutOfBoundsAction,
  recordRaiderOutOfBoundsAction,
  recordSubstitutionAction,
  recordTechPointAction,
  setMatchStatusAction,
  type EventType,
} from '../actions';

const HALF_SECONDS = KABADDI.MATCH_HALF_SECONDS;
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
  created_at: string;
  raider: PlayerRef | null;
  defenders: PlayerRef[];
}

interface InitialState {
  status: string;
  homeScore: number;
  awayScore: number;
  currentHalf: number;
  clockSeconds: number;
  /** Persisted in-progress raid — restored on refresh. */
  currentRaiderId: string | null;
  currentAttackingTeamId: string | null;
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

function describeEvent(e: RecentEvent): string {
  const raider = e.raider ? formatPlayer(e.raider) : null;
  const defenderText = joinDefenders(e.defenders);
  const fallback = EVENT_LABEL[e.type] ?? e.type;

  switch (e.type) {
    case 'raid_point':
      if (raider && defenderText) return `${raider} → ${defenderText}`;
      if (raider) return `${raider} touch`;
      return fallback;
    case 'super_raid':
      if (raider && defenderText) return `${raider} → ${defenderText} (super)`;
      if (raider) return `${raider} super raid`;
      return fallback;
    case 'bonus_point':
      return raider ? `${raider} bonus` : 'Bonus';
    case 'tackle_point':
      if (raider && defenderText) return `${defenderText} tackled ${raider}`;
      if (raider) return `Tackled ${raider}`;
      return fallback;
    case 'super_tackle':
      if (raider && defenderText) return `${defenderText} super-tackled ${raider}`;
      if (raider) return `Super tackle on ${raider}`;
      return fallback;
    case 'do_or_die_raid':
      return raider ? `${raider} do-or-die` : 'Do-or-die raid';
    case 'empty_raid':
      return raider ? `${raider} empty` : 'Empty raid';
    case 'all_out':
      return 'All out';
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
  const [status, setStatus] = React.useState(initial.status);
  const [half, setHalf] = React.useState(initial.currentHalf);
  // Internally tracks ELAPSED seconds (matches DB schema + public live page).
  // Display computes remaining = HALF_SECONDS - clock for the countdown.
  // Guard: if status is 'scheduled', start at 0 even if DB has stale clock.
  const [clock, setClock] = React.useState(
    initial.status === 'scheduled' ? 0 : initial.clockSeconds,
  );
  const [running, setRunning] = React.useState(false);
  // Raid timer: counts DOWN from RAID_SECONDS to 0.
  const [raidLeft, setRaidLeft] = React.useState(0);
  const [raidRunning, setRaidRunning] = React.useState(false);
  // Restore the in-progress raid from the persisted match row so a refresh
  // keeps the raider/team selection intact.
  const [attackingId, setAttackingId] = React.useState(
    initial.currentAttackingTeamId ?? home.id,
  );
  const [raiderId, setRaiderId] = React.useState<string | null>(
    initial.currentRaiderId,
  );
  const [touchedDefenderIds, setTouchedDefenderIds] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  // Modal state for the secondary actions (cards, sub, review).
  const [openModal, setOpenModal] = React.useState<
    | null
    | { kind: 'card'; color: 'green' | 'yellow' | 'red'; teamId: string }
    | { kind: 'sub'; teamId: string }
    | { kind: 'review'; teamId: string }
  >(null);

  const isLive = status === 'live';
  const remaining = Math.max(0, HALF_SECONDS - clock);

  // Match clock — counts up internally while running.
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Auto-stop at end of half (clock reaches HALF_SECONDS).
  React.useEffect(() => {
    if (clock >= HALF_SECONDS && running) {
      setRunning(false);
      setRaidRunning(false);
      beepTimeUp();
    }
  }, [clock, running]);

  // Raid timer — counts DOWN from 30s. Audio cues at 15 / 10 / 5 / 0.
  // Coupled to the global clock: it only ticks when BOTH the raid is running
  // AND the global match clock is running. Pausing the global automatically
  // pauses the raid; resuming the global resumes a still-active raid.
  React.useEffect(() => {
    if (!raidRunning || !running) return;
    const t = setInterval(() => {
      setRaidLeft((prev) => {
        const next = prev - 1;
        if (next === 15) beepWarn();
        else if (next === 10) beepCaution();
        else if (next === 5) beepUrgent();
        else if (next <= 0) {
          beepTimeUp();
          setRaidRunning(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [raidRunning, running]);

  function startRaid() {
    if (!isLive) {
      toast.error('Start the match first.');
      return;
    }
    primeAudio();
    setRaidLeft(RAID_SECONDS);
    setRaidRunning(true);
  }

  function pauseRaid() {
    setRaidRunning(false);
  }

  function resumeRaid() {
    if (raidLeft <= 0) return;
    primeAudio();
    setRaidRunning(true);
  }

  function resetRaid() {
    setRaidRunning(false);
    setRaidLeft(0);
  }

  // Reset raider + touched defenders when the attacking team flips.
  React.useEffect(() => {
    setRaiderId(null);
    setTouchedDefenderIds([]);
  }, [attackingId]);

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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiderId]);

  // Periodic clock persistence — every 5 seconds while running, save the live
  // clock to the matches row. Worst-case loss on a hard refresh is ~5 seconds,
  // not "back to the last event". Uses a ref so the interval doesn't recreate
  // every tick.
  const clockRef = React.useRef(clock);
  const halfRef = React.useRef(half);
  React.useEffect(() => {
    clockRef.current = clock;
    halfRef.current = half;
  }, [clock, half]);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      void persistTimerStateAction({
        matchId,
        clockSeconds: clockRef.current,
        currentHalf: halfRef.current,
        currentRaiderId: raiderId,
        currentAttackingTeamId: raiderId ? attackingId : null,
      });
    }, 5000);
    return () => clearInterval(id);
    // attackingId / raiderId already captured via closure refresh on re-render
  }, [running, matchId, raiderId, attackingId]);

  // Auto-start BOTH timers when a raider is picked. The raid timer only fires
  // fresh if there isn't already an active raid (don't restart mid-raid if the
  // operator changes their mind about who's raiding). The global match clock
  // is resumed whenever it's paused — picking a raider implies the match is on.
  React.useEffect(() => {
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
    withSubmit(async () => {
      const res = await recordRaiderOutOfBoundsAction({
        matchId,
        attackingTeamId: attackingId,
        raiderId,
        half,
        clockSeconds: clock,
      });
      if (!res?.error) {
        clearSelections();
        setRaidRunning(false);
        setRaidLeft(0);
        toast.success('Raider out of bounds — defence +1');
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
      });
      if (!res?.error) {
        clearSelections();
        setRaidRunning(false);
        setRaidLeft(0);
        toast.success(`Defender out of bounds — attack +${touchedDefenderIds.length}`);
      }
      return res;
    });
  }

  function handleReview(outcome: 'upheld' | 'overturned', teamId: string) {
    withSubmit(async () => {
      const res = await callReviewAction({
        matchId,
        teamId,
        outcome,
        half,
        clockSeconds: clock,
      });
      if (!res?.error) {
        toast.success(outcome === 'upheld' ? 'Review upheld — last event undone' : 'Review overturned — call stands');
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
  const isActive = (state: string) =>
    state === 'on_mat' || state === 'out' || state === 'suspended' || state === 'red_carded';
  const attackingSlots = (attackingId === home.id ? homeSlots : awaySlots).filter((s) =>
    isActive(s.state),
  );
  const defendingSlots = (attackingId === home.id ? awaySlots : homeSlots).filter((s) =>
    isActive(s.state),
  );
  const touchedCount = touchedDefenderIds.length;
  // Count defenders currently on mat — used to gate Super Tackle (PKL: only
  // counts when defending side has ≤3 on mat) and to validate other actions.
  const defendersOnMatCount = defendingSlots.filter((s) => s.state === 'on_mat').length;
  const superTackleEligible = defendersOnMatCount > 0 && defendersOnMatCount <= KABADDI.SUPER_TACKLE_DEFENDER_THRESHOLD;
  // Super Raid requires ≥3 touches (3+ defenders selected) — anything less
  // can't reach 3 points without a bonus, which the T+B button covers.
  const superRaidEligible = touchedCount >= 3;
  const attacking = attackingId === home.id ? home : away;
  const defending = attackingId === home.id ? away : home;

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
        clearSelections();
        // Raid is over — reset the raid timer so the next raider auto-starts fresh.
        setRaidRunning(false);
        setRaidLeft(0);
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
    // First start always begins at 0:00. Without this, clicking "Start match"
    // on a match whose row still had a non-zero clock_seconds (e.g., previously
    // played and reset to 'scheduled' by hand) would resume from that value.
    setClock(0);
    setRaidLeft(0);
    setRaidRunning(false);
    setStatus('live');
    setRunning(true);
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
    const next = half + 1;
    setHalf(next);
    setClock(0);
    setStatus('live');
    setRunning(true);
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
    <div className="flex min-h-[640px] flex-col gap-3 lg:h-[calc(100vh-12rem)]">
      {/* HEADER BAR — score, clocks, match controls in a single tight row */}
      <Card className="shrink-0 overflow-hidden">
        <CardContent className="grid grid-cols-1 items-center gap-4 p-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-2">
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

          {/* Center: countdown + raid timer + match controls */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Q{half} · {Math.floor(HALF_SECONDS / 60)} min half
              </div>
              <div
                className={cn(
                  'font-mono text-3xl font-bold tabular-nums',
                  remaining <= 60 && remaining > 0 && 'text-amber-500',
                  remaining === 0 && 'text-destructive',
                )}
              >
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(remaining % 60).toString().padStart(2, '0')}
              </div>
              <StatusPill status={status} />
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Timer className="inline h-3 w-3" /> raid
              </div>
              <div className={raidRingClass} aria-label={`Raid timer: ${raidLeft}s`}>
                {raidLeft.toString().padStart(2, '0')}
              </div>
              <div className="flex gap-1">
                {raidRunning ? (
                  <button
                    type="button"
                    onClick={pauseRaid}
                    className="rounded border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-accent/30"
                  >
                    Pause
                  </button>
                ) : raidLeft > 0 ? (
                  <button
                    type="button"
                    onClick={resumeRaid}
                    className="rounded border border-primary bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRaid}
                    disabled={!isLive}
                    className="rounded border border-primary bg-primary/10 px-2 py-0.5 text-[10px] text-primary disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetRaid}
                  disabled={!raidRunning && raidLeft === 0}
                  className="rounded border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-accent/30 disabled:opacity-40"
                  aria-label="Reset raid timer"
                >
                  <RotateCcw className="inline h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {status === 'scheduled' && (
                <Button onClick={startMatch} variant="flame">
                  <Play className="h-4 w-4" />
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
                        <Pause className="h-3 w-3" /> Pause match
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Resume match
                      </>
                    )}
                  </Button>
                  <div className="flex gap-1">
                    <Button onClick={pauseMatch} variant="outline" size="sm" className="flex-1">
                      Half time
                    </Button>
                    <Button onClick={endMatch} variant="destructive" size="sm" className="flex-1">
                      End
                    </Button>
                  </div>
                </>
              )}
              {status === 'half_time' && (
                <Button onClick={nextHalf} variant="flame">
                  <Play className="h-4 w-4" />
                  Start Q{half + 1}
                </Button>
              )}
              {status === 'completed' && <Badge variant="success">FINAL</Badge>}
            </div>
          </div>

          <div className="flex items-center gap-2">
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

      {/* MAIN AREA — pickers + actions on the left, event log on the right */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        {/* LEFT — toggle, pickers, action buttons in one card */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            {/* Currently raiding toggle */}
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <RaidingTeamButton
                team={home}
                active={attackingId === home.id}
                slots={homeSlots}
                onClick={() => setAttackingId(home.id)}
              />
              <RaidingTeamButton
                team={away}
                active={attackingId === away.id}
                slots={awaySlots}
                onClick={() => setAttackingId(away.id)}
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
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Pick players for this raid
                </div>
                {(raiderId || touchedCount > 0) && (
                  <button
                    type="button"
                    onClick={clearSelections}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
                <PickerColumn
                  label="Raider"
                  teamName={attacking.name}
                  accent="text-primary"
                  helperText={raiderId ? '1 selected' : 'Tap one'}
                >
                  {attackingSlots.length === 0 ? (
                    <PickerEmpty />
                  ) : (
                    attackingSlots.map((s) => (
                      <PlayerChip
                        key={s.playerId}
                        slot={s}
                        selected={raiderId === s.playerId}
                        tone="attack"
                        disabled={s.state !== 'on_mat'}
                        onClick={() => setRaiderId(s.playerId)}
                      />
                    ))
                  )}
                </PickerColumn>
                <PickerColumn
                  label="Defenders"
                  teamName={defending.name}
                  accent="text-sky-500"
                  helperText={touchedCount > 0 ? `${touchedCount} selected` : 'Tap any'}
                >
                  {defendingSlots.length === 0 ? (
                    <PickerEmpty />
                  ) : (
                    defendingSlots.map((s) => (
                      <PlayerChip
                        key={s.playerId}
                        slot={s}
                        selected={touchedDefenderIds.includes(s.playerId)}
                        tone="defend"
                        disabled={s.state !== 'on_mat'}
                        onClick={() => toggleDefender(s.playerId)}
                      />
                    ))
                  )}
                </PickerColumn>
              </div>
            </div>

            {/* Action buttons row — single horizontal grid */}
            <div className="grid shrink-0 grid-cols-4 gap-1.5 border-t border-border/50 pt-3 sm:grid-cols-8">
              <ActionBtn
                icon={<Target />}
                label="Touch"
                sub={`+${Math.max(touchedCount, 1)}`}
                onClick={() =>
                  record('raid_point', Math.max(touchedCount, 1), 0, {
                    includeRaider: true,
                    includeDefenders: true,
                  })
                }
                disabled={!isLive || pending}
                tone="attack"
              />
              <ActionBtn
                icon={<Sparkles />}
                label="Bonus"
                sub="+1"
                onClick={() => record('bonus_point', 1, 0, { includeRaider: true })}
                disabled={!isLive || pending}
                tone="attack"
              />
              <ActionBtn
                icon={<Flame />}
                label="T+B"
                sub={`+${Math.max(touchedCount, 1) + 1}`}
                onClick={() =>
                  record('raid_point', Math.max(touchedCount, 1) + 1, 0, {
                    includeRaider: true,
                    includeDefenders: true,
                  })
                }
                disabled={!isLive || pending}
                tone="attack"
              />
              <ActionBtn
                icon={<Sparkles />}
                label="Super"
                sub={`+${Math.max(touchedCount, 3)}`}
                onClick={() =>
                  record('super_raid', Math.max(touchedCount, 3), 0, {
                    includeRaider: true,
                    includeDefenders: true,
                  })
                }
                disabled={!isLive || pending || !superRaidEligible}
                tone="attack"
                title={
                  !superRaidEligible
                    ? 'Super Raid needs ≥3 defenders touched (or use T+B for 2 touches + bonus)'
                    : undefined
                }
              />
              <ActionBtn
                label="All out"
                sub="+2"
                onClick={() => record('all_out', 2, 0, { includeRaider: false })}
                disabled={!isLive || pending}
                tone="attack"
              />
              <ActionBtn
                label="Empty"
                sub="0"
                onClick={() => record('empty_raid', 0, 0, { includeRaider: true })}
                disabled={!isLive || pending}
                tone="neutral"
              />
              <ActionBtn
                icon={<Shield />}
                label="Tackle"
                sub="+1"
                onClick={() =>
                  record('tackle_point', 0, 1, {
                    includeRaider: true,
                    includeDefenders: true,
                  })
                }
                disabled={!isLive || pending}
                tone="defend"
              />
              <ActionBtn
                icon={<Shield />}
                label="S.tackle"
                sub="+2"
                onClick={() =>
                  record('super_tackle', 0, 2, {
                    includeRaider: true,
                    includeDefenders: true,
                  })
                }
                disabled={!isLive || pending || !superTackleEligible}
                tone="defend"
                title={
                  !superTackleEligible
                    ? `Super Tackle only counts when ≤${KABADDI.SUPER_TACKLE_DEFENDER_THRESHOLD} defenders are on mat (currently ${defendersOnMatCount})`
                    : undefined
                }
              />
            </div>

            {/* SECONDARY ACTIONS — referee, cards, sub, review, forced out */}
            <div className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-border/50 pt-3 sm:grid-cols-8">
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Raider out"
                onClick={handleForcedOut}
                disabled={!isLive || pending}
                tone="defend"
                title="Raider stepped out of bounds — defence +1, raider OUT"
              />
              <SmallActionBtn
                icon={<LogOut className="h-3 w-3" />}
                label="Defender out"
                onClick={handleDefenderOut}
                disabled={!isLive || pending || touchedDefenderIds.length === 0}
                tone="attack"
                title={
                  touchedDefenderIds.length === 0
                    ? 'Pick the defender who stepped out, then tap'
                    : `Defender(s) stepped out — attack +${touchedDefenderIds.length}`
                }
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
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — event log (scrolls internally) */}
        <Card className="flex flex-col overflow-hidden">
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
                      <span className="flex-1 truncate" title={describeEvent(e)}>
                        {describeEvent(e)}
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
      </div>

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
            onUpheld={() => handleReview('upheld', openModal.teamId)}
            onOverturned={() => handleReview('overturned', openModal.teamId)}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
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
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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

function ReviewControls({
  teamName,
  reviewsUsed,
  onUpheld,
  onOverturned,
}: {
  teamName: string;
  reviewsUsed: number;
  onUpheld: () => void;
  onOverturned: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Captain of <span className="font-medium text-foreground">{teamName}</span> has called a review.
        Reviews used so far: <span className="font-mono">{reviewsUsed}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onUpheld} variant="flame">
          Upheld — undo last event
        </Button>
        <Button onClick={onOverturned} variant="outline">
          Overturned — call stands
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Upheld: the most recent scoring event for <strong>{teamName}</strong> is removed and player
        state is replayed. Overturned: nothing changes; the review counter still increments.
      </p>
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
}: {
  icon?: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  tone: 'attack' | 'defend' | 'neutral';
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
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
        toneClass,
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
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: 'attack' | 'defend' | 'neutral';
  title?: string;
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
  accent,
  helperText,
  children,
}: {
  label: string;
  teamName: string;
  accent: string;
  helperText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className={cn('text-[10px] font-semibold uppercase tracking-wider', accent)}>
            {label}
          </div>
          <div className="truncate text-xs text-muted-foreground">{teamName}</div>
        </div>
        <span className="text-[10px] text-muted-foreground">{helperText}</span>
      </div>
      {/* 2-col grid so 7 chips fit in ~4 rows without an inner scroll. */}
      <div className="grid grid-cols-2 gap-1 content-start">{children}</div>
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
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
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
  const baseClass = 'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-all';
  const stateClass = disabled
    ? 'cursor-not-allowed border-border/40 bg-muted/20 opacity-50'
    : selected
      ? tone === 'attack'
        ? 'border-primary bg-primary/15 text-primary shadow-sm'
        : 'border-sky-500 bg-sky-500/15 text-sky-500 shadow-sm'
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
          OUT
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

function RaidingTeamButton({
  team,
  active,
  slots,
  onClick,
}: {
  team: TeamLite;
  active: boolean;
  slots: PlayerSlot[];
  onClick: () => void;
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
      className={cn(
        'flex flex-col items-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-semibold transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-border/80',
      )}
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4" />
        {team.name}
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
