import { Activity, Building2, ExternalLink, Trophy, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { SignupsChart, type SignupBucket } from './signups-chart';

export const metadata = { title: 'Traffic & registrations' };

// Rolling windows in ms — avoid timezone gymnastics on "today" boundaries.
const DAY_MS = 24 * 60 * 60 * 1000;

interface RecentSignup {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'organiser' | 'superadmin';
  created_at: string;
  tenant: { slug: string; name: string } | null;
}

export default async function AdminTrafficPage() {
  // Service-role client — bypasses RLS. Safe here because admin/layout.tsx
  // already gates this route to superadmin only.
  const supabase = createAdminClient();

  const now = Date.now();
  const since24h = new Date(now - DAY_MS).toISOString();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();

  const [
    totalUsers,
    last24h,
    last7d,
    last30d,
    totalTenants,
    totalTournaments,
    recent,
    last30dRows,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since24h),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since7d),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30d),
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, tenant:tenant_id(slug, name)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', since30d)
      .order('created_at', { ascending: true }),
  ]);

  const recentSignups = (recent.data ?? []) as unknown as RecentSignup[];
  const buckets = bucketByDay(
    (last30dRows.data ?? []).map((r) => r.created_at as string),
    30,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traffic & registrations</h1>
          <p className="mt-1 text-muted-foreground">
            Who's joining the platform. Anonymous visitor traffic lives in Vercel Analytics.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2"
          >
            Open Vercel Analytics
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={totalUsers.count ?? 0} icon={Users} />
        <StatCard
          label="Last 24 hours"
          value={last24h.count ?? 0}
          icon={UserPlus}
          delta={`${last7d.count ?? 0} in 7d · ${last30d.count ?? 0} in 30d`}
        />
        <StatCard label="Total tenants" value={totalTenants.count ?? 0} icon={Building2} />
        <StatCard
          label="Total tournaments"
          value={totalTournaments.count ?? 0}
          icon={Trophy}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Signups · last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(last30d.count ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No signups in the last 30 days yet.
            </p>
          ) : (
            <SignupsChart data={buckets} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest registrations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentSignups.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No registrations yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Tenant</th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSignups.map((u) => (
                    <tr key={u.id} className="border-b border-border/30 last:border-0">
                      <td className="px-6 py-3 font-medium">
                        {u.full_name?.trim() || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-3">
                        <Badge variant={badgeVariantForRole(u.role)}>{u.role}</Badge>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {u.tenant?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function bucketByDay(timestamps: string[], days: number): SignupBucket[] {
  const buckets = new Map<string, number>();
  // Seed every day in the window with 0 so the chart shows a continuous axis
  // even when most days have no signups.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

function badgeVariantForRole(role: RecentSignup['role']): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'superadmin':
      return 'default';
    case 'organiser':
      return 'outline';
    default:
      return 'secondary';
  }
}
