'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { submitFeedbackAction } from './actions';

type FeedbackType = 'working' | 'not_working' | 'idea';

const PLACEHOLDER: Record<FeedbackType, string> = {
  working: 'What feature is working well for you?',
  not_working: 'What broke? What page were you on? What did you expect?',
  idea: 'What would make this better?',
};

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<FeedbackType>('not_working');
  const [pending, startTransition] = React.useTransition();

  // Hide on admin pages — superadmins don't need to file feedback to themselves.
  if (pathname?.startsWith('/admin')) return null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('type', type);
    fd.set(
      'page_url',
      typeof window !== 'undefined' ? window.location.pathname : pathname ?? '',
    );
    startTransition(async () => {
      const res = await submitFeedbackAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.success) {
        toast.success(res.success);
        setOpen(false);
        setType('not_working');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report feedback or issue"
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/30 transition hover:scale-105 hover:shadow-xl"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback form"
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

            <h2 className="text-lg font-semibold tracking-tight">Tell us what you think</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Spot a bug? Got an idea? Tell us what's working too — we read every message.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <TypeButton
                active={type === 'working'}
                onClick={() => setType('working')}
                icon={<ThumbsUp className="h-4 w-4" />}
                label="Works"
              />
              <TypeButton
                active={type === 'not_working'}
                onClick={() => setType('not_working')}
                icon={<ThumbsDown className="h-4 w-4" />}
                label="Broken"
              />
              <TypeButton
                active={type === 'idea'}
                onClick={() => setType('idea')}
                icon={<Sparkles className="h-4 w-4" />}
                label="Idea"
              />
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message" className="text-xs">
                  Your message
                </Label>
                <Textarea
                  id="feedback-message"
                  name="message"
                  rows={4}
                  required
                  minLength={5}
                  maxLength={5000}
                  placeholder={PLACEHOLDER[type]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feedback-email" className="text-xs">
                  Email <span className="text-muted-foreground">(optional, for follow-up)</span>
                </Label>
                <Input
                  id="feedback-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send feedback'
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md border p-2 text-xs font-medium transition',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
