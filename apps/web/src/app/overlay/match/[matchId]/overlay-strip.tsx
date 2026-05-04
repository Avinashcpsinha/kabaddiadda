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

interface RaiderRef {
  fullName: string;
  jerseyNumber: number | null;
  teamName: string;
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
}

function fmt(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function OverlayStrip({
  matchId,
  initial,
}: {
  matchId: string;
  initial: InitialState;
}) {
  const home = initial.home;
  const away = initial.away;

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
  // teamId that just got all-out'd — pulses for 5s as a "+2 to other side" cue.
  const [allOutFlash, setAllOutFlash] = React.useState<string | null>(null);

  // Realtime — score / status come from postgres_changes on the matches row,
  // timer + raid + raider come from the broadcast channel the scoring console
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
  }, [matchId]);

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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-4">
      <div className="relative flex h-[120px] w-full max-w-[1920px] items-stretch overflow-hidden rounded-2xl bg-zinc-950/92 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/10">
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
        />

        {/* CENTER — half / clock / status */}
        <div className="flex shrink-0 flex-col items-center justify-center px-8">
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
        </div>

        {/* AWAY side */}
        <TeamSide
          team={away}
          score={awayScore}
          align="right"
          attacking={awayAttacking}
        />

        {/* CONTEXT BADGES — top-right corner, stack horizontally */}
        <div className="absolute right-3 top-2 flex gap-1.5">
          {raidRunning && currentRaider && (
            <ContextBadge
              tone="orange"
              label={`${currentRaider.fullName.split(' ')[0]}${
                currentRaider.jerseyNumber != null
                  ? ` #${currentRaider.jerseyNumber}`
                  : ''
              } · ${raidLeft}s`}
            />
          )}
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
  );
}

function TeamSide({
  team,
  score,
  align,
  attacking,
}: {
  team: TeamLite;
  score: number;
  align: 'left' | 'right';
  attacking: boolean;
}) {
  const logo = (
    <div
      className={cn(
        'flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg ring-2',
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

  const text = (
    <div className={cn(align === 'left' ? 'text-left' : 'text-right')}>
      <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300">
        {team.short_name || team.name.slice(0, 3).toUpperCase()}
      </div>
      <div className="font-mono text-[64px] font-black leading-none tabular-nums">
        {score}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-1 items-center gap-4',
        align === 'left' ? 'justify-end pl-6 pr-4' : 'flex-row-reverse justify-end pl-4 pr-6',
      )}
    >
      {align === 'left' ? (
        <>
          {logo}
          {text}
        </>
      ) : (
        <>
          {logo}
          {text}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.28em] text-rose-400">
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
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.28em] text-amber-400">
        Half time
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.28em] text-emerald-400">
        Final
      </div>
    );
  }
  return (
    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.28em] text-zinc-500">
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
