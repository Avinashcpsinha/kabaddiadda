'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Radio, Timer, Wifi, WifiOff } from 'lucide-react';
import { KABADDI } from '@kabaddiadda/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn, initials } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

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

interface PlayerSlot {
  playerId: string;
  state: string;
}

interface LiveEvent {
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
  scheduledAt: string;
  round: string | null;
  home: TeamLite;
  away: TeamLite;
}

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Raid point',
  tackle_point: 'Tackle point',
  bonus_point: 'Bonus point',
  super_raid: 'Super raid',
  super_tackle: 'Super tackle',
  all_out: 'All out',
  do_or_die_raid: 'Do-or-die raid',
  empty_raid: 'Empty raid',
  time_out: 'Time out',
};

function shortName(full: string): string {
  return (full.split(' ')[0] ?? full).slice(0, 14);
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

function plural(n: number, word: string): string {
  return Math.abs(n) === 1 ? word : `${word}s`;
}

/** Verbose commentary line — describes who did what to whom and the points. */
function describeEvent(e: LiveEvent, attackerName: string, defenderName: string): string {
  const raider = e.raider;
  const defenders = e.defenders;
  const fallback = EVENT_LABEL[e.type] ?? e.type;
  const pointsAtt = e.points_attacker;
  const pointsDef = e.points_defender;

  switch (e.type) {
    case 'raid_point': {
      const defNames = defenders.length > 0 ? joinDefenders(defenders) : null;
      if (raider && defNames) {
        return `${formatPlayer(raider)} touched ${defNames} — ${pointsAtt} ${plural(pointsAtt, 'point')} to ${attackerName}`;
      }
      if (raider) {
        return `${formatPlayer(raider)} raids — ${pointsAtt} ${plural(pointsAtt, 'point')} to ${attackerName}`;
      }
      return `${attackerName} scores ${pointsAtt} from raid`;
    }

    case 'super_raid': {
      const defNames = defenders.length > 0 ? joinDefenders(defenders) : null;
      if (raider && defNames) {
        return `SUPER RAID! ${formatPlayer(raider)} touched ${defNames} — ${pointsAtt} points to ${attackerName}`;
      }
      if (raider) {
        return `SUPER RAID by ${formatPlayer(raider)} — ${pointsAtt} points to ${attackerName}`;
      }
      return `Super raid — ${pointsAtt} points to ${attackerName}`;
    }

    case 'bonus_point':
      return raider
        ? `Bonus point — ${formatPlayer(raider)} crosses the bonus line for ${attackerName}`
        : `Bonus point to ${attackerName}`;

    case 'tackle_point': {
      const tacklerNames = defenders.length > 0 ? joinDefenders(defenders) : defenderName;
      if (raider) {
        return `Tackle — ${tacklerNames} stops ${formatPlayer(raider)} — ${pointsDef} ${plural(pointsDef, 'point')} to ${defenderName}`;
      }
      return `Tackle by ${defenderName} — ${pointsDef} ${plural(pointsDef, 'point')}`;
    }

    case 'super_tackle': {
      const tacklerNames = defenders.length > 0 ? joinDefenders(defenders) : defenderName;
      if (raider) {
        return `SUPER TACKLE! ${tacklerNames} stops ${formatPlayer(raider)} — ${pointsDef} points to ${defenderName} (with ≤3 defenders on mat)`;
      }
      return `Super tackle by ${defenderName} — ${pointsDef} points`;
    }

    case 'all_out':
      return `ALL OUT! ${attackerName} scores +2 bonus (${defenderName} cleared from mat — all 7 revive)`;

    case 'empty_raid':
      return raider
        ? `Empty raid — ${formatPlayer(raider)} (${attackerName}) returns with no point`
        : `Empty raid by ${attackerName}`;

    case 'do_or_die_raid':
      return raider
        ? `Do-or-die raid — ${formatPlayer(raider)} must score for ${attackerName}`
        : `Do-or-die raid by ${attackerName}`;

    default:
      return fallback;
  }
}

interface RaiderInfo {
  fullName: string;
  jerseyNumber: number | null;
  teamName: string;
}

export function LiveMatchDisplay({
  matchId,
  initial,
  initialEvents,
  homeSlots: homeSlotsProp,
  awaySlots: awaySlotsProp,
  initialRaider,
}: {
  matchId: string;
  initial: InitialState;
  initialEvents: LiveEvent[];
  homeSlots: PlayerSlot[];
  awaySlots: PlayerSlot[];
  initialRaider: RaiderInfo | null;
}) {
  const router = useRouter();
  const { home, away } = initial;

  const [state, setState] = React.useState({
    status: initial.status,
    homeScore: initial.homeScore,
    awayScore: initial.awayScore,
    currentHalf: initial.currentHalf,
  });
  const [events, setEvents] = React.useState<LiveEvent[]>(initialEvents);
  const [homeSlots, setHomeSlots] = React.useState<PlayerSlot[]>(homeSlotsProp);
  const [awaySlots, setAwaySlots] = React.useState<PlayerSlot[]>(awaySlotsProp);
  const [connected, setConnected] = React.useState(false);
  const [flashSide, setFlashSide] = React.useState<'home' | 'away' | null>(null);

  // Timer state — driven by broadcasts from the scoring console, with local
  // ticking between broadcasts so the display stays smooth.
  const [running, setRunning] = React.useState(false);
  const [clockSeconds, setClockSeconds] = React.useState(initial.clockSeconds);
  const [raidRunning, setRaidRunning] = React.useState(false);
  const [raidLeft, setRaidLeft] = React.useState(0);
  const [currentRaider, setCurrentRaider] = React.useState<RaiderInfo | null>(
    initialRaider,
  );

  // When the server re-renders (after router.refresh), pick up any change to
  // the persisted raider so the banner reflects it on subsequent loads.
  React.useEffect(() => {
    setCurrentRaider(initialRaider);
  }, [initialRaider]);

  // Sync server-rendered props into local state when they change (after
  // router.refresh re-fetches with resolved names / updated player_state).
  React.useEffect(() => setEvents(initialEvents), [initialEvents]);
  React.useEffect(() => setHomeSlots(homeSlotsProp), [homeSlotsProp]);
  React.useEffect(() => setAwaySlots(awaySlotsProp), [awaySlotsProp]);

  // Local match-clock tick — keeps the countdown moving even between broadcasts.
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setClockSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Local raid-timer tick — coupled to global running state.
  React.useEffect(() => {
    if (!raidRunning || !running) return;
    const t = setInterval(() => setRaidLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [raidRunning, running]);

  // Realtime subscriptions:
  //   • postgres_changes on `matches` → score / status updates (canonical truth)
  //   • postgres_changes on `match_events` → optimistic event log + refresh
  //   • postgres_changes on `match_player_state` → refresh slot dots
  //   • broadcast on `match-timer:<id>` → scoring console pushes timer state here
  React.useEffect(() => {
    const supabase = createClient();
    const matchChannel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          setState((s) => {
            const newHome = (next.home_score as number) ?? s.homeScore;
            const newAway = (next.away_score as number) ?? s.awayScore;
            if (newHome > s.homeScore) {
              setFlashSide('home');
              setTimeout(() => setFlashSide(null), 800);
            } else if (newAway > s.awayScore) {
              setFlashSide('away');
              setTimeout(() => setFlashSide(null), 800);
            }
            return {
              status: (next.status as string) ?? s.status,
              homeScore: newHome,
              awayScore: newAway,
              currentHalf: (next.current_half as number) ?? s.currentHalf,
            };
          });
          // Sync clock from canonical source on persisted match-row updates.
          if (typeof next.clock_seconds === 'number') setClockSeconds(next.clock_seconds);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const optimistic: LiveEvent = {
            id: raw.id as string,
            type: raw.type as string,
            half: raw.half as number,
            clock_seconds: raw.clock_seconds as number,
            points_attacker: (raw.points_attacker as number) ?? 0,
            points_defender: (raw.points_defender as number) ?? 0,
            attacking_team_id: raw.attacking_team_id as string,
            created_at: raw.created_at as string,
            raider: null,
            defenders: [],
          };
          setEvents((evts) => [optimistic, ...evts].slice(0, 50));
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setEvents((evts) => evts.filter((e) => e.id !== oldId));
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_player_state',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          // Player state changed — re-fetch so slot dots update.
          router.refresh();
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    const timerChannel = supabase
      .channel(`match-timer:${matchId}`)
      .on('broadcast', { event: 'timer' }, ({ payload }) => {
        const p = payload as {
          running?: boolean;
          clockSeconds?: number;
          raidRunning?: boolean;
          raidLeft?: number;
          currentRaider?: {
            fullName: string;
            jerseyNumber: number | null;
            teamName: string;
          } | null;
        };
        if (typeof p.running === 'boolean') setRunning(p.running);
        if (typeof p.clockSeconds === 'number') setClockSeconds(p.clockSeconds);
        if (typeof p.raidRunning === 'boolean') setRaidRunning(p.raidRunning);
        if (typeof p.raidLeft === 'number') setRaidLeft(p.raidLeft);
        // null is meaningful — clears the banner when raid resolves.
        if ('currentRaider' in p) setCurrentRaider(p.currentRaider ?? null);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(matchChannel);
      void supabase.removeChannel(timerChannel);
    };
  }, [matchId, router]);

  const isLive = state.status === 'live';
  const remaining = Math.max(0, HALF_SECONDS - clockSeconds);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {initial.round && (
            <span className="font-medium uppercase tracking-wider">{initial.round}</span>
          )}
          {initial.round && <span>·</span>}
          <span>
            {new Date(initial.scheduledAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {connected ? (
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <Wifi className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <WifiOff className="h-3 w-3" /> Connecting…
            </span>
          )}
        </div>
      </div>

      {/* SCOREBOARD — teams with dots, countdowns in center */}
      <Card className="overflow-hidden">
        <div className="relative">
          {isLive && (
            <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gradient-to-r from-primary via-orange-500 to-primary" />
          )}
        </div>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <BigTeam team={home} score={state.homeScore} flash={flashSide === 'home'} slots={homeSlots} />

            <div className="space-y-3 text-center">
              <StatusPill status={state.status} />
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Q{state.currentHalf} · {Math.floor(HALF_SECONDS / 60)} min half
              </div>
              <div
                className={cn(
                  'font-mono text-4xl font-bold tabular-nums md:text-5xl',
                  remaining <= 60 && remaining > 0 && 'text-amber-500',
                  remaining === 0 && 'text-destructive',
                )}
              >
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(remaining % 60).toString().padStart(2, '0')}
              </div>

              <div className="flex flex-col items-center gap-1 pt-2">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Timer className="h-3 w-3" /> raid · {RAID_SECONDS}s
                </div>
                <div className={raidRingClass(raidLeft, raidRunning)}>
                  {raidLeft.toString().padStart(2, '0')}
                </div>
                {raidRunning && running && (
                  <div className="text-[10px] font-medium text-primary">RAID IN PROGRESS</div>
                )}
              </div>
            </div>

            <BigTeam team={away} score={state.awayScore} flash={flashSide === 'away'} slots={awaySlots} />
          </div>
        </CardContent>
      </Card>

      {/* RAID-IN-PROGRESS BANNER — broadcast from the scoring console */}
      {currentRaider && (
        <Card className="overflow-hidden border-primary/40 bg-primary/[0.04]">
          <CardContent className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="font-semibold uppercase tracking-wider text-primary">
              Raid in progress
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">
              {currentRaider.fullName}
              {currentRaider.jerseyNumber != null && ` #${currentRaider.jerseyNumber}`}
            </span>
            <span className="text-muted-foreground">raiding for {currentRaider.teamName}</span>
            {raidRunning && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {raidLeft.toString().padStart(2, '0')}s left
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* COMMENTARY + STATS */}
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-primary" />
              Commentary
            </div>
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Match hasn&apos;t started yet. Updates will appear here in real time.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => {
                  const homeAttacking = e.attacking_team_id === home.id;
                  const team = homeAttacking ? home : away;
                  const attackerName = homeAttacking ? home.name : away.name;
                  const defenderName = homeAttacking ? away.name : home.name;
                  const description = describeEvent(e, attackerName, defenderName);
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-md border border-border/40 bg-card/50 px-3 py-2 text-sm"
                    >
                      <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                        Q{e.half}{' '}
                        {Math.floor(e.clock_seconds / 60)
                          .toString()
                          .padStart(2, '0')}
                        :{(e.clock_seconds % 60).toString().padStart(2, '0')}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px]"
                        style={{
                          borderColor: team.primary_color
                            ? `${team.primary_color}80`
                            : undefined,
                          color: team.primary_color ?? undefined,
                        }}
                      >
                        {team.short_name || initials(team.name)}
                      </Badge>
                      <span className="min-w-0 flex-1 leading-snug">{description}</span>
                      <span className="shrink-0 font-mono text-xs">
                        {e.points_attacker > 0 && (
                          <span className="text-emerald-500">+{e.points_attacker}</span>
                        )}
                        {e.points_defender > 0 && (
                          <span className="text-sky-500">+{e.points_defender}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Match stats
            </div>
            <StatRow label="Total points" home={state.homeScore} away={state.awayScore} />
            <StatRow
              label="Raid points"
              home={events
                .filter(
                  (e) =>
                    e.attacking_team_id === home.id &&
                    e.type !== 'tackle_point' &&
                    e.type !== 'super_tackle',
                )
                .reduce((s, e) => s + e.points_attacker, 0)}
              away={events
                .filter(
                  (e) =>
                    e.attacking_team_id === away.id &&
                    e.type !== 'tackle_point' &&
                    e.type !== 'super_tackle',
                )
                .reduce((s, e) => s + e.points_attacker, 0)}
            />
            <StatRow
              label="Defence points"
              home={events
                .filter((e) => e.attacking_team_id !== home.id)
                .reduce((s, e) => s + e.points_defender, 0)}
              away={events
                .filter((e) => e.attacking_team_id !== away.id)
                .reduce((s, e) => s + e.points_defender, 0)}
            />
            <StatRow
              label="All outs"
              home={
                events.filter((e) => e.attacking_team_id === home.id && e.type === 'all_out')
                  .length
              }
              away={
                events.filter((e) => e.attacking_team_id === away.id && e.type === 'all_out')
                  .length
              }
            />
            <StatRow
              label="On mat"
              home={homeSlots.filter((s) => s.state === 'on_mat').length}
              away={awaySlots.filter((s) => s.state === 'on_mat').length}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function raidRingClass(raidLeft: number, raidRunning: boolean): string {
  return cn(
    'flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono text-lg font-bold tabular-nums transition-colors',
    !raidRunning && raidLeft === 0 && 'border-border text-muted-foreground',
    raidRunning && raidLeft > 15 && 'border-emerald-500/60 text-emerald-500',
    raidRunning && raidLeft <= 15 && raidLeft > 10 && 'border-amber-500/60 text-amber-500',
    raidRunning && raidLeft <= 10 && raidLeft > 5 && 'border-orange-500/60 text-orange-500',
    raidRunning && raidLeft <= 5 && 'animate-pulse border-destructive text-destructive',
  );
}

function BigTeam({
  team,
  score,
  flash,
  slots,
}: {
  team: TeamLite;
  score: number;
  flash?: boolean;
  slots: PlayerSlot[];
}) {
  // Active roster on the field = on_mat + out + suspended.
  // Bench players don't appear in the dots, red-carded are removed.
  const activeSlots = slots.filter(
    (s) => s.state === 'on_mat' || s.state === 'out' || s.state === 'suspended',
  );
  const onMatCount = activeSlots.filter((s) => s.state === 'on_mat').length;
  const total = activeSlots.length;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-base font-bold text-white shadow-xl md:h-20 md:w-20"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-muted-foreground">{team.name}</div>
        {total > 0 && (
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-1" aria-label={`${onMatCount} on mat, ${total - onMatCount} out`}>
              {activeSlots.map((s, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full ring-1 transition-colors',
                    s.state === 'on_mat'
                      ? 'bg-emerald-500 ring-emerald-500/40'
                      : 'bg-red-500 ring-red-500/40',
                  )}
                  title={s.state === 'on_mat' ? 'On mat' : `Out (${s.state})`}
                />
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {onMatCount}/{total}
            </span>
          </div>
        )}
      </div>
      <div
        className={cn(
          'font-mono text-5xl font-bold tabular-nums transition-all md:text-7xl',
          flash && 'scale-110 text-primary drop-shadow-[0_0_20px_hsl(var(--primary))]',
        )}
      >
        {score}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return (
        <Badge variant="live" className="gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          LIVE
        </Badge>
      );
    case 'half_time':
      return <Badge>HALF TIME</Badge>;
    case 'completed':
      return <Badge variant="success">FINAL</Badge>;
    default:
      return <Badge variant="outline">SCHEDULED</Badge>;
  }
}

function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  const total = Math.max(home + away, 1);
  return (
    <div className="space-y-1 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-foreground">{home}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{away}</span>
      </div>
      <div className="flex h-1 overflow-hidden rounded-full bg-secondary/50">
        <div className="bg-primary" style={{ width: `${(home / total) * 100}%` }} />
        <div className="bg-sky-500" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}
