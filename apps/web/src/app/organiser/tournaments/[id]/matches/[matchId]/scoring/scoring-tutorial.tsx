'use client';

import * as React from 'react';
import { driver, type DriveStep } from 'driver.js';
import { HelpCircle, X } from 'lucide-react';
import 'driver.js/dist/driver.css';

/**
 * Step-by-step walkthrough of the live scoring console.
 *
 * Auto-starts the first time a demo visitor lands on the page (the parent
 * server component passes `autoStart={true}` only for demo sessions). For
 * real organisers a small "Tour" pill in the bottom-right offers the same
 * tour on demand. Both paths run the exact same step list.
 *
 * Targets are wired via `data-tour="<key>"` attributes on the scoring
 * console JSX — see scoring-console.tsx for the anchor points.
 */

const STORAGE_KEY = 'kbd.scoring.tutorial.seen.v1';

const STEPS: DriveStep[] = [
  {
    popover: {
      title: '👋 Welcome to live scoring',
      description:
        '30-second walkthrough of the console. You can stop anytime by pressing Esc or clicking outside.',
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '[data-tour="score-header"]',
    popover: {
      title: '1. Score & clock',
      description:
        'Team scores live up top. The half clock counts down between Q1 and Q2. The raid clock (30s) shows time left for the current raid.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="match-controls"]',
    popover: {
      title: '2. Match controls',
      description:
        '<strong>Pause</strong> halts both clocks. <strong>Half time</strong> ends the current half and lets you swap ends. <strong>End</strong> finalises the match.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="team-toggle"]',
    popover: {
      title: '3. Pick the raiding team',
      description:
        'Tap whichever team is on the attack this turn. The raider and defender lists below update to match.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="player-picker"]',
    popover: {
      title: '4. Tap players for this raid',
      description:
        'First tap one raider from the attacking team. Then tap any defenders the raider touches during the raid.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="action-grid"]',
    popover: {
      title: '5. Record the action',
      description:
        '<strong>Touch</strong> +1 per defender. <strong>Bonus</strong> when raider crosses the bonus line. <strong>Super</strong> for 3+ touches. <strong>Tackle</strong> +1 for the defending side. The score updates instantly.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="event-log"]',
    popover: {
      title: '6. Every action lands here',
      description:
        'The event log shows raid-by-raid history. Tap any event to undo it — the score and player state adjust automatically.',
      side: 'top',
      align: 'center',
    },
  },
  {
    popover: {
      title: '✅ You\'re ready',
      description:
        'Tap a player and try scoring your first raid. This is a private demo — nothing you do here is visible to anyone else, and the league resets every 24 hours.',
      side: 'over',
      align: 'center',
    },
  },
];

function buildDriver() {
  return driver({
    showProgress: true,
    progressText: 'Step {{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Got it',
    overlayOpacity: 0.7,
    allowKeyboardControl: true,
    smoothScroll: true,
    steps: STEPS,
  });
}

export function ScoringTutorial({ autoStart }: { autoStart: boolean }) {
  const startedRef = React.useRef(false);
  const [show, setShow] = React.useState(false);

  // Defer mounting the trigger button until after hydration so the help pill
  // doesn't briefly render server-side. Auto-start fires once per visitor —
  // localStorage flag prevents re-running on every navigation.
  React.useEffect(() => {
    setShow(true);
    if (!autoStart || startedRef.current) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return;

    // Give the layout a tick to settle before driver measures positions.
    const handle = window.setTimeout(() => {
      startedRef.current = true;
      window.localStorage.setItem(STORAGE_KEY, '1');
      buildDriver().drive();
    }, 600);
    return () => window.clearTimeout(handle);
  }, [autoStart]);

  function runManually() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    buildDriver().drive();
  }

  function dismissPrompt() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={runManually}
      onAuxClick={dismissPrompt}
      aria-label="Show scoring tutorial"
      className="fixed bottom-5 right-24 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition hover:scale-105 hover:bg-accent"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Show tour</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          dismissPrompt();
        }}
        className="-mr-1 ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label="Hide tour button"
        role="button"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}
