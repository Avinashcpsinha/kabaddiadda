'use client';

import * as React from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { tryDemoAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Floating "Try live scoring" attention button. Now opens a small modal
 * that captures the visitor's name (+ mobile/email) before spinning up the
 * demo, so instant-demo visitors are recorded in the superadmin "Demo
 * sessions" page. Hidden for authenticated users by its server wrapper.
 */
export function TryDemoFabClient() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string | null)?.trim() ?? '';
    const mobile = (fd.get('mobile') as string | null)?.trim() ?? '';
    const email = (fd.get('email') as string | null)?.trim() ?? '';
    if (name.length < 2) {
      toast.error('Please enter your name.');
      return;
    }
    if (!mobile && !email) {
      toast.error('Add a mobile number or email so we can reach you.');
      return;
    }
    fd.set('page_url', typeof window !== 'undefined' ? window.location.pathname : '');
    fd.set('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
    startTransition(async () => {
      // On success tryDemoAction redirects into the demo (navigation happens
      // and code after the await won't run). Only an auth error returns here.
      const res = await tryDemoAction(fd);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <>
      <div className="fixed bottom-5 left-5 z-40">
        <div className="relative">
          {!open && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary opacity-50 motion-safe:animate-ping"
            />
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              'relative inline-flex h-14 items-center gap-2 rounded-full px-5 text-base font-semibold tracking-tight transition-all duration-200',
              'bg-gradient-to-r from-primary to-orange-600 text-primary-foreground',
              'shadow-2xl shadow-primary/40 ring-2 ring-primary/30',
              'hover:scale-[1.04] hover:shadow-primary/60 active:scale-[0.98]',
            )}
            aria-label="Try the live scoring demo"
          >
            <Sparkles className="h-5 w-5" />
            <span>Try live scoring</span>
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Try live scoring"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-semibold tracking-tight">Try live scoring</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tell us who you are and we&apos;ll drop you into a sandboxed league with
              sample matches — score a live match yourself, no signup needed.
            </p>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="demo-name" className="text-xs">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input id="demo-name" name="name" required autoComplete="name" placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-mobile" className="text-xs">
                  Mobile / WhatsApp
                </Label>
                <Input
                  id="demo-mobile"
                  name="mobile"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="demo-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Add at least one of mobile or email.
              </p>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Spinning up your demo…
                  </>
                ) : (
                  'Start the demo →'
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
