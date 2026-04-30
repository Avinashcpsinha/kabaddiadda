'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

export interface NavItem {
  href: string;
  label: string;
  /** Pre-rendered JSX (e.g. `<Trophy className="h-4 w-4" />`) — passing
   * the raw component function would fail the server→client boundary. */
  icon: React.ReactNode;
  badge?: string;
}

export function DashboardSidebar({
  items,
  title,
  accent,
}: {
  items: NavItem[];
  title: string;
  accent?: 'flame' | 'gold' | 'sky';
}) {
  const pathname = usePathname();
  const accentClass =
    accent === 'gold'
      ? 'from-amber-500 to-amber-600'
      : accent === 'sky'
        ? 'from-sky-500 to-blue-600'
        : 'from-primary to-orange-600';

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/50 bg-background/40 lg:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-border/50 px-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pt-6">
          <div
            className={cn(
              'mb-3 inline-flex max-w-full items-center gap-2 truncate rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-white shadow-sm',
              accentClass,
            )}
          >
            {title}
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-6">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
