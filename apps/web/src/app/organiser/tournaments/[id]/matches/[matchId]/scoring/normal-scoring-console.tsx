'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, RotateCcw, Square as SquareIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, initials } from '@/lib/utils';
import {
  adjustScoreAction,
  persistTimerStateAction,
  recordMatchEventAction,
  setMatchStatusAction,
  type EventType,
} from '../actions';
import { undoLastEventAction } from './normal-actions';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface NormalEvent {
  id: string;
  type: string;
  points_attacker: number;
  points_defender: number;
  attacking_team_id: string | null;
  half: number;
  clock_seconds: number;
}

export interface NormalScoringConsoleProps {
  matchId: string;
  tournamentId: string;
  initial: {
    status: string;
    homeScore: number;
    awayScore: number;
    currentHalf: number;
    clockSeconds: number;
    halfSeconds: number;
    home: TeamLite;
    away: TeamLite;
  };
  recentEvents: NormalEvent[];
}

// Each button awards points to the team it sits under. We model every
// Normal point as points_attacker on the chosen team so the score trigger
// credits the right side; the event `type` is just a label for the feed.
// (The v2 out/revival engine ignores v1 events entirely.)
const POINT_BUTTONS: { kind: string; label: string; type: EventType; points: number }[] = [
  { kind: 'raid', label: 'Raid', type: 'raid_point', points: 1 },
  { kind: 'bonus', label: 'Bonus', type: 'bonus_point', points: 1 },
  { kind: 'tackle', label: 'Tackle', type: 'tackle_point', points: 1 },
  { kind: 'allout', label: 'All-out +2', type: 'all_out', points: 2 },
];

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Raid',
  bonus_point: 'Bonus',
  tackle_point: 'Tackle',
  all_out: 'All-out',
  technical_point: 'Adjust',
};

function mmss(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function NormalScoringConsole({
  matchId,
  tournamentId,
  initial,
  recentEvents,
}: NormalScoringConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [status, setStatus] = React.useState(initial.status);
  const [half, setHalf] = React.useState(initial.currentHalf || 1);
  const [clock, setClock] = React.useState(initial.clockSeconds || 0);
  const [running, setRunning] = React.useState(false);

  const isLive = status === 'live' || status === 'half_time';
  const isCompleted = status === 'completed';

  // Tick the clock while running.
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Persist the clock every ~10s so a refresh / the public live page stays
  // within ~10s of the real time.
  React.useEffect(() => {
    if (!running) return;
    if (clock % 10 !== 0) return;
    void persistTimerStateAction({
      matchId,
      clockSeconds: clock,
      currentHalf: half,
      currentRaiderId: null,
      currentAttackingTeamId: null,
    });
  }, [clock, running, half, matchId]);

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
    });
  }

  async function startMatch() {
    const res = await setMatchStatusAction(tournamentId, matchId, 'live', {
      clock_seconds: clock,
      current_half: half,
    });
    if (res?.error) return void toast.error(res.error);
    setStatus('live');
    setRunning(true);
    router.refresh();
  }

  async function endMatch() {
    setRunning(false);
    const res = await setMatchStatusAction(tournamentId, matchId, 'completed', {
      clock_seconds: clock,
      current_half: half,
    });
    if (res?.error) return void toast.error(res.error);
    setStatus('completed');
    router.refresh();
  }

  async function nextHalf() {
    setHalf(2);
    setClock(0);
    setRunning(false);
    await persistTimerStateAction({
      matchId,
      clockSeconds: 0,
      currentHalf: 2,
      currentRaiderId: null,
      currentAttackingTeamId: null,
    });
    router.refresh();
  }

  function toggleClock() {
    setRunning((r) => {
      const next = !r;
      if (!next) {
        void persistTimerStateAction({
          matchId,
          clockSeconds: clock,
          currentHalf: half,
          currentRaiderId: null,
          currentAttackingTeamId: null,
        });
      }
      return next;
    });
  }

  async function award(teamId: string, type: EventType, points: number) {
    const res = await recordMatchEventAction({
      matchId,
      type,
      attackingTeamId: teamId,
      pointsAttacker: points,
      pointsDefender: 0,
      half,
      clockSeconds: clock,
    });
    if (res?.error) return void toast.error(res.error);
    router.refresh();
  }

  async function adjust(teamId: string, delta: 1 | -1) {
    const res = await adjustScoreAction({
      matchId,
      teamId,
      delta,
      half,
      clockSeconds: clock,
    });
    if (res?.error) return void toast.error(res.error);
    router.refresh();
  }

  async function undo() {
    const res = await undoLastEventAction({ matchId });
    if (res?.error) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Match clock + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <div className="font-mono text-2xl font-bold tabular-nums" data-testid="match-clock">
            {mmss(clock)}
          </div>
          <Badge variant="outline">Half {half}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isLive && !isCompleted && (
            <Button variant="flame" onClick={() => run(startMatch)} disabled={pending} data-testid="start-match">
              <Play className="h-4 w-4" />
              Start match
            </Button>
          )}
          {isLive && (
            <>
              <Button variant="outline" size="sm" onClick={toggleClock} data-testid="toggle-clock">
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? 'Pause' : 'Play'}
              </Button>
              {half === 1 && (
                <Button variant="outline" size="sm" onClick={() => run(nextHalf)} disabled={pending}>
                  Next half
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => run(endMatch)} disabled={pending}>
                <SquareIcon className="h-4 w-4" />
                End match
              </Button>
            </>
          )}
          {isCompleted && (
            <Button variant="outline" size="sm" onClick={() => run(startMatch)} disabled={pending}>
              <Play className="h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {!isLive && !isCompleted && (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          Press <strong>Start match</strong> to go live, then tap a point button under each team.
        </p>
      )}

      {/* Two team scoring cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TeamCard
          side="home"
          team={initial.home}
          score={initial.homeScore}
          disabled={!isLive || pending}
          onAward={(type, pts) => run(() => award(initial.home.id, type, pts))}
          onAdjust={(d) => run(() => adjust(initial.home.id, d))}
        />
        <TeamCard
          side="away"
          team={initial.away}
          score={initial.awayScore}
          disabled={!isLive || pending}
          onAward={(type, pts) => run(() => award(initial.away.id, type, pts))}
          onAdjust={(d) => run(() => adjust(initial.away.id, d))}
        />
      </div>

      {/* Undo + feed */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Recent events</h3>
        <Button variant="outline" size="sm" onClick={() => run(undo)} disabled={pending} data-testid="undo">
          <RotateCcw className="h-4 w-4" />
          Undo last
        </Button>
      </div>
      <div className="space-y-1">
        {recentEvents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No events yet.</p>
        ) : (
          recentEvents.map((e) => {
            const homeAttacking = e.attacking_team_id === initial.home.id;
            const team = homeAttacking ? initial.home : initial.away;
            const pts = e.points_attacker || e.points_defender;
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/30"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                  H{e.half} {mmss(e.clock_seconds)}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {team.short_name || initials(team.name)}
                </Badge>
                <span className="flex-1">{EVENT_LABEL[e.type] ?? e.type}</span>
                <span
                  className={cn(
                    'font-mono text-xs',
                    pts < 0 ? 'text-destructive' : 'text-emerald-500',
                  )}
                >
                  {pts > 0 ? `+${pts}` : pts}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TeamCard({
  side,
  team,
  score,
  disabled,
  onAward,
  onAdjust,
}: {
  side: 'home' | 'away';
  team: TeamLite;
  score: number;
  disabled: boolean;
  onAward: (type: EventType, points: number) => void;
  onAdjust: (delta: 1 | -1) => void;
}) {
  const accent = team.primary_color ?? undefined;
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: accent }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: accent ?? 'hsl(var(--primary))' }}
          >
            {team.short_name || initials(team.name)}
          </div>
          <span className="text-sm font-semibold">{team.name}</span>
        </div>
        <div className="font-mono text-4xl font-bold tabular-nums" data-testid={`${side}-score`}>
          {score}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {POINT_BUTTONS.map((b) => (
          <Button
            key={b.kind}
            variant="outline"
            className="h-14 text-base font-semibold"
            disabled={disabled}
            onClick={() => onAward(b.type, b.points)}
            data-testid={`${side}-${b.kind}`}
          >
            {b.label}
          </Button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-muted-foreground">Manual fix</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onAdjust(-1)}
          data-testid={`${side}-minus`}
        >
          −1
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onAdjust(1)}
          data-testid={`${side}-plus`}
        >
          +1
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return <Badge variant="live">● LIVE</Badge>;
    case 'half_time':
      return <Badge variant="default">HALF TIME</Badge>;
    case 'completed':
      return <Badge variant="success">FINAL</Badge>;
    default:
      return <Badge variant="outline">{status.toUpperCase()}</Badge>;
  }
}
