'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TAGLINE_LINES = [
  'Run tournaments.',
  'Score live matches.',
  'Follow your team.',
  'One platform for organisers, players, and fans.',
];

const HOLD_MS = 2400;

export function AnimatedTagline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TAGLINE_LINES.length);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-6 flex items-start gap-3 sm:gap-4 md:mt-8">
      <span
        aria-hidden
        className="glow-flame mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary sm:mt-3 sm:h-3 sm:w-3 md:mt-5"
      />
      <div className="relative h-14 max-w-2xl flex-1 overflow-hidden sm:h-20 md:h-24 lg:h-28">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="font-editorial absolute inset-0 flex items-center text-balance text-lg font-medium italic leading-tight text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-2xl md:text-3xl lg:text-4xl"
          >
            {TAGLINE_LINES[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
