'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Trophy, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { signUpAction } from '../actions';

type Role = 'user' | 'organiser';

export default function SignupPage() {
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [role, setRole] = React.useState<Role>(
    (params.get('role') as Role) === 'organiser' ? 'organiser' : 'user',
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('role', role);
    startTransition(async () => {
      const res = await signUpAction(fd);
      if (res?.error) toast.error(res.error);
      else if (res?.success) toast.success(res.success);
    });
  }

  return (
    <Card className="border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Join Kabaddiadda</CardTitle>
        <CardDescription>Pick how you want to start</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <RoleCard
            active={role === 'user'}
            icon={<User className="h-5 w-5" />}
            title="Fan / Player"
            description="Follow teams, watch live"
            onClick={() => setRole('user')}
          />
          <RoleCard
            active={role === 'organiser'}
            icon={<Trophy className="h-5 w-5" />}
            title="Organiser"
            description="Run tournaments"
            onClick={() => setRole('organiser')}
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required autoComplete="name" />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <Button type="submit" variant="flame" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function RoleCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all',
        active
          ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
          : 'border-border hover:border-border/80 hover:bg-accent/30',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
