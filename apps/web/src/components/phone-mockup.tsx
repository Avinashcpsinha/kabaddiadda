'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import {
  UserPlus,
  Trophy,
  Shield,
  Users,
  CalendarDays,
  Activity,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const HOME = {
  short: 'BLR',
  name: 'Bengaluru',
  score: 38,
  vars: { '--team-primary': '0 80% 50%', '--team-foreground': '0 0% 100%' } as CSSProperties,
};
const AWAY = {
  short: 'PAT',
  name: 'Patna',
  score: 32,
  vars: { '--team-primary': '210 90% 45%', '--team-foreground': '0 0% 100%' } as CSSProperties,
};

const SCREEN_INTERVAL_MS = 2800;

type ScreenKey = 'register' | 'tournament' | 'team' | 'player' | 'fixture' | 'live';
const SCREENS: ScreenKey[] = ['register', 'tournament', 'team', 'player', 'fixture', 'live'];

const NAV_ITEMS = ['Home', 'Teams', 'Live', 'Me'];
const NAV_FOR_SCREEN: Record<ScreenKey, number> = {
  register: 3,
  tournament: 0,
  team: 1,
  player: 1,
  fixture: 0,
  live: 2,
};

const slideVariants: Variants = {
  hidden: { opacity: 0, x: 28 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
};

export function PhoneMockup() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SCREENS.length);
    }, SCREEN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const screen = SCREENS[index];
  const activeNav = NAV_FOR_SCREEN[screen];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.6 },
        y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
      }}
      className="relative mx-auto max-w-[200px] sm:max-w-[240px] lg:max-w-[280px]"
    >
      <div aria-hidden className="absolute -inset-10 rounded-[3rem] bg-primary/25 blur-3xl" />

      <div className="glow-flame relative aspect-[9/19] -rotate-1 rounded-[2.5rem] border-[8px] border-foreground/15 bg-background p-1 shadow-2xl transition-transform duration-700 hover:rotate-0 sm:border-[10px] sm:p-1.5 lg:-rotate-3">
        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-card via-secondary to-background">
          <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground/85" />

          <div className="absolute inset-x-0 top-3 z-10 flex items-center justify-between px-5 font-mono text-[8px] tabular-stats text-foreground/80">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>5G</span>
              <span>100%</span>
            </span>
          </div>

          <div className="flex h-full flex-col px-3 pb-2.5 pt-12">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <span className="font-display text-[13px] uppercase leading-none tracking-wider">
                Kabaddi<span className="text-primary">adda</span>
              </span>
              <span
                aria-hidden
                className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-primary/60"
              />
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={screen}
                  variants={slideVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="absolute inset-0 flex flex-col"
                >
                  {screen === 'register' && <RegisterScreen />}
                  {screen === 'tournament' && <TournamentScreen />}
                  {screen === 'team' && <TeamScreen />}
                  {screen === 'player' && <PlayerScreen />}
                  {screen === 'fixture' && <FixtureScreen />}
                  {screen === 'live' && <LiveScreen />}
                </motion.div>
              </AnimatePresence>
            </div>

            <BottomNav active={activeNav} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────  S C R E E N S  ───────────────── */

function RegisterScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<UserPlus className="h-3 w-3" />}
        title="Join as organiser"
        hint="Free · 30 seconds"
      />
      <FormLabel>Full name</FormLabel>
      <FormInput placeholder="Avinash Sinha" />
      <FormLabel>Email</FormLabel>
      <FormInput placeholder="you@kabaddi.in" />
      <FormLabel>I want to</FormLabel>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <Chip selected>Organise</Chip>
        <Chip>Watch &amp; play</Chip>
      </div>

      <div className="mt-2 rounded-md border border-border/40 bg-muted/30 p-1.5">
        <ul className="space-y-0.5 font-mono text-[7.5px] uppercase tracking-wider">
          {['Unlimited tournaments', 'Live scoring console', 'Branded microsite'].map((f) => (
            <li key={f} className="flex items-center gap-1">
              <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-victory text-victory-foreground text-[7px]">
                ✓
              </span>
              <span className="text-foreground/85">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <PrimaryButton hint="Already have one? Sign in">Create account</PrimaryButton>
    </div>
  );
}

function TournamentScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<Trophy className="h-3 w-3" />}
        title="New tournament"
        hint="Step 1 of 4 · Basics"
      />
      <FormLabel>Tournament name</FormLabel>
      <FormInput placeholder="Pro Punjab Kabaddi 2026" />
      <FormLabel>Format</FormLabel>
      <div className="mt-1 grid grid-cols-3 gap-1">
        <Chip selected>League</Chip>
        <Chip>Knockout</Chip>
        <Chip>Hybrid</Chip>
      </div>
      <FormLabel>Dates</FormLabel>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <DateChip>15 May</DateChip>
        <DateChip>22 May</DateChip>
      </div>
      <FormLabel>Teams</FormLabel>
      <div className="mt-1 flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-2 py-1">
        <span className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-wider">
          <Users className="h-2.5 w-2.5 text-muted-foreground" />
          8 selected
        </span>
        <span className="font-display text-[8px] uppercase tracking-wider text-primary">+ Add</span>
      </div>

      <div className="mt-auto flex items-center justify-center gap-1 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 w-4 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
      <PrimaryButton compactTop>Save &amp; continue</PrimaryButton>
    </div>
  );
}

function TeamScreen() {
  const colors = [
    '0 80% 50%',
    '210 90% 45%',
    '142 70% 38%',
    '42 95% 50%',
    '330 75% 55%',
    '270 60% 50%',
  ];
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<Shield className="h-3 w-3" />}
        title="New team"
        hint="Build your roster"
      />
      <div
        style={{ '--team-primary': '0 80% 50%' } as CSSProperties}
        className="team-gradient mx-auto mb-2 mt-1 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
      >
        <span className="font-display text-sm uppercase tracking-wider text-white">BLR</span>
      </div>
      <FormLabel>Team name</FormLabel>
      <FormInput placeholder="Bengaluru Bulls" />
      <div className="grid grid-cols-2 gap-1">
        <div>
          <FormLabel>Short</FormLabel>
          <FormInput placeholder="BLR" />
        </div>
        <div>
          <FormLabel>City</FormLabel>
          <FormInput placeholder="Bengaluru" />
        </div>
      </div>
      <FormLabel>Primary color</FormLabel>
      <div className="mt-1 flex items-center gap-1.5">
        {colors.map((c, i) => (
          <span
            key={c}
            className={`h-4 w-4 shrink-0 rounded-full ${i === 0 ? 'ring-2 ring-foreground/80 ring-offset-1 ring-offset-background' : ''}`}
            style={{ background: `hsl(${c})` }}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5">
        <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-primary">
          <Users className="h-2.5 w-2.5" />
          0 players · roster empty
        </span>
        <span className="font-display text-[8px] uppercase tracking-wider text-primary">+ Add</span>
      </div>

      <PrimaryButton hint="Or import roster from CSV">Save team</PrimaryButton>
    </div>
  );
}

function PlayerScreen() {
  const recent = [
    { name: 'Pawan Sehrawat', no: '15', role: 'Raider' },
    { name: 'Naveen Kumar', no: '07', role: 'Raider' },
    { name: 'Pardeep N.', no: '03', role: 'All-rounder' },
  ];
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<Users className="h-3 w-3" />}
        title="Add player"
        hint="12 raiders · 8 defenders"
      />
      <FormLabel>Player name</FormLabel>
      <FormInput placeholder="Surender Singh" />
      <div className="mt-1 grid grid-cols-[1fr_auto] gap-1.5">
        <div className="min-w-0">
          <FormLabel>Role</FormLabel>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Chip selected>Raider</Chip>
            <Chip>Defender</Chip>
          </div>
        </div>
        <div>
          <FormLabel>Jersey</FormLabel>
          <FormInput placeholder="#15" small />
        </div>
      </div>
      <FormLabel>Recently added</FormLabel>
      <div className="mt-1 space-y-1">
        {recent.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-1.5 py-1"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-[8px] tabular-stats uppercase text-white">
              {p.no}
            </span>
            <span className="flex-1 truncate font-mono text-[8.5px] uppercase tracking-wider">
              {p.name}
            </span>
            <span className="font-mono text-[7.5px] uppercase text-muted-foreground">{p.role}</span>
          </div>
        ))}
      </div>
      <PrimaryButton hint="20 of 30 squad slots filled">Add player</PrimaryButton>
    </div>
  );
}

function FixtureScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<CalendarDays className="h-3 w-3" />}
        title="New fixture"
        hint="Round 1 · Match 3"
      />
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <div
          style={HOME.vars}
          className="team-gradient flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5"
        >
          <span className="font-display text-[10px] uppercase tracking-wider opacity-90">
            {HOME.short}
          </span>
          <span className="font-mono text-[7px] uppercase opacity-70">Home</span>
        </div>
        <span className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
          vs
        </span>
        <div
          style={AWAY.vars}
          className="team-gradient flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5"
        >
          <span className="font-display text-[10px] uppercase tracking-wider opacity-90">
            {AWAY.short}
          </span>
          <span className="font-mono text-[7px] uppercase opacity-70">Away</span>
        </div>
      </div>
      <FormLabel>Date</FormLabel>
      <FormInput placeholder="18 May 2026" />
      <div className="grid grid-cols-2 gap-1">
        <div>
          <FormLabel>Time</FormLabel>
          <FormInput placeholder="7:30 PM" />
        </div>
        <div>
          <FormLabel>Venue</FormLabel>
          <FormInput placeholder="IG Arena" />
        </div>
      </div>

      <div className="mt-2 rounded-md border border-border/40 bg-muted/30 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
            Round progress
          </span>
          <span className="font-display tabular-stats text-[8px] uppercase tracking-wider text-electric">
            5 / 8
          </span>
        </div>
        <div className="flex gap-0.5">
          {[1, 1, 1, 1, 1, 0, 0, 0].map((on, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-sm ${on ? 'bg-electric' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <PrimaryButton compactTop>Schedule fixture</PrimaryButton>
    </div>
  );
}

function LiveScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        icon={<Activity className="h-3 w-3" />}
        title="Live scoring"
        hint="Q3 · 09:42 remaining"
      />
      <span className="pulse-live mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-live px-1.5 py-0.5 font-display text-[8px] uppercase tracking-wider text-live-foreground">
        <span className="h-1 w-1 rounded-full bg-live-foreground" />
        Live now
      </span>

      <div className="mt-2 space-y-1.5">
        <ScoreRow team={HOME} />
        <ScoreRow team={AWAY} />
      </div>

      <div className="mt-2 rounded-lg border border-border/40 bg-muted/40 p-1.5">
        <div className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-wider text-electric">
          <Sparkles className="h-2.5 w-2.5" />
          Last raid
        </div>
        <div className="mt-0.5 font-mono text-[8px] leading-tight text-foreground">
          Pawan Sehrawat
        </div>
        <div className="font-mono text-[7.5px] leading-tight text-muted-foreground">
          3-pt Super Raid
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {[
          { v: '12', l: 'Raids' },
          { v: '7', l: 'Tackles' },
          { v: '2', l: 'Allouts' },
        ].map((s) => (
          <StatTile key={s.l} value={s.v} label={s.l} />
        ))}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-1 pt-1.5">
        <button className="rounded-md bg-victory py-1 font-display text-[8px] uppercase tracking-wider text-victory-foreground shadow-sm">
          + Raid
        </button>
        <button className="rounded-md bg-defeat py-1 font-display text-[8px] uppercase tracking-wider text-defeat-foreground shadow-sm">
          + Tackle
        </button>
      </div>
      <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
        <ArrowRight className="h-2 w-2" />
        Tap teams to score
      </div>
    </div>
  );
}

/* ─────────────────  P R I M I T I V E S  ───────────────── */

function ScreenHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-display text-[10px] uppercase leading-none tracking-[0.15em] text-foreground">
          {title}
        </div>
        {hint && (
          <div className="mt-0.5 truncate font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function FormLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </div>
  );
}

function FormInput({ placeholder, small = false }: { placeholder: string; small?: boolean }) {
  return (
    <div
      className={`mt-1 rounded-md border border-border/40 bg-muted/30 px-2 ${
        small ? 'py-0.5' : 'py-1'
      } font-mono text-[8.5px] uppercase tracking-wider text-foreground/90`}
    >
      {placeholder}
    </div>
  );
}

function Chip({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-1.5 py-1 font-display text-[8px] uppercase tracking-wider ${
        selected
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border/40 text-muted-foreground'
      }`}
    >
      {children}
    </span>
  );
}

function DateChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 rounded-md border border-border/40 bg-muted/30 px-1.5 py-1 font-mono text-[8.5px] uppercase tracking-wider">
      <CalendarDays className="h-2.5 w-2.5 text-electric" />
      {children}
    </span>
  );
}

function PrimaryButton({
  children,
  hint,
  compactTop = false,
}: {
  children: ReactNode;
  hint?: string;
  compactTop?: boolean;
}) {
  return (
    <div className={compactTop ? 'pt-1.5' : 'mt-auto pt-2'}>
      <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-1.5 font-display text-[10px] uppercase tracking-wider text-primary-foreground shadow-md">
        {children}
        <ArrowRight className="h-3 w-3" />
      </button>
      {hint && (
        <div className="mt-1 text-center font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ team }: { team: typeof HOME }) {
  return (
    <div
      style={team.vars}
      className="team-gradient flex items-center justify-between rounded-md px-2 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-display text-[10px] uppercase tracking-wider opacity-90">
          {team.short}
        </span>
        <span className="font-mono text-[7px] uppercase opacity-70">{team.name}</span>
      </div>
      <span className="font-display tabular-stats text-xl uppercase leading-none">
        {team.score}
      </span>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-1 py-1 text-center">
      <div className="font-display tabular-stats text-sm uppercase leading-none">{value}</div>
      <div className="mt-0.5 font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: number }) {
  return (
    <div className="relative mt-1.5 flex shrink-0 items-center justify-around border-t border-border/30 pt-1.5">
      {NAV_ITEMS.map((label, i) => (
        <span
          key={label}
          className={`relative font-mono text-[8px] uppercase tracking-wider transition-colors ${
            i === active ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {label}
          {i === active && (
            <motion.span
              layoutId="phone-nav-underline"
              className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
