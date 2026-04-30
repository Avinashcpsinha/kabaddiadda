import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/setup');
  if (user.role !== 'organiser' && user.role !== 'superadmin') redirect('/feed');
  if (user.tenantId) redirect('/organiser');
  return <>{children}</>;
}
