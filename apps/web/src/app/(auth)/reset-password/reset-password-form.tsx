'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get('token_hash');
  const [pending, startTransition] = React.useTransition();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tokenHash) {
      toast.error('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      // Exchange the one-time recovery token for a session, then set the new password.
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,
      });
      if (verifyError) {
        toast.error('This reset link is invalid or has expired. Request a new one.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      // Sign out the recovery session so the user logs in fresh with the new password.
      await supabase.auth.signOut();
      toast.success('Password updated. Please sign in.');
      router.push('/login');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" variant="flame" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
      </Button>
    </form>
  );
}
