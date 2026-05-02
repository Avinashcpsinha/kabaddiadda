import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'Phase 1 foundation — typography, color tokens, decorative utilities.',
};

const colorSwatches = [
  { name: 'primary (Kabaddi Flame)', cls: 'bg-primary text-primary-foreground' },
  { name: 'electric', cls: 'bg-electric text-electric-foreground' },
  { name: 'victory', cls: 'bg-victory text-victory-foreground' },
  { name: 'defeat', cls: 'bg-defeat text-defeat-foreground' },
  { name: 'gold', cls: 'bg-gold text-gold-foreground' },
  { name: 'live', cls: 'bg-live text-live-foreground' },
  { name: 'mat', cls: 'bg-mat text-mat-line' },
  { name: 'card', cls: 'bg-card text-card-foreground border border-border' },
  { name: 'muted', cls: 'bg-muted text-muted-foreground' },
];

const teamColors: Array<{ name: string; vars: CSSProperties }> = [
  {
    name: 'Bengaluru Bulls',
    vars: { '--team-primary': '0 80% 50%', '--team-foreground': '0 0% 100%' } as CSSProperties,
  },
  {
    name: 'Patna Pirates',
    vars: { '--team-primary': '210 90% 45%', '--team-foreground': '0 0% 100%' } as CSSProperties,
  },
  {
    name: 'Tamil Thalaivas',
    vars: { '--team-primary': '142 70% 38%', '--team-foreground': '0 0% 100%' } as CSSProperties,
  },
  {
    name: 'Jaipur Pink Panthers',
    vars: { '--team-primary': '330 75% 55%', '--team-foreground': '0 0% 100%' } as CSSProperties,
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-12">
      <h2 className="font-display text-3xl uppercase tracking-wider text-muted-foreground mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero */}
        <header className="mb-8">
          <p className="font-mono tabular-stats text-xs uppercase tracking-[0.2em] text-electric">
            Phase 01 / Foundation
          </p>
          <h1 className="font-display text-7xl md:text-8xl uppercase tracking-tight leading-none mt-3">
            Design <span className="gradient-text">System</span>
          </h1>
          <p className="font-editorial text-lg md:text-xl text-muted-foreground italic mt-4 max-w-2xl">
            Typography, semantic color tokens, and decorative utilities. Every later phase composes
            these primitives — verify each block looks right before we ship Phase 2.
          </p>
        </header>

        {/* Typography */}
        <Section title="01 · Typography">
          <div className="space-y-8">
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
                font-display (Anton) — headlines, scoreboards, jerseys
              </p>
              <p className="font-display text-6xl md:text-7xl uppercase tracking-tight leading-none">
                Bengaluru 38 — 32 Patna
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
                font-editorial (Fraunces) — long-form, match reports, player bios
              </p>
              <p className="font-editorial text-2xl italic max-w-3xl">
                In the dying seconds of the second half, Pardeep tilted his shoulder, slipped the
                chain, and stole the match.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
                font-sans (Inter) — body, UI, default
              </p>
              <p className="text-base max-w-3xl">
                The quick brown raider jumps over the lazy defender. Body copy stays workmanlike so
                the display moments can shout.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
                font-mono + .tabular-stats — telemetry, scoreboards, timestamps
              </p>
              <p className="font-mono tabular-stats text-2xl">
                03:41:22 · RAID 24/30 · WIN% 67.5
              </p>
            </div>
          </div>
        </Section>

        {/* Colors */}
        <Section title="02 · Semantic Colors">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {colorSwatches.map((s) => (
              <div
                key={s.name}
                className={`${s.cls} rounded-lg p-5 h-24 flex items-end font-mono text-xs`}
              >
                {s.name}
              </div>
            ))}
          </div>
        </Section>

        {/* Team-color slots */}
        <Section title="03 · Team-Color Slots">
          <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
            Each card sets <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            --team-primary</code> inline — the same component renders in every team's identity.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {teamColors.map((t) => (
              <div
                key={t.name}
                style={t.vars}
                className="team-gradient rounded-xl p-6 h-40 flex flex-col justify-between shadow-lg"
              >
                <span className="font-mono text-xs uppercase opacity-80">Team</span>
                <div>
                  <p className="font-display text-2xl uppercase leading-tight">{t.name}</p>
                  <p className="font-mono tabular-stats text-xs opacity-80 mt-1">
                    W 8 · L 2 · PTS 24
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Glows */}
        <Section title="04 · Halo Glows">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'glow-flame', cls: 'glow-flame bg-primary' },
              { name: 'glow-electric', cls: 'glow-electric bg-electric' },
              { name: 'glow-gold', cls: 'glow-gold bg-gold' },
              { name: 'glow-live', cls: 'glow-live bg-live pulse-live' },
            ].map((g) => (
              <div key={g.name} className="flex flex-col items-center gap-3">
                <div className={`${g.cls} h-24 w-24 rounded-full`} />
                <span className="font-mono text-xs text-muted-foreground">{g.name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Text stroke */}
        <Section title="05 · Outlined Display Text">
          <div className="space-y-2">
            <p className="font-display text-7xl uppercase text-stroke">RAID</p>
            <p className="font-display text-7xl uppercase text-stroke-flame">TACKLE</p>
            <p className="font-display text-7xl uppercase text-stroke-thick">SUPER</p>
          </div>
        </Section>

        {/* Decorative backgrounds */}
        <Section title="06 · Decorative Backgrounds">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-mat-lines rounded-xl h-48 flex items-end p-4">
              <span className="font-mono text-xs bg-background/80 px-2 py-1 rounded">
                .bg-mat-lines
              </span>
            </div>
            <div className="bg-diagonal-slash rounded-xl h-48 flex items-end p-4">
              <span className="font-mono text-xs bg-background/80 px-2 py-1 rounded">
                .bg-diagonal-slash
              </span>
            </div>
            <div className="bg-stadium-grid bg-card rounded-xl h-48 flex items-end p-4">
              <span className="font-mono text-xs bg-background/80 px-2 py-1 rounded">
                .bg-stadium-grid (drifts slowly)
              </span>
            </div>
            <div className="bg-noise bg-muted rounded-xl h-48 flex items-end p-4">
              <span className="font-mono text-xs bg-background/80 px-2 py-1 rounded">
                .bg-noise
              </span>
            </div>
          </div>
        </Section>

        {/* Live pill */}
        <Section title="07 · Live Indicator">
          <div className="flex flex-wrap items-center gap-4">
            <span className="pulse-live inline-flex items-center gap-2 bg-live text-live-foreground rounded-full px-4 py-1.5 font-display uppercase tracking-wider text-sm">
              <span className="h-2 w-2 rounded-full bg-live-foreground" />
              Live · Q2 14:32
            </span>
            <span className="inline-flex items-center gap-2 bg-electric text-electric-foreground rounded-full px-4 py-1.5 font-display uppercase tracking-wider text-sm">
              Upcoming · 7:30 PM
            </span>
            <span className="inline-flex items-center gap-2 bg-gold text-gold-foreground rounded-full px-4 py-1.5 font-display uppercase tracking-wider text-sm">
              Final · Won
            </span>
            <span className="inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full px-4 py-1.5 font-display uppercase tracking-wider text-sm">
              Finished
            </span>
          </div>
        </Section>

        <footer className="border-t border-border mt-12 pt-8 text-sm text-muted-foreground">
          <p>
            <span className="font-mono uppercase tracking-wider text-xs text-electric">
              Phase 1 complete →
            </span>{' '}
            verify each block above. Phase 2 will rebuild the home hero + match cards using these
            primitives.
          </p>
        </footer>
      </div>
    </div>
  );
}
