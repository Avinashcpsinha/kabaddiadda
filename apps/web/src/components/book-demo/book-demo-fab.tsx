'use client';

import * as React from 'react';
import { CalendarCheck, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitDemoRequestAction } from './actions';

export function BookDemoFab() {
  const [open, setOpen] = React.useState(false);
  const [submittedName, setSubmittedName] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  function handleClose() {
    setOpen(false);
    // Reset the thank-you state after the close animation so the next open
    // shows the form, not the confirmation.
    setTimeout(() => setSubmittedName(null), 150);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string | null)?.trim() || 'there';
    fd.set('page_url', typeof window !== 'undefined' ? window.location.pathname : '');
    startTransition(async () => {
      const res = await submitDemoRequestAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.success) {
        setSubmittedName(name);
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <div className="fixed bottom-5 left-[15.5rem] z-40 hidden sm:block">
        <DemoButton onClick={() => setOpen(true)} />
      </div>
      {/* Mobile: stack above the Try-Demo FAB so neither gets clipped. */}
      <div className="fixed bottom-[5.5rem] left-5 z-40 sm:hidden">
        <DemoButton onClick={() => setOpen(true)} compact />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!pending) handleClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={submittedName ? 'Demo request received' : 'Book a demo'}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {submittedName ? (
              <ThankYou name={submittedName} onClose={handleClose} />
            ) : (
              <>
            <h2 className="text-lg font-semibold tracking-tight">Book a demo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tell us about your league or tournament — we'll walk you through Kabaddiadda
              one-on-one and answer your questions.
            </p>

            <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-3">
              <Field id="demo-name" name="name" label="Name" required autoComplete="name" />
              <Field
                id="demo-mobile"
                name="mobile"
                label="Mobile / WhatsApp"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
              />
              <Field
                id="demo-email"
                name="email"
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              <Field
                id="demo-org"
                name="organisation"
                label="Organisation"
                required
                autoComplete="organization"
                placeholder="League / club / federation"
              />
              <Field
                id="demo-social"
                name="social_link"
                label={
                  <>
                    Social media link{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </>
                }
                type="url"
                placeholder="https://instagram.com/your-handle"
              />

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Request demo'
                )}
              </Button>
            </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ThankYou({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/20">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        Thanks, {name}! You're booked.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We've got your request and will reach out within one business day on your
        WhatsApp or email to set up a personalised walk-through.
      </p>
      <div className="mt-5 rounded-lg border border-border/70 bg-muted/30 p-3 text-left text-xs text-muted-foreground">
        <span className="font-medium text-foreground">While you wait — </span>
        try the live scoring console yourself with the{' '}
        <span className="font-medium text-primary">Try live scoring</span> button.
        No signup needed, you get a sandboxed league seeded with sample matches.
      </div>
      <Button className="mt-5 w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function DemoButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      {/* Pulse ring — visually nudges the eye. Matches the TryDemo FAB pattern. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-violet-500 opacity-60 motion-safe:animate-ping"
      />
      <button
        type="button"
        onClick={onClick}
        aria-label="Book a demo"
        className="relative inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-5 text-base font-bold tracking-tight text-white shadow-2xl shadow-fuchsia-500/50 ring-2 ring-white/20 transition-all duration-200 hover:scale-[1.05] hover:shadow-fuchsia-500/70 active:scale-[0.98]"
      >
        <CalendarCheck className="h-5 w-5" />
        <span>{compact ? 'Book demo' : 'Book a Demo'}</span>
      </button>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  inputMode,
}: {
  id: string;
  name: string;
  label: React.ReactNode;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
    </div>
  );
}
