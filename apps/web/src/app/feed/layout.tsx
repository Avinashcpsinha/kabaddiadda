import { redirect } from 'next/navigation';
import { Compass, Heart, Home, PlayCircle, Trophy, Users } from 'lucide-react';
import { DashboardSidebar, type NavItem } from '@/components/dashboard/sidebar';
import { DashboardTopbar } from '@/components/dashboard/topbar';
import { getSessionUser } from '@/lib/auth';

const ICON = 'h-4 w-4';

const NAV: NavItem[] = [
  { href: '/feed', label: 'Home', icon: <Home className={ICON} /> },
  { href: '/feed/live', label: 'Live', icon: <PlayCircle className={ICON} />, badge: '3' },
  { href: '/feed/tournaments', label: 'Tournaments', icon: <Trophy className={ICON} /> },
  { href: '/feed/teams', label: 'Teams', icon: <Users className={ICON} /> },
  { href: '/feed/discover', label: 'Discover', icon: <Compass className={ICON} /> },
  { href: '/feed/following', label: 'Following', icon: <Heart className={ICON} /> },
];

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/feed');

  return (
    <div className="flex min-h-screen bg-secondary/10">
      <DashboardSidebar items={NAV} title="Fan zone" accent="sky" />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar user={user} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
