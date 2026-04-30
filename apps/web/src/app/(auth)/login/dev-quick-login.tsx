'use client';

import * as React from 'react';
import { Crown, FlaskConical, Loader2, Trophy, User } from 'lucide-react';
import { toast } from 'sonner';
import { devSignInAction } from '../dev-actions';
import { DEV_ACCOUNTS, type DevRole } from '../dev-accounts.config';

const CARDS: {
  role: DevRole;
  icon: typeof User;
  title: string;
  blurb: string;
  tone: string;
}[] = [
  {
    role: 'fan',
    icon: User,
    title: 'Fan',
    blurb: 'Browse, follow teams',
    tone: 'border-sky-500/40 hover:border-sky-500/70 from-sky-500/10',
  },
  {
    role: 'organiser',
    icon: Trophy,
    title: 'Organiser',
    blurb: 'Run a tournament',
    tone: 'border-primary/40 hover:border-primary/70 from-primary/10',
  },
  {
    role: 'superadmin',
    icon: Crown,
    title: 'Superadmin',
    blurb: 'Platform-wide admin',
    tone: 'border-amber-500/40 hover:border-amber-500/70 from-amber-500/10',
  },
];

export function DevQuickLogin() {
  const [busy, setBusy] = React.useState<DevRole | null>(null);

  function onSelect(role: DevRole) {
    setBusy(role);
    // Server action will redirect on success — busy state will reset on nav.
    devSignInAction(role)
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          setBusy(null);
        }
      })
      .catch((err: unknown) => {
        // `redirect()` from a server action throws NEXT_REDIRECT to trigger
        // navigation. That's not a real failure — let the redirect happen.
        if (isRedirectError(err)) return;
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        toast.error(message);
        setBusy(null);
      });
  }

  function isRedirectError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { message?: unknown; digest?: unknown };
    return (
      e.message === 'NEXT_REDIRECT' ||
      (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT'))
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <FlaskConical className="h-3 w-3 text-amber-500" />
        Dev quick login
        <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-500">
          DEV ONLY
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CARDS.map((card) => {
          const acct = DEV_ACCOUNTS[card.role];
          const isBusy = busy === card.role;
          const anyBusy = busy !== null;
          return (
            <button
              key={card.role}
              type="button"
              onClick={() => onSelect(card.role)}
              disabled={anyBusy}
              className={`group relative flex flex-col items-start gap-1.5 overflow-hidden rounded-lg border bg-gradient-to-b to-transparent p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${card.tone}`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background shadow-sm">
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <card.icon className="h-4 w-4" />}
              </div>
              <div className="text-sm font-semibold">{card.title}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{card.blurb}</div>
            </button>
          );
        })}
      </div>

      <details className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Show credentials</summary>
        <div className="mt-2 space-y-1.5 font-mono text-[11px]">
          {(Object.keys(DEV_ACCOUNTS) as DevRole[]).map((r) => {
            const a = DEV_ACCOUNTS[r];
            return (
              <div key={r} className="flex items-center justify-between gap-2">
                <span className="capitalize text-muted-foreground">{r}</span>
                <span className="truncate text-foreground">{a.email}</span>
                <span className="rounded bg-background px-1.5 py-0.5 text-foreground">
                  {a.password}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Accounts are auto-created on first click. Disabled in production builds.
        </p>
      </details>
    </div>
  );
}
