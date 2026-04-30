'use client';

import * as React from 'react';
import { Lock, Play, Sparkles, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { KABADDI } from '@kabaddiadda/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, initials } from '@/lib/utils';
import { setMatchLineupsAndStartAction } from './actions';

export interface RosterPlayer {
  id: string;
  full_name: string;
  jersey_number: number | null;
  role: string;
  photo_url: string | null;
  is_captain: boolean;
}

export interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

export interface InitialLineup {
  startingPlayerIds: string[];
  benchPlayerIds: string[];
  captainId: string | null;
}

type Slot = 'off' | 'on_mat' | 'bench';

interface TeamSelection {
  bySlot: Record<string, Slot>;
  captainId: string | null;
}

function buildInitialSelection(
  roster: RosterPlayer[],
  initial: InitialLineup,
): TeamSelection {
  const bySlot: Record<string, Slot> = {};
  for (const p of roster) bySlot[p.id] = 'off';
  for (const id of initial.startingPlayerIds) {
    if (id in bySlot) bySlot[id] = 'on_mat';
  }
  for (const id of initial.benchPlayerIds) {
    if (id in bySlot) bySlot[id] = 'bench';
  }
  return { bySlot, captainId: initial.captainId };
}

function counts(sel: TeamSelection) {
  let onMat = 0;
  let bench = 0;
  for (const v of Object.values(sel.bySlot)) {
    if (v === 'on_mat') onMat++;
    else if (v === 'bench') bench++;
  }
  return { onMat, bench };
}

export function LineupBuilder({
  matchId,
  tournamentId,
  home,
  away,
  homeRoster,
  awayRoster,
  initialHome,
  initialAway,
  locked,
}: {
  matchId: string;
  tournamentId: string;
  home: TeamLite;
  away: TeamLite;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
  initialHome: InitialLineup;
  initialAway: InitialLineup;
  /** True when the match is already live — show lineup read-only. */
  locked: boolean;
}) {
  const [homeSel, setHomeSel] = React.useState<TeamSelection>(() =>
    buildInitialSelection(homeRoster, initialHome),
  );
  const [awaySel, setAwaySel] = React.useState<TeamSelection>(() =>
    buildInitialSelection(awayRoster, initialAway),
  );
  const [pending, startTransition] = React.useTransition();

  const homeCounts = counts(homeSel);
  const awayCounts = counts(awaySel);
  const homeReady = homeCounts.onMat === KABADDI.PLAYERS_PER_SIDE;
  const awayReady = awayCounts.onMat === KABADDI.PLAYERS_PER_SIDE;
  const canStart = homeReady && awayReady && !pending && !locked;

  function cycle(side: 'home' | 'away', playerId: string) {
    if (locked) return;
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    setter((prev) => {
      const current = prev.bySlot[playerId] ?? 'off';
      const c = countsLocal(prev);

      let next: Slot;
      if (current === 'off') {
        next = c.onMat < KABADDI.PLAYERS_PER_SIDE ? 'on_mat' : 'bench';
        if (next === 'bench' && c.bench >= KABADDI.MAX_BENCH_SIZE) {
          toast.error('Mat is full and bench is full. Remove a player first.');
          return prev;
        }
      } else if (current === 'on_mat') {
        if (c.bench >= KABADDI.MAX_BENCH_SIZE) {
          next = 'off';
        } else {
          next = 'bench';
        }
      } else {
        next = 'off';
      }

      const nextBySlot = { ...prev.bySlot, [playerId]: next };
      let captainId = prev.captainId;
      if (captainId === playerId && next !== 'on_mat') captainId = null;
      return { bySlot: nextBySlot, captainId };
    });
  }

  function setSlot(side: 'home' | 'away', playerId: string, slot: Slot) {
    if (locked) return;
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    setter((prev) => {
      const c = countsLocal(prev);
      const current = prev.bySlot[playerId] ?? 'off';
      if (slot === current) return prev;
      if (slot === 'on_mat' && c.onMat >= KABADDI.PLAYERS_PER_SIDE && current !== 'on_mat') {
        toast.error(`Mat is full (${KABADDI.PLAYERS_PER_SIDE} players already).`);
        return prev;
      }
      if (slot === 'bench' && c.bench >= KABADDI.MAX_BENCH_SIZE && current !== 'bench') {
        toast.error(`Bench is full (${KABADDI.MAX_BENCH_SIZE} players already).`);
        return prev;
      }
      const nextBySlot = { ...prev.bySlot, [playerId]: slot };
      let captainId = prev.captainId;
      if (captainId === playerId && slot !== 'on_mat') captainId = null;
      return { bySlot: nextBySlot, captainId };
    });
  }

  function setCaptain(side: 'home' | 'away', playerId: string | null) {
    if (locked) return;
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    setter((prev) => {
      if (playerId && prev.bySlot[playerId] !== 'on_mat') return prev;
      return { ...prev, captainId: playerId };
    });
  }

  function quickFill(side: 'home' | 'away') {
    if (locked) return;
    const roster = side === 'home' ? homeRoster : awayRoster;
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    const bySlot: Record<string, Slot> = {};
    let mat = 0;
    let bench = 0;
    let captainId: string | null = null;
    for (const p of roster) {
      if (mat < KABADDI.PLAYERS_PER_SIDE) {
        bySlot[p.id] = 'on_mat';
        if (p.is_captain && !captainId) captainId = p.id;
        mat++;
      } else if (bench < KABADDI.MAX_BENCH_SIZE) {
        bySlot[p.id] = 'bench';
        bench++;
      } else {
        bySlot[p.id] = 'off';
      }
    }
    setter({ bySlot, captainId });
  }

  function clearAll(side: 'home' | 'away') {
    if (locked) return;
    const roster = side === 'home' ? homeRoster : awayRoster;
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    const bySlot: Record<string, Slot> = {};
    for (const p of roster) bySlot[p.id] = 'off';
    setter({ bySlot, captainId: null });
  }

  function selectionToInput(team: TeamLite, sel: TeamSelection) {
    const startingPlayerIds: string[] = [];
    const benchPlayerIds: string[] = [];
    for (const [pid, slot] of Object.entries(sel.bySlot)) {
      if (slot === 'on_mat') startingPlayerIds.push(pid);
      else if (slot === 'bench') benchPlayerIds.push(pid);
    }
    return {
      teamId: team.id,
      startingPlayerIds,
      benchPlayerIds,
      captainId: sel.captainId,
    };
  }

  function handleSubmit(startMatch: boolean) {
    if (startMatch && !canStart) return;
    startTransition(() => {
      void (async () => {
        const res = await setMatchLineupsAndStartAction(
          tournamentId,
          matchId,
          [selectionToInput(home, homeSel), selectionToInput(away, awaySel)],
          { startMatch },
        );
        if (res?.error) toast.error(res.error);
        else if (!startMatch) toast.success('Lineups saved');
      })();
    });
  }

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
          <Lock className="h-4 w-4" />
          Lineup is locked — match has started. Substitutions during the match are recorded as
          events on the scoring console.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamPanel
          team={home}
          roster={homeRoster}
          sel={homeSel}
          counts={homeCounts}
          ready={homeReady}
          locked={locked}
          onCycle={(pid) => cycle('home', pid)}
          onSet={(pid, slot) => setSlot('home', pid, slot)}
          onCaptain={(pid) => setCaptain('home', pid)}
          onQuickFill={() => quickFill('home')}
          onClear={() => clearAll('home')}
        />
        <TeamPanel
          team={away}
          roster={awayRoster}
          sel={awaySel}
          counts={awayCounts}
          ready={awayReady}
          locked={locked}
          onCycle={(pid) => cycle('away', pid)}
          onSet={(pid, slot) => setSlot('away', pid, slot)}
          onCaptain={(pid) => setCaptain('away', pid)}
          onQuickFill={() => quickFill('away')}
          onClear={() => clearAll('away')}
        />
      </div>

      {!locked && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm text-muted-foreground">
              {homeReady && awayReady ? (
                <span className="text-emerald-500">Both teams ready. Locking the lineup will start the match.</span>
              ) : (
                <span>
                  Pick {KABADDI.PLAYERS_PER_SIDE} starters per team to enable the start button.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={pending}
              >
                Save draft
              </Button>
              <Button
                variant="flame"
                size="lg"
                onClick={() => handleSubmit(true)}
                disabled={!canStart}
              >
                <Play className="h-4 w-4" />
                Lock & start match
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function countsLocal(sel: TeamSelection) {
  return counts(sel);
}

function TeamPanel({
  team,
  roster,
  sel,
  counts: c,
  ready,
  locked,
  onCycle,
  onSet,
  onCaptain,
  onQuickFill,
  onClear,
}: {
  team: TeamLite;
  roster: RosterPlayer[];
  sel: TeamSelection;
  counts: { onMat: number; bench: number };
  ready: boolean;
  locked: boolean;
  onCycle: (pid: string) => void;
  onSet: (pid: string, slot: Slot) => void;
  onCaptain: (pid: string | null) => void;
  onQuickFill: () => void;
  onClear: () => void;
}) {
  const matIds = roster.filter((p) => sel.bySlot[p.id] === 'on_mat').map((p) => p.id);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
              style={{
                background: team.primary_color
                  ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
                  : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
              }}
            >
              {team.short_name || initials(team.name)}
            </div>
            <div>
              <div className="text-sm font-semibold">{team.name}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={cn('inline-flex items-center gap-1', ready ? 'text-emerald-500' : 'text-muted-foreground')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', ready ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                  {c.onMat}/{KABADDI.PLAYERS_PER_SIDE} on mat
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {c.bench}/{KABADDI.MAX_BENCH_SIZE} bench
                </span>
              </div>
            </div>
          </div>
          {!locked && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={onQuickFill} disabled={roster.length === 0}>
                <Sparkles className="h-3 w-3" />
                Quick fill
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-3 w-3" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {roster.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
            No players on this roster yet. Add players to the team first.
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {roster.map((p) => {
                const slot = sel.bySlot[p.id] ?? 'off';
                const isCaptain = sel.captainId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => !locked && onCycle(p.id)}
                    className={cn(
                      'group flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm transition-all',
                      slot === 'on_mat' && 'border-emerald-500/60 bg-emerald-500/10',
                      slot === 'bench' && 'border-sky-500/60 bg-sky-500/10',
                      slot === 'off' && 'border-border bg-card hover:bg-accent/30',
                      locked && 'cursor-default',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(p.full_name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{p.full_name}</span>
                        {p.jersey_number != null && (
                          <span className="font-mono text-xs text-muted-foreground">#{p.jersey_number}</span>
                        )}
                        {p.is_captain && <Badge variant="outline" className="text-[9px]">C</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{formatRole(p.role)}</div>
                    </div>
                    {!locked && (
                      <div
                        className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SlotBtn active={slot === 'on_mat'} onClick={() => onSet(p.id, 'on_mat')} label="Mat" tone="mat" />
                        <SlotBtn active={slot === 'bench'} onClick={() => onSet(p.id, 'bench')} label="Bench" tone="bench" />
                        <SlotBtn active={slot === 'off'} onClick={() => onSet(p.id, 'off')} label="—" tone="off" />
                      </div>
                    )}
                    <SlotPill slot={slot} />
                  </div>
                );
              })}
            </div>

            {/* Captain selector */}
            <div className="border-t border-border/50 pt-3">
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                Captain
              </label>
              <select
                value={sel.captainId ?? ''}
                onChange={(e) => onCaptain(e.target.value || null)}
                disabled={locked || matIds.length === 0}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">— No captain —</option>
                {roster
                  .filter((p) => matIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                      {p.jersey_number != null ? ` · #${p.jersey_number}` : ''}
                    </option>
                  ))}
              </select>
              {matIds.length === 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Pick on-mat players to enable captain selection.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SlotBtn({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'mat' | 'bench' | 'off';
}) {
  const toneClass =
    tone === 'mat'
      ? active
        ? 'border-emerald-500 bg-emerald-500 text-white'
        : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
      : tone === 'bench'
        ? active
          ? 'border-sky-500 bg-sky-500 text-white'
          : 'border-sky-500/30 text-sky-500 hover:bg-sky-500/10'
        : active
          ? 'border-muted-foreground bg-muted text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent/30';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded border px-2 py-0.5 text-[10px] font-medium transition-colors', toneClass)}
    >
      {label}
    </button>
  );
}

function SlotPill({ slot }: { slot: Slot }) {
  if (slot === 'on_mat') {
    return (
      <Badge className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-500">
        ON MAT
      </Badge>
    );
  }
  if (slot === 'bench') {
    return (
      <Badge className="shrink-0 border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-500">
        BENCH
      </Badge>
    );
  }
  return null;
}

function formatRole(role: string): string {
  switch (role) {
    case 'raider':
      return 'Raider';
    case 'all_rounder':
      return 'All-rounder';
    case 'defender_corner':
      return 'Defender · Corner';
    case 'defender_cover':
      return 'Defender · Cover';
    default:
      return role;
  }
}
