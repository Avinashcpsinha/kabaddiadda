'use client';

import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

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

const NAV_ITEMS = ['Home', 'Live', 'Teams', 'Me'];

export function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.6 },
        y: {
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      className="relative mx-auto max-w-[200px] sm:max-w-[240px] lg:max-w-[280px]"
    >
      {/* halo */}
      <div
        aria-hidden
        className="absolute -inset-10 rounded-[3rem] bg-primary/25 blur-3xl"
      />

      {/* phone frame */}
      <div className="glow-flame relative aspect-[9/19] -rotate-1 rounded-[2.5rem] border-[8px] border-foreground/15 bg-background p-1 shadow-2xl transition-transform duration-700 hover:rotate-0 sm:border-[10px] sm:p-1.5 lg:-rotate-3">
        {/* screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-card via-secondary to-background">
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground/85" />

          {/* status bar */}
          <div className="absolute inset-x-0 top-3 z-10 flex items-center justify-between px-5 font-mono text-[8px] tabular-stats text-foreground/80">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>5G</span>
              <span>100%</span>
            </span>
          </div>

          {/* App content */}
          <div className="flex h-full flex-col px-3.5 pb-3 pt-12">
            {/* Brand header */}
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm uppercase leading-none tracking-wider">
                Kabaddi<span className="text-primary">adda</span>
              </span>
              <span
                aria-hidden
                className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/60"
              />
            </div>

            {/* Live pill */}
            <span className="pulse-live inline-flex w-fit items-center gap-1 rounded-full bg-live px-1.5 py-0.5 font-display text-[8px] uppercase tracking-wider text-live-foreground">
              <span className="h-1 w-1 rounded-full bg-live-foreground" />
              Live · Q3 09:42
            </span>

            {/* Match scoreboard */}
            <div className="mt-2.5 space-y-1.5">
              <ScoreRow team={HOME} />
              <ScoreRow team={AWAY} />
            </div>

            {/* Last raid card */}
            <div className="mt-2.5 rounded-lg border border-border/40 bg-muted/40 p-2">
              <div className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-wider text-electric">
                <span className="h-1 w-1 rounded-full bg-electric" />
                Last raid
              </div>
              <div className="mt-0.5 font-mono text-[8px] leading-tight text-foreground">
                Pawan Sehrawat
              </div>
              <div className="font-mono text-[7.5px] leading-tight text-muted-foreground">
                3-pt Super Raid
              </div>
            </div>

            {/* Stat row */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { v: '12', l: 'Raids' },
                { v: '7', l: 'Tackles' },
                { v: '2', l: 'Allouts' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-md bg-muted/40 px-1 py-1 text-center"
                >
                  <div className="font-display tabular-stats text-base leading-none">
                    {s.v}
                  </div>
                  <div className="mt-0.5 font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom nav */}
            <div className="mt-auto flex items-center justify-around border-t border-border/30 pt-1.5">
              {NAV_ITEMS.map((label, i) => (
                <span
                  key={label}
                  className={`font-mono text-[8px] uppercase tracking-wider ${
                    i === 1 ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ScoreRow({ team }: { team: typeof HOME }) {
  return (
    <div
      style={team.vars}
      className="team-gradient flex items-center justify-between rounded-lg px-2.5 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-display text-[10px] uppercase tracking-wider opacity-90">
          {team.short}
        </span>
        <span className="font-mono text-[7.5px] uppercase opacity-70">{team.name}</span>
      </div>
      <span className="font-display tabular-stats text-2xl uppercase leading-none">
        {team.score}
      </span>
    </div>
  );
}
