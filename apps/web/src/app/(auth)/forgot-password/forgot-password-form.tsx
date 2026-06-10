'use client';

import * as React from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordAction } from '../actions';

export function ForgotPasswordForm() {
  const [pending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await forgotPasswordAction(fd);
      if (res?.error) toast.error(res.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground">
          If an account exists for that address, a password reset link is on its way. Check your
          inbox (and spam folder).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" variant="flame" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
      </Button>
    </form>
  );
}
