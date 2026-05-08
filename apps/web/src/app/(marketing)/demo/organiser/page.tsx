import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileText,
  Flag,
  Layers,
  PlayCircle,
  Settings,
  Tv,
  Users,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Organiser walkthrough — from sign-up to live scoring',
  description:
    'Step-by-step guide to running a tournament on Kabaddiadda: create your league, add teams and players, generate fixtures, set lineups, and score live matches.',
};

interface DemoStep {
  number: number;
  title: string;
  route: string;
  routeLabel: string;
  estimate: string;
  intro: string;
  icon: React.ComponentType<{ className?: string }>;
  // Sub-sections inside the step. Each is a card with heading + bullets.
  sections: Array<{
    heading: string;
    bullets: string[];
  }>;
  result: string;
}

const STEPS: DemoStep[] = [
  {
    number: 1,
    title: 'Sign up & create your league',
    route: '/signup?role=organiser',
    routeLabel: '/signup',
    estimate: '~2 min',
    icon: Crown,
    intro:
      'Every organiser account belongs to a "league" (we call this a tenant). The league is the container for all your tournaments, teams, players, and branding. Sign up once — your league is created on the same screen.',
    sections: [
      {
        heading: 'What you fill in on the sign-up screen',
        bullets: [
          'Your full name and email — used for your operator account.',
          'Password (min 8 characters).',
          'League name — e.g. "Mumbai Friday Night Kabaddi" or "Bharat Open League". Shown on every public page.',
          'League slug — auto-derived from the name, used for the public URL (kabaddiadda.com/t/your-slug). Read-only after creation.',
        ],
      },
      {
        heading: 'After sign-up',
        bullets: [
          'You land on the organiser dashboard at /organiser.',
          'Sidebar shows the league name and links to Tournaments, Teams, Fixtures, Scoring, Reports, Settings, and Billing.',
          'You start on the Free plan automatically — no card needed. Upgrade later from Billing.',
        ],
      },
    ],
    result:
      'You have an organiser account, a league shell, and the public path /t/your-slug ready to receive content.',
  },
  {
    number: 2,
    title: 'Create your first tournament',
    route: '/organiser/tournaments/new',
    routeLabel: '/organiser/tournaments → New tournament',
    estimate: '~3 min',
    icon: Award,
    intro:
      'A tournament is the unit fans subscribe to. You can run multiple tournaments side by side (Free plan caps at 3; Pro is unlimited). Pick a format up front — the fixture generator and standings logic are tied to it.',
    sections: [
      {
        heading: 'Required fields',
        bullets: [
          'Name — e.g. "Pro Kabaddi Cup 2026".',
          'Slug — auto-suggested from the name; used in public URLs like /t/your-league/your-tournament. Must be unique within your league.',
          'Format — League (round-robin), Knockout (single-elim bracket), Group + KO (groups feed into a knockout), or Double-elimination.',
        ],
      },
      {
        heading: 'Optional fields',
        bullets: [
          'Description — one or two paragraphs that show up on the public tournament page.',
          'Start date and end date — set rough boundaries; matches can be scheduled within them.',
          'Max teams — caps registration. Leave blank for no cap.',
          'Entry fee and prize pool — display-only, used on the public page.',
        ],
      },
      {
        heading: 'After creation',
        bullets: [
          'Status defaults to "draft" — invisible on the public site until you change it to "registration" or "scheduled".',
          'You land on the tournament detail page at /organiser/tournaments/<id> with tabs for Overview, Teams, Fixtures, and Reports.',
        ],
      },
    ],
    result:
      'A tournament shell exists, ready to receive teams. Public page won’t show it until you flip status off "draft".',
  },
  {
    number: 3,
    title: 'Add teams to the tournament',
    route: '/organiser/tournaments/[id]/teams',
    routeLabel: 'Tournament → Teams tab',
    estimate: '~5 min for 8 teams',
    icon: Users,
    intro:
      'Teams are scoped to your league but assigned to a specific tournament. The Free plan caps your league at 30 teams total across all tournaments; Pro is unlimited.',
    sections: [
      {
        heading: 'For each team you add',
        bullets: [
          'Name — full name, e.g. "Maheshwari Super Kings".',
          'Short name — 3-letter code shown on the scoreboard and overlay (e.g. "MSK"). Auto-suggested but editable.',
          'City — optional, shown on the public team card.',
          'Primary color — hex code for the team accent (e.g. #c8102e). Drives the scoreboard tile and broadcast overlay colour for that team.',
        ],
      },
      {
        heading: 'Pro tip',
        bullets: [
          'Pick high-contrast primary colours per team — the scoreboard splits the screen by colour during raids, so distinct hues read well at a glance on TV streams.',
          'Avoid two teams in similar shades of the same colour family in the same tournament; the live overlay can get confusing for viewers.',
        ],
      },
    ],
    result:
      'Each team appears in the Teams tab with an empty roster, ready for players.',
  },
  {
    number: 4,
    title: 'Add players to each team',
    route: '/organiser/tournaments/[id]/teams/[teamId]',
    routeLabel: 'Team detail page',
    estimate: '~10 min per 12-player squad',
    icon: UserPlus,
    intro:
      'Players are the people on the mat. Each player belongs to one team but their stats follow them across tournaments. You can add as many as you want at every tier.',
    sections: [
      {
        heading: 'Per-player fields',
        bullets: [
          'Full name — e.g. "Pawan Sehrawat".',
          'Jersey number — 1-99, must be unique within the team.',
          'Role — Raider, Defender (corner), Defender (cover), or All-rounder. Used by the scoring console to suggest who is on the mat.',
          'Captain toggle — exactly one captain per team, optional.',
          'Optional: height, weight, date of birth, photo URL — populates stat cards on the public profile.',
        ],
      },
      {
        heading: 'Bulk vs one-by-one',
        bullets: [
          'Add players one at a time via the "Add player" button, or paste a CSV-style list (name, number, role) for fast bulk entry.',
          'You can edit any field later — number changes are reflected on every past event automatically.',
        ],
      },
    ],
    result:
      'Each team has a full 7+ on-mat squad plus bench/substitutes. The lineup builder for the first match is now usable.',
  },
  {
    number: 5,
    title: 'Generate fixtures',
    route: '/organiser/tournaments/[id]/fixtures',
    routeLabel: 'Tournament → Fixtures tab',
    estimate: '~2 min',
    icon: Calendar,
    intro:
      'Fixtures are the matches: who plays whom, when, in which round. You can let the platform generate them based on the tournament format, or hand-craft them.',
    sections: [
      {
        heading: 'Auto-generated fixtures',
        bullets: [
          'For League format — round-robin every team plays every other once. Click "Generate fixtures" and pick a start date and per-day cadence.',
          'For Knockout — single-elim bracket built from team count. Optional seeding via drag-and-drop before generation.',
          'For Group + KO — pick group sizes; group stage is round-robin, top N from each group advance to the bracket.',
        ],
      },
      {
        heading: 'Manual fixtures',
        bullets: [
          'Add a single match by selecting home team, away team, round number, and scheduled-at datetime.',
          'Useful for re-scheduled matches or makeup games after rain-out / venue issues.',
        ],
      },
      {
        heading: 'After generation',
        bullets: [
          'All matches show up in the Fixtures tab in chronological order.',
          'Each match starts as "scheduled" — fans see them on the public page.',
          'You can edit datetime, swap home/away, or delete individual matches before kick-off.',
        ],
      },
    ],
    result:
      'A complete schedule of matches, each with status="scheduled". Lineups are next.',
  },
  {
    number: 6,
    title: 'Set lineups before each match',
    route: '/organiser/tournaments/[id]/matches/[matchId]/lineups',
    routeLabel: 'Match → Lineups',
    estimate: '~3 min per match',
    icon: ClipboardList,
    intro:
      'Before kick-off, pick the 7 starters and the bench substitutes for each team. The scoring console only allows on-mat moves for players you mark as starters, so this gate must be locked before the match goes live.',
    sections: [
      {
        heading: 'On the lineup builder',
        bullets: [
          'Two columns — home team on the left, away team on the right.',
          'Tap a player to toggle them between Starting (on mat) and Bench.',
          'Exactly 7 starters per team are required. The "Lock & Start" button stays disabled until both teams hit 7.',
        ],
      },
      {
        heading: 'Locking',
        bullets: [
          'Click "Lock & Start". The match flips to status="live", lineups are frozen, and the scoring console opens.',
          'Substitutions during the match still happen — bench players come in via the Sub action in the scoring console — but the locked-at moment is the canonical pre-match record.',
        ],
      },
    ],
    result:
      'Match is locked, status="live", and you are dropped into the scoring console at /organiser/tournaments/<id>/matches/<matchId>/scoring.',
  },
  {
    number: 7,
    title: 'Score the match live',
    route: '/organiser/tournaments/[id]/matches/[matchId]/scoring',
    routeLabel: 'Scoring console',
    estimate: 'Match length (~40 min)',
    icon: PlayCircle,
    intro:
      'The scoring console is the operator’s home base for the duration of the match. It is built to be tap-driven and keyboard-friendly so you can keep up with the live action without taking your eyes off the mat.',
    sections: [
      {
        heading: 'Layout at a glance',
        bullets: [
          'Top bar — match clock, raid clock, half indicator, and the global play / pause / half-time / end controls.',
          'Centre — Raider picker (left), Defenders picker (right). Tap one raider, optionally tap defenders involved in a touch.',
          'Right rail — every action button: Touch, Bonus, Empty, Tackle, Raider out, Self-out, Defender self-out, Sub, Yellow / Red card, Review.',
          'Bottom — Event log showing each scoring event in chronological order with the operator-readable description.',
        ],
      },
      {
        heading: 'A typical raid',
        bullets: [
          'Pick the raider — global clock auto-starts and a 30s raid timer counts down.',
          'If the raider touches defenders, tap each touched defender, then commit Touch (+1) or T+B (touch plus bonus).',
          'If the defending team tackles, tap Tackle. The raider goes out and the defending team scores +1 (or +2 for super-tackle when 3 or fewer defenders are on the mat).',
          'If neither — tap Empty (raider returned without scoring) or wait for the 30s to expire and commit then.',
          'Complete Raid ends the raid cleanly between actions; the next team gets the mat.',
        ],
      },
      {
        heading: 'Special situations the console handles',
        bullets: [
          'Super raids (3+ points in one raid) — auto-detected, fires a super_raid event for stats.',
          'All-out — when a team has 0 on the mat, the platform auto-emits all_out (+2 for the attacking team) and revives the OUT players.',
          'Do-or-die raids — flagged automatically when a team has 2 empty raids in a row; the next raid must score.',
          'Cards — Yellow (2-min suspension), Red (player removed for the rest of the match).',
          'Substitutions — open Sub, pick the player coming in and the player going off. Bench depth tracked.',
          'Reviews — reviewer call upheld or overturned; the call is logged and points reverted if needed.',
          'Out-of-bounds — Raider out of bounds (defender +1 with the boundary defender credited), Defender out of bounds (raider +1).',
          'Revival queue swap — if a multi-defender touch logged the OUT order incorrectly, toggle "Swap order" in the defenders panel and tap two OUT defenders to reorder the revival queue.',
        ],
      },
      {
        heading: 'What viewers see',
        bullets: [
          'Public live page at /live/<matchId> — fans open the link, see the score updating in real time via Supabase realtime.',
          'Broadcast overlay at /overlay/match/<matchId> — feed it into OBS as a browser source for live streams.',
          'Both pages mirror the operator console within ~1 second.',
        ],
      },
    ],
    result:
      'Match completes, status flips to "completed", and the score is locked. All events are persisted for stats and reports.',
  },
  {
    number: 8,
    title: 'After the match — reports & sharing',
    route: '/organiser/reports',
    routeLabel: 'Reports tab',
    estimate: '~5 min per tournament',
    icon: FileText,
    intro:
      'When the match ends, the platform automatically computes per-match and per-tournament reports. You can review them, share them on social, or (on Pro) export everything as CSV.',
    sections: [
      {
        heading: 'Per-match report',
        bullets: [
          'Score progression chart — points over the match clock, split by team.',
          'Raid logs — every raid with raider, defenders touched, points scored, and outcome.',
          'Top performers — most raid points, most tackle points, super raids, super tackles.',
        ],
      },
      {
        heading: 'Per-tournament report',
        bullets: [
          'Standings — wins, losses, score difference, do-or-die rate.',
          'Raider leaderboard — total raid points across the tournament, super raids, raid success %.',
          'Defender leaderboard — total tackle points, super tackles, tackle success %.',
        ],
      },
      {
        heading: 'Sharing',
        bullets: [
          'Every public-facing URL (/t/<league>, /t/<league>/<tournament>, /live/<matchId>) is sharable on WhatsApp, Twitter, and Instagram.',
          'Pro plan unlocks CSV exports — useful for federation reporting or your own spreadsheet workflows.',
        ],
      },
    ],
    result:
      'You have an end-to-end record of the match, ready to share with fans, sponsors, and the federation.',
  },
];

const TIPS = [
  {
    icon: Settings,
    title: 'Configure branding before going live',
    body: 'Upload your league logo and pick a primary colour in /organiser/settings before fans share your public link — first impressions are sticky. (Pro feature.)',
  },
  {
    icon: Layers,
    title: 'Open the scoring console on a second screen',
    body: 'Most operators run the scoring console on a tablet or laptop next to the mat, with the public live page on a separate screen for the venue audience.',
  },
  {
    icon: Tv,
    title: 'Hook the broadcast overlay into OBS',
    body: 'Add the /overlay/match/<id> URL as a browser source in OBS. The overlay is transparent; place it as a lower-third on your stream layout.',
  },
  {
    icon: Zap,
    title: 'Use keyboard shortcuts during scoring',
    body: 'The scoring console is mouse-friendly, but most actions also have keyboard shortcuts (T for touch, B for bonus, etc.) — much faster once you build muscle memory.',
  },
];

export default function OrganiserDemoPage() {
  return (
    <div className="space-y-20 py-16 md:py-24">
      {/* HERO ------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Organiser walkthrough
          </Badge>
          <h1 className="text-balance font-display text-5xl uppercase leading-none tracking-tight md:text-7xl">
            From sign-up to <span className="text-primary">live scoring</span>
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            The complete journey for a kabaddi tournament organiser — every step,
            every screen, every gotcha. Plan on ~30 minutes start to finish to set up
            a fresh tournament before the first whistle.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="flame" size="lg">
              <Link href="/signup?role=organiser">
                Start now — it is free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#step-1">Read the walkthrough</a>
            </Button>
          </div>
        </div>
      </section>

      {/* QUICK OVERVIEW --------------------------------------------- */}
      <section className="container mx-auto px-4">
        <h2 className="mb-3 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          The journey at a glance
        </h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">
          Eight steps. The first six set up your tournament; step seven is matchday;
          step eight is what you do after the whistle.
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.number}
                href={`#step-${s.number}`}
                className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Step {s.number}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold group-hover:text-primary transition-colors">
                    {s.title}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {s.estimate}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* STEPS ------------------------------------------------------ */}
      <div className="space-y-16">
        {STEPS.map((s) => (
          <StepBlock key={s.number} step={s} />
        ))}
      </div>

      {/* TIPS ------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <h2 className="mb-10 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          Operator tips
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {TIPS.map((tip) => {
            const Icon = tip.icon;
            return (
              <Card key={tip.title} className="border-border/60">
                <CardContent className="flex gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{tip.title}</h3>
                    <p className="text-sm text-muted-foreground">{tip.body}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CLOSING CTA ----------------------------------------------- */}
      <section className="container mx-auto px-4">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Activity className="h-10 w-10 text-primary" />
            <h2 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
              Ready to run a real tournament?
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Sign up free, finish steps 1–6 in under an hour, and you are ready
              for kick-off. Free plan supports a full 3-tournament season end-to-end.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="flame" size="lg">
                <Link href="/signup?role=organiser">
                  Sign up as organiser
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StepBlock({ step }: { step: DemoStep }) {
  const Icon = step.icon;
  return (
    <section id={`step-${step.number}`} className="container mx-auto px-4 scroll-mt-20">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* LEFT — step number + meta */}
        <div className="lg:col-span-3">
          <div className="sticky top-24">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Step {step.number}
                </div>
                <div className="text-xs text-muted-foreground">{step.estimate}</div>
              </div>
            </div>
            <h3 className="mt-4 font-display text-2xl uppercase tracking-tight md:text-3xl">
              {step.title}
            </h3>
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-[11px]">
              <Flag className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{step.routeLabel}</span>
            </div>
          </div>
        </div>

        {/* RIGHT — content */}
        <div className="space-y-5 lg:col-span-9">
          <p className="text-base leading-relaxed text-muted-foreground">{step.intro}</p>

          {step.sections.map((section) => (
            <Card key={section.heading} className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.heading}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <span className="font-semibold text-foreground">After this step:</span>{' '}
              <span className="text-muted-foreground">{step.result}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
