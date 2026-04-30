import { redirect } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Radio,
  Settings,
  Trophy,
  Users,
} from 'lucide-react';
import { DashboardSidebar, type NavItem } from '@/components/dashboard/sidebar';
import { DashboardTopbar } from '@/components/dashboard/topbar';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const ICON = 'h-4 w-4';

const NAV: NavItem[] = [
  { href: '/organiser', label: 'Overview', icon: <LayoutDashboard className={ICON} /> },
  { href: '/organiser/tournaments', label: 'Tournaments', icon: <Trophy className={ICON} /> },
  { href: '/organiser/teams', label: 'Teams', icon: <Users className={ICON} /> },
  { href: '/organiser/fixtures', label: 'Fixtures', icon: <Calendar className={ICON} /> },
  {
    href: '/organiser/scoring',
    label: 'Live scoring',
    icon: <Radio className={ICON} />,
    badge: 'LIVE',
  },
  { href: '/organiser/reports', label: 'Reports', icon: <BarChart3 className={ICON} /> },
  { href: '/organiser/billing', label: 'Billing', icon: <CreditCard className={ICON} /> },
  { href: '/organiser/settings', label: 'Settings', icon: <Settings className={ICON} /> },
];

export default async function OrganiserLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/organiser');
  if (user.role !== 'organiser' && user.role !== 'superadmin') redirect('/feed');
  if (!user.tenantId) redirect('/setup');

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug')
    .eq('id', user.tenantId)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-secondary/10">
      <DashboardSidebar items={NAV} title={tenant?.name ?? 'Organiser'} accent="flame" />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar user={user} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
