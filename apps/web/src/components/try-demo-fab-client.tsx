'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { tryDemoAction } from '@/app/(auth)/actions';
import { cn } from '@/lib/utils';

/**
 * Floating "Try live scoring" attention button. Appears in the bottom-left on
 * every marketing page (the FeedbackWidget owns the bottom-right). Hidden for
 * authenticated users by its server-component wrapper (TryDemoFab).
 *
 * Submits to tryDemoAction which provisions a fresh per-visitor demo tenant.
 */
export function TryDemoFabClient() {
  return (
    <form action={tryDemoAction} className="fixed bottom-5 left-5 z-40">
      <Button />
    </form>
  );
}

function Button() {
  const { pending } = useFormStatus();
  return (
    <div className="relative">
      {/* Pulse ring — visually nudges the eye without being annoying.
          Hidden while the action is running so it doesn't compete with the spinner. */}
      {!pending && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary opacity-50 motion-safe:animate-ping"
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'relative inline-flex h-14 items-center gap-2 rounded-full px-5 text-base font-semibold tracking-tight transition-all duration-200',
          'bg-gradient-to-r from-primary to-orange-600 text-primary-foreground',
          'shadow-2xl shadow-primary/40 ring-2 ring-primary/30',
          'hover:scale-[1.04] hover:shadow-primary/60 active:scale-[0.98]',
          'disabled:opacity-90 disabled:cursor-wait',
        )}
        aria-label="Try the live scoring demo"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Spinning up your demo…</span>
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            <span>Try live scoring</span>
          </>
        )}
      </button>
    </div>
  );
}
