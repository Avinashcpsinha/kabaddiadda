import { Bell, LogOut, Search } from 'lucide-react';
import { signOutAction } from '@/app/(auth)/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { initials } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';

export function DashboardTopbar({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search tournaments, teams, players…" className="pl-9" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-3 border-l border-border/50 pl-3">
            <Avatar>
              <AvatarFallback className="bg-primary/15 text-primary">
                {initials(user.fullName ?? user.email ?? 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium leading-tight">
                {user.fullName ?? user.email}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {user.role}
              </div>
            </div>
            <form action={signOutAction}>
              <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
