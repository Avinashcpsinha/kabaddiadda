import Link from 'next/link';
import { Crown, Trophy, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Users' };

type Role = 'user' | 'organiser' | 'superadmin';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  tenant: { name: string; slug: string } | null;
}

interface SearchParams {
  role?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const roleFilter = parseRoleFilter(sp.role);

  // Service-role client — admin/layout.tsx already gates this to superadmin.
  const supabase = createAdminClient();

  const [
    total,
    fans,
    organisers,
    superadmins,
    rowsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'organiser'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'superadmin'),
    (() => {
      const q = supabase
        .from('profiles')
        .select(
          'id, email, full_name, phone, role, created_at, tenant:tenant_id(name, slug)',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (roleFilter) return q.eq('role', roleFilter);
      return q;
    })(),
  ]);

  const rows = (rowsRes.data ?? []) as unknown as ProfileRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">
          Everyone who has signed up — fans, organisers, and superadmins.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={total.count ?? 0} icon={Users} />
        <StatCard label="Fans" value={fans.count ?? 0} icon={UserPlus} />
        <StatCard label="Organisers" value={organisers.count ?? 0} icon={Trophy} />
        <StatCard label="Superadmins" value={superadmins.count ?? 0} icon={Crown} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/admin/users" active={!roleFilter}>
          All ({total.count ?? 0})
        </FilterPill>
        <FilterPill href="/admin/users?role=user" active={roleFilter === 'user'}>
          Fans ({fans.count ?? 0})
        </FilterPill>
        <FilterPill href="/admin/users?role=organiser" active={roleFilter === 'organiser'}>
          Organisers ({organisers.count ?? 0})
        </FilterPill>
        <FilterPill
          href="/admin/users?role=superadmin"
          active={roleFilter === 'superadmin'}
        >
          Superadmins ({superadmins.count ?? 0})
        </FilterPill>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {roleFilter
              ? `${roleFilter === 'user' ? 'Fans' : roleFilter === 'organiser' ? 'Organisers' : 'Superadmins'}`
              : 'All users'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({rows.length} shown)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No users match this filter.
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
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b border-border/30 last:border-0">
                      <td className="px-6 py-3 font-medium">
                        {u.full_name?.trim() || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {u.tenant?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {u.phone ?? '—'}
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

function parseRoleFilter(v: string | undefined): Role | null {
  if (v === 'user' || v === 'organiser' || v === 'superadmin') return v;
  return null;
}

function RoleBadge({ role }: { role: Role }) {
  if (role === 'superadmin') {
    return (
      <Badge variant="default" className="gap-1">
        <Crown className="h-3 w-3" />
        Superadmin
      </Badge>
    );
  }
  if (role === 'organiser') return <Badge variant="outline">Organiser</Badge>;
  return <Badge variant="secondary">Fan</Badge>;
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
          : 'inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground'
      }
    >
      {children}
    </Link>
  );
}
