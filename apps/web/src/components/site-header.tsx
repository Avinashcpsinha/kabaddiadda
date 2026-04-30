import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { Role } from '@kabaddiadda/shared';
import { signOutAction } from '@/app/(auth)/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';
import { getSessionUser, dashboardPathForRole } from '@/lib/auth';
import { initials } from '@/lib/utils';

const ROLE_LABEL: Record<Role, string> = {
  user: 'Fan',
  organiser: 'Organiser',
  superadmin: 'Admin',
};

export async function SiteHeader() {
  const user = await getSessionUser();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/tournaments" className="hover:text-foreground transition-colors">
              Tournaments
            </Link>
            <Link href="/teams" className="hover:text-foreground transition-colors">
              Teams
            </Link>
            <Link href="/players" className="hover:text-foreground transition-colors">
              Players
            </Link>
            <Link href="/rankings" className="hover:text-foreground transition-colors">
              Rankings
            </Link>
            <Link href="/live" className="hover:text-foreground transition-colors">
              Live
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2 border-l border-border/50 pl-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                  {initials(user.fullName ?? user.email ?? 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-sm leading-tight sm:block">
                <span className="font-medium">Welcome {firstName}</span>{' '}
                <span className="text-muted-foreground">({ROLE_LABEL[user.role]})</span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={dashboardPathForRole(user.role)}>Dashboard</Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="flame" size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
