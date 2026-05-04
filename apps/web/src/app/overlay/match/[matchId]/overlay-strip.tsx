'use client';

import * as React from 'react';
import { KABADDI } from '@kabaddiadda/shared';
import { createClient } from '@/lib/supabase/client';
import { cn, initials } from '@/lib/utils';

const HALF_SECONDS = KABADDI.MATCH_HALF_SECONDS;

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

interface RaiderRef extends PlayerRef {
  teamName: string;
}

interface SlotRef {
  playerId: string;
  state: string;
}

interface LastEvent {
  type: string;
  attackingTeamId: string;
  pointsAttacker: number;
  pointsDefender: number;
  raider: PlayerRef | null;
  defenders: PlayerRef[];
  details: Record<string, unknown> | null;
}

interface InitialState {
  status: string;
  homeScore: number;
  awayScore: number;
  currentHalf: number;
  clockSeconds: number;
  currentAttackingTeamId: string | null;
  homeDodCounter: number;
  awayDodCounter: number;
  currentRaider: RaiderRef | null;
  home: TeamLite;
  away: TeamLite;
  homeSlots: SlotRef[];
  awaySlots: SlotRef[];
  lastEvent: LastEvent | null;
  playerMap: Record<string, { fullName: string; jerseyNumber: number | null }>;
}

function fmt(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function shortPlayer(p: PlayerRef): string {
  const first = p.fullName.split(' ')[0] ?? p.fullName;
  return p.jerseyNumber != null ? `${first} #${p.jerseyNumber}` : first;
}

/**
 * Builds a one-line commentary for the most recent event. Mirrors the
 * scoring console's describeEvent but trimmed to fit a broadcast strip.
 */
function describeLastEvent(e: LastEvent): string {
  const r = e.raider ? shortPlayer(e.raider) : '';
  const d = e.defenders[0] ? shortPlayer(e.defenders[0]) : '';
  const reason =
    e.details && typeof e.details === 'object' && 'reason' in e.details
      ? (e.details.reason as string)
      : null;

  switch (e.type) {
    case 'raid_point':
      if (reason === 'bonus_plus_defender_self_out') {
        return r ? `${r} bonus +${e.pointsAttacker}` : `Bonus + def out +${e.pointsAttacker}`;
      }
      if (reason === 'defender_self_out' || reason === 'defender_out_of_bounds') {
        return `Defender out +${e.pointsAttacker}`;
      }
      return r ? `${r} touch +${e.pointsAttacker}` : `Touch +${e.pointsAttacker}`;
    case 'super_raid':
      return r ? `${r} super raid +${e.pointsAttacker}` : `Super raid +${e.pointsAttacker}`;
    case 'bonus_point':
      return r ? `${r} bonus +1` : 'Bonus +1';
    case 'tackle_point':
      if (reason === 'bonus_plus_tackle') return r ? `${r} B+T` : 'Bonus + Tackle';
      if (reason === 'bonus_plus_self_out') return r ? `${r} B+SO` : 'Bonus + Self-out';
      if (reason === 'raider_self_out') return r ? `${r} self out` : 'Self out';
      if (reason === 'raider_out_of_bounds') return r ? `${r} out` : 'Raider out';
      return d ? `${d} tackled ${r || 'raider'} +1` : r ? `Tackle on ${r} +1` : 'Tackle +1';
    case 'super_tackle':
      return d
        ? `${d} super tackle +2`
        : r
          ? `Super tackle on ${r} +2`
          : 'Super tackle +2';
    case 'all_out':
      return 'All-out +2';
    case 'do_or_die_raid':
      return e.pointsAttacker > 0
        ? r
          ? `${r} DoD scored +${e.pointsAttacker}`
          : `DoD scored +${e.pointsAttacker}`
        : r
          ? `${r} DoD failed`
          : 'DoD failed';
    case 'empty_raid':
      return r ? `${r} empty raid` : 'Empty raid';
    case 'green_card':
      return 'Green card';
    case 'yellow_card':
      return 'Yellow card';
    case 'red_card':
      return 'Red card';
    case 'substitution':
      return 'Substitution';
    case 'technical_point':
      return `Tech +${e.pointsAttacker}`;
    default:
      return e.type;
  }
}

export function OverlayStrip({
  matchId,
  initial,
  previewMode = false,
}: {
  matchId: string;
  initial: InitialState;
  /** When true, renders a faux broadcast backdrop + watermark behind the
   *  strip so the operator can preview contrast / positioning without
   *  installing OBS. The backdrop never renders for the live `?preview=0`
   *  default that broadcasters use. */
  previewMode?: boolean;
}) {
  const home = initial.home;
  const away = initial.away;
  const [playerMap] = React.useState(initial.playerMap);

  const [status, setStatus] = React.useState(initial.status);
  const [homeScore, setHomeScore] = React.useState(initial.homeScore);
  const [awayScore, setAwayScore] = React.useState(initial.awayScore);
  const [half, setHalf] = React.useState(initial.currentHalf);
  const [clock, setClock] = React.useState(initial.clockSeconds);
  const [running, setRunning] = React.useState(false);
  const [raidLeft, setRaidLeft] = React.useState(0);
  const [raidRunning, setRaidRunning] = React.useState(false);
  const [currentRaider, setCurrentRaider] = React.useState<RaiderRef | null>(
    initial.currentRaider,
  );
  const [attackingTeamId, setAttackingTeamId] = React.useState<string | null>(
    initial.currentAttackingTeamId,
  );
  const [homeDod, setHomeDod] = React.useState(initial.homeDodCounter);
  const [awayDod, setAwayDod] = React.useState(initial.awayDodCounter);
  const [allOutFlash, setAllOutFlash] = React.useState<string | null>(null);
  const [homeSlots, setHomeSlots] = React.useState<SlotRef[]>(initial.homeSlots);
  const [awaySlots, setAwaySlots] = React.useState<SlotRef[]>(initial.awaySlots);
  const [lastEvent, setLastEvent] = React.useState<LastEvent | null>(initial.lastEvent);

  const lookup = React.useCallback(
    (id: string | null | undefined): PlayerRef | null => {
      if (!id) return null;
      const p = playerMap[id];
      if (!p) return null;
      return { fullName: p.fullName, jerseyNumber: p.jerseyNumber };
    },
    [playerMap],
  );

  // Realtime — score + status + DoD counters from postgres_changes on
  // matches; per-player slot state from postgres_changes on
  // match_player_state; last-event commentary from match_events INSERT;
  // timer + raid + raider from the broadcast channel the scoring console
  // already pushes to (1Hz heartbeat from the operator's open console).
  React.useEffect(() => {
    const supabase = createClient();

    const matchChannel = supabase
      .channel(`overlay-match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const m = payload.new as Record<string, unknown>;
          setHomeScore((m.home_score as number) ?? 0);
          setAwayScore((m.away_score as number) ?? 0);
          setStatus((m.status as string) ?? 'scheduled');
          setHalf((m.current_half as number) ?? 1);
          setHomeDod((m.home_dod_counter as number) ?? 0);
          setAwayDod((m.away_dod_counter as number) ?? 0);
          setAttackingTeamId((m.current_attacking_team_id as string) ?? null);
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
          const e = payload.new as Record<string, unknown>;
          if (e.type === 'all_out') {
            setAllOutFlash((e.attacking_team_id as string) ?? null);
            setTimeout(() => setAllOutFlash(null), 5000);
          }
          // Update the running last-event commentary for the side panels.
          const defenders = ((e.defender_ids as string[] | null) ?? [])
            .map((id) => lookup(id))
            .filter((p): p is PlayerRef => p !== null);
          setLastEvent({
            type: e.type as string,
            attackingTeamId: (e.attacking_team_id as string) ?? '',
            pointsAttacker: (e.points_attacker as number) ?? 0,
            pointsDefender: (e.points_defender as number) ?? 0,
            raider: lookup(e.raider_id as string | null),
            defenders,
            details: (e.details as Record<string, unknown> | null) ?? null,
          });
        },
      )
      // Slot dots — any state change (out, revival, sub, suspension) refreshes.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_player_state',
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          const { data } = await supabase
            .from('match_player_state')
            .select('player_id, team_id, state')
            .eq('match_id', matchId);
          if (!data) return;
          const stateById = new Map(data.map((s) => [s.player_id, s.state]));
          setHomeSlots((prev) =>
            prev.map((s) => ({ ...s, state: stateById.get(s.playerId) ?? s.state })),
          );
          setAwaySlots((prev) =>
            prev.map((s) => ({ ...s, state: stateById.get(s.playerId) ?? s.state })),
          );
        },
      )
      .subscribe();

    const timerChannel = supabase
      .channel(`match-timer:${matchId}`)
      .on('broadcast', { event: 'timer' }, ({ payload }) => {
        const p = payload as {
          running?: boolean;
          clockSeconds?: number;
          raidRunning?: boolean;
          raidLeft?: number;
          status?: string;
          currentHalf?: number;
          currentRaider?: RaiderRef | null;
        };
        if (p.running !== undefined) setRunning(p.running);
        if (p.clockSeconds !== undefined) setClock(p.clockSeconds);
        if (p.raidRunning !== undefined) setRaidRunning(p.raidRunning);
        if (p.raidLeft !== undefined) setRaidLeft(p.raidLeft);
        if (p.status !== undefined) setStatus(p.status);
        if (p.currentHalf !== undefined) setHalf(p.currentHalf);
        if (p.currentRaider !== undefined) setCurrentRaider(p.currentRaider);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(matchChannel);
      void supabase.removeChannel(timerChannel);
    };
  }, [matchId, lookup]);

  // Local 1Hz tick keeps the displayed clock smooth between broadcasts.
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  React.useEffect(() => {
    if (!raidRunning) return;
    const t = setInterval(
      () => setRaidLeft((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(t);
  }, [raidRunning]);

  const remaining = Math.max(0, HALF_SECONDS - clock);
  const homeAttacking = attackingTeamId === home.id;
  const awayAttacking = attackingTeamId === away.id;
  const dodActive =
    (homeAttacking && homeDod >= 2) || (awayAttacking && awayDod >= 2);
  const isLive = status === 'live';

  // Per-side bottom label.
  //   • While a raid is in progress: the attacking team shows the current
  //     raider, the *other* team shows the last event commentary.
  //   • Between raids: the team that scored on the last event shows the
  //     commentary (the other side stays empty).
  const lastEventText = lastEvent ? describeLastEvent(lastEvent) : null;
  const raidActive = !!currentRaider && (homeAttacking || awayAttacking);

  function sideLabel(thisSideAttacking: boolean, thisSideId: string): string | null {
    if (thisSideAttacking && currentRaider) {
      return `▶ ${shortPlayer(currentRaider)}`;
    }
    if (raidActive) {
      // Defending side during a live raid — always show the last action.
      return lastEventText;
    }
    // Between raids — only show on the team that scored.
    if (lastEvent && lastEventText && lastEvent.attackingTeamId === thisSideId) {
      return lastEventText;
    }
    return null;
  }

  const homeLabel = sideLabel(homeAttacking, home.id);
  const awayLabel = sideLabel(awayAttacking, away.id);
  const homeLabelTone = homeAttacking && currentRaider ? 'raider' : 'event';
  const awayLabelTone = awayAttacking && currentRaider ? 'raider' : 'event';

  return (
    <>
      {previewMode && <PreviewBackdrop />}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-4">
      <div className="relative flex h-[170px] w-full max-w-[1920px] items-stretch overflow-hidden rounded-2xl bg-zinc-950/92 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/10">
        {/* Top accent bar — gradient + DoD/all-out pulse */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
            allOutFlash
              ? 'from-emerald-500 via-emerald-400 to-emerald-500 animate-pulse'
              : dodActive
                ? 'from-rose-500 via-rose-400 to-rose-500 animate-pulse'
                : 'from-orange-500 via-amber-400 to-orange-500',
          )}
        />

        {/* HOME side */}
        <TeamSide
          team={home}
          score={homeScore}
          align="left"
          attacking={homeAttacking}
          slots={homeSlots}
          label={homeLabel}
          labelTone={homeLabelTone}
        />

        {/* CENTER — half + match clock + raid clock + status */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400">
            Q{half}
          </div>
          <div
            className={cn(
              'font-mono text-4xl font-black leading-none tabular-nums',
              remaining <= 60 && remaining > 0 && isLive && 'text-amber-400',
              remaining === 0 && isLive && 'text-rose-500',
            )}
          >
            {fmt(remaining)}
          </div>
          <StatusPill status={status} />
          <RaidTimer raidLeft={raidLeft} raidRunning={raidRunning} />
        </div>

        {/* AWAY side */}
        <TeamSide
          team={away}
          score={awayScore}
          align="right"
          attacking={awayAttacking}
          slots={awaySlots}
          label={awayLabel}
          labelTone={awayLabelTone}
        />

        {/* CONTEXT BADGES — top-right corner */}
        <div className="absolute right-3 top-2 flex gap-1.5">
          {dodActive && <ContextBadge tone="rose" label="Do-or-die" pulse />}
          {allOutFlash && (
            <ContextBadge tone="emerald" label="All-out +2" pulse />
          )}
        </div>

        {/* BOTTOM accent — split into team primary colours */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[3px]">
          <div
            className="flex-1"
            style={{ background: home.primary_color ?? '#f97316' }}
          />
          <div
            className="flex-1"
            style={{ background: away.primary_color ?? '#0ea5e9' }}
          />
        </div>
      </div>
      </div>
    </>
  );
}

function TeamSide({
  team,
  score,
  align,
  attacking,
  slots,
  label,
  labelTone,
}: {
  team: TeamLite;
  score: number;
  align: 'left' | 'right';
  attacking: boolean;
  slots: SlotRef[];
  label: string | null;
  labelTone: 'raider' | 'event';
}) {
  const logo = (
    <div
      className={cn(
        'flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg ring-2',
        attacking ? 'ring-orange-400' : 'ring-white/10',
      )}
      style={{
        background: team.primary_color
          ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
          : 'linear-gradient(135deg, #f97316, #ea580c)',
      }}
    >
      {team.short_name || initials(team.name)}
    </div>
  );

  const content = (
    <div className={cn('flex flex-col gap-1', align === 'right' && 'items-end')}>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-300">
        {team.short_name || team.name.slice(0, 3).toUpperCase()}
      </div>
      <div className="font-mono text-[56px] font-black leading-none tabular-nums">
        {score}
      </div>
      <SlotDots slots={slots} align={align} />
      {label && (
        <div
          className={cn(
            'max-w-[260px] truncate text-[11px] font-medium',
            labelTone === 'raider'
              ? 'text-orange-300'
              : 'text-zinc-300',
            align === 'right' && 'text-right',
          )}
          title={label}
        >
          {label}
        </div>
      )}
    </div>
  );

  // Pin each side to its outer edge: home group hugs the strip's left,
  // away group hugs the right. Centre column sits between them.
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-5',
        align === 'left' ? 'justify-start pl-6 pr-4' : 'justify-end pl-4 pr-6',
      )}
    >
      {align === 'left' ? (
        <>
          {logo}
          {content}
        </>
      ) : (
        <>
          {content}
          {logo}
        </>
      )}
    </div>
  );
}

function SlotDots({ slots, align }: { slots: SlotRef[]; align: 'left' | 'right' }) {
  // Mirror the public live page: bench / red-carded players are not shown.
  // Suspended count as out (red) so the broadcast strip stays a clean
  // green / red pair as the user requested.
  const active = slots.filter(
    (s) =>
      s.state === 'on_mat' ||
      s.state === 'out' ||
      s.state === 'suspended' ||
      s.state === 'red_carded',
  );
  if (active.length === 0) return null;
  const onMatCount = active.filter((s) => s.state === 'on_mat').length;
  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <div className="flex gap-1">
        {active.map((s, i) => (
          <span
            key={`${s.playerId}-${i}`}
            className={cn(
              'h-2.5 w-2.5 rounded-full ring-1 transition-colors',
              s.state === 'on_mat'
                ? 'bg-emerald-500 ring-emerald-400/60'
                : 'bg-rose-500 ring-rose-400/60',
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] font-semibold text-zinc-400">
        {onMatCount}/{active.length}
      </span>
    </div>
  );
}

function RaidTimer({
  raidLeft,
  raidRunning,
}: {
  raidLeft: number;
  raidRunning: boolean;
}) {
  if (!raidRunning && raidLeft === 0) {
    return (
      <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
        no raid
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center gap-1 font-mono text-xs font-bold tabular-nums',
        raidLeft > 15 && 'text-emerald-400',
        raidLeft <= 15 && raidLeft > 10 && 'text-amber-400',
        raidLeft <= 10 && raidLeft > 5 && 'text-orange-400',
        raidLeft <= 5 && 'animate-pulse text-rose-500',
      )}
    >
      <span className="text-[9px] uppercase tracking-[0.28em] opacity-70">
        Raid
      </span>
      {raidLeft.toString().padStart(2, '0')}s
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.28em] text-rose-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
        </span>
        Live
      </div>
    );
  }
  if (status === 'half_time') {
    return (
      <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-amber-400">
        Half time
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-emerald-400">
        Final
      </div>
    );
  }
  return (
    <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-zinc-500">
      Scheduled
    </div>
  );
}

function ContextBadge({
  tone,
  label,
  pulse,
}: {
  tone: 'orange' | 'rose' | 'emerald';
  label: string;
  pulse?: boolean;
}) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-500/95 text-white'
      : tone === 'rose'
        ? 'bg-rose-500/95 text-white'
        : 'bg-emerald-500/95 text-white';
  return (
    <div
      className={cn(
        'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg',
        toneClass,
        pulse && 'animate-pulse',
      )}
    >
      {label}
    </div>
  );
}

/**
 * Preview-only backdrop. Activated by ?preview=1 on the overlay URL — gives
 * the operator a faux broadcast canvas (dim arena gradient + watermark) so
 * they can see how the strip will composite over a video without installing
 * OBS. Real broadcasters never get this since they paste the URL without the
 * query param.
 */
function PreviewBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Dim arena gradient — radial spotlights that loosely mimic stadium lighting */}
      <div className="absolute inset-0 bg-zinc-900" />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at 30% 40%, rgba(234,88,12,0.18) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 70% 60%, rgba(14,165,233,0.18) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 50% 100%, rgba(245,158,11,0.12) 0%, transparent 60%)',
        }}
      />
      {/* Faux mat pattern — concentric rectangles like a kabaddi mat from above */}
      <div className="absolute left-1/2 top-1/2 h-[60%] w-[80%] -translate-x-1/2 -translate-y-[55%] rounded-md ring-1 ring-white/10 bg-gradient-to-b from-amber-900/20 via-zinc-900/0 to-zinc-900/0" />
      <div className="absolute left-1/2 top-1/2 h-[44%] w-[60%] -translate-x-1/2 -translate-y-[55%] rounded-md ring-1 ring-white/5" />

      {/* Preview watermark — corner pill so the operator never confuses
          this with what the broadcaster actually sees */}
      <div className="absolute left-4 top-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.32em] text-amber-300 backdrop-blur">
        Preview · ?preview=1 only
      </div>
      <div className="absolute right-4 top-4 max-w-[280px] rounded-md border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-[10px] leading-relaxed text-zinc-300 backdrop-blur">
        This dim canvas is a stand-in for your YouTube video — share the
        same URL <span className="text-zinc-500">without</span>{' '}
        <code className="text-amber-300">?preview=1</code> with your broadcaster.
      </div>
    </div>
  );
}
