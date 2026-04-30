import { redirect } from 'next/navigation';
import {
  Activity,
  Building2,
  Crown,
  FileText,
  Flag,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import { DashboardSidebar, type NavItem } from '@/components/dashboard/sidebar';
import { DashboardTopbar } from '@/components/dashboard/topbar';
import { getSessionUser } from '@/lib/auth';

const ICON = 'h-4 w-4';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <LayoutDashboard className={ICON} /> },
  { href: '/admin/tenants', label: 'Tenants', icon: <Building2 className={ICON} /> },
  { href: '/admin/users', label: 'Users', icon: <Users className={ICON} /> },
  { href: '/admin/plans', label: 'Plans & billing', icon: <Crown className={ICON} /> },
  { href: '/admin/moderation', label: 'Moderation', icon: <Flag className={ICON} /> },
  { href: '/admin/audit', label: 'Audit log', icon: <FileText className={ICON} /> },
  { href: '/admin/health', label: 'System health', icon: <Activity className={ICON} /> },
  { href: '/admin/settings', label: 'Settings', icon: <Settings className={ICON} /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'superadmin') redirect('/feed');

  return (
    <div className="flex min-h-screen bg-secondary/10">
      <DashboardSidebar items={NAV} title="Superadmin" accent="gold" />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar user={user} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
