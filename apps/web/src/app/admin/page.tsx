import Link from 'next/link';
import { Activity, ArrowRight, Building2, Crown, Trophy, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';

interface RecentTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string | null;
  created_at: string;
}

interface RecentUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'organiser' | 'superadmin';
  created_at: string;
  tenant: { name: string; slug: string } | null;
}

export default async function AdminHome() {
  // Service-role client — admin/layout.tsx already gates this to superadmin.
  const supabase = createAdminClient();

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    totalTenants,
    activeTenants,
    totalTournaments,
    liveMatches,
    newUsers30d,
    recentTenantsRes,
    recentUsersRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30d),
    supabase
      .from('tenants')
      .select('id, slug, name, status, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, tenant:tenant_id(name, slug)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const recentTenants = (recentTenantsRes.data ?? []) as RecentTenant[];
  const recentUsers = (recentUsersRes.data ?? []) as unknown as RecentUser[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-muted-foreground">
          Live snapshot of every league and user on Kabaddiadda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active tenants"
          value={activeTenants.count ?? 0}
          icon={Building2}
          delta={`${totalTenants.count ?? 0} total`}
        />
        <StatCard
          label="Total users"
          value={totalUsers.count ?? 0}
          icon={Users}
          delta={`${newUsers30d.count ?? 0} new in 30d`}
          tone={(newUsers30d.count ?? 0) > 0 ? 'positive' : 'default'}
        />
        <StatCard
          label="Live matches"
          value={liveMatches.count ?? 0}
          icon={Activity}
        />
        <StatCard
          label="Total tournaments"
          value={totalTournaments.count ?? 0}
          icon={Trophy}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent tenant signups</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/tenants" className="gap-1">
                See all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTenants.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tenants yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentTenants.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-500/20 to-amber-500/0 text-amber-500 ring-1 ring-amber-500/20">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.slug} ·{' '}
                          {new Date(t.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.plan && <Badge variant="outline">{t.plan}</Badge>}
                      <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent user signups</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/users" className="gap-1">
                See all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/0 text-primary ring-1 ring-primary/20">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {u.full_name?.trim() || u.email}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.tenant && (
                            <>
                              {' · '}
                              {u.tenant.name}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {u.role === 'superadmin' && (
                        <Badge variant="default" className="gap-1">
                          <Crown className="h-3 w-3" />
                          {u.role}
                        </Badge>
                      )}
                      {u.role === 'organiser' && <Badge variant="outline">{u.role}</Badge>}
                      {u.role === 'user' && <Badge variant="secondary">{u.role}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
