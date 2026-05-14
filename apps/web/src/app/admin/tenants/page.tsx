import Link from 'next/link';
import { Building2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Tenants' };

type TenantStatus = 'pending' | 'active' | 'suspended' | 'archived';

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  status: TenantStatus;
  plan: string | null;
  plan_status: string | null;
  owner_id: string | null;
  contact_email: string | null;
  created_at: string;
  owner: { full_name: string | null; email: string } | null;
}

interface SearchParams {
  status?: string;
}

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusFilter = parseStatusFilter(sp.status);

  const supabase = createAdminClient();

  const [total, active, pending, suspended, rowsRes, tournamentsRes] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suspended'),
    (() => {
      const q = supabase
        .from('tenants')
        .select(
          'id, slug, name, custom_domain, status, plan, plan_status, owner_id, contact_email, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (statusFilter) return q.eq('status', statusFilter);
      return q;
    })(),
    supabase.from('tournaments').select('tenant_id'),
  ]);

  // tenants.owner_id has no FK constraint to profiles (see 0001_init.sql),
  // so Supabase's embed syntax can't resolve the relationship. Hydrate owners
  // with a second query and stitch them in.
  const rawRows = (rowsRes.data ?? []) as Omit<TenantRow, 'owner'>[];
  const ownerIds = Array.from(
    new Set(rawRows.map((t) => t.owner_id).filter((id): id is string => !!id)),
  );
  const ownersById = new Map<string, { full_name: string | null; email: string }>();
  if (ownerIds.length > 0) {
    const { data: ownersData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ownerIds);
    for (const o of ownersData ?? []) {
      ownersById.set(o.id, { full_name: o.full_name, email: o.email });
    }
  }
  const rows: TenantRow[] = rawRows.map((t) => ({
    ...t,
    owner: t.owner_id ? ownersById.get(t.owner_id) ?? null : null,
  }));

  // Build a per-tenant tournament count for the table.
  const tournamentsByTenant = new Map<string, number>();
  for (const row of tournamentsRes.data ?? []) {
    const id = (row as { tenant_id: string }).tenant_id;
    tournamentsByTenant.set(id, (tournamentsByTenant.get(id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
        <p className="mt-1 text-muted-foreground">
          Every league running on the platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={total.count ?? 0} icon={Building2} />
        <StatCard
          label="Active"
          value={active.count ?? 0}
          icon={CheckCircle2}
          tone={(active.count ?? 0) > 0 ? 'positive' : 'default'}
        />
        <StatCard label="Pending" value={pending.count ?? 0} icon={Clock} />
        <StatCard label="Suspended" value={suspended.count ?? 0} icon={XCircle} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/admin/tenants" active={!statusFilter}>
          All ({total.count ?? 0})
        </FilterPill>
        <FilterPill href="/admin/tenants?status=active" active={statusFilter === 'active'}>
          Active ({active.count ?? 0})
        </FilterPill>
        <FilterPill
          href="/admin/tenants?status=pending"
          active={statusFilter === 'pending'}
        >
          Pending ({pending.count ?? 0})
        </FilterPill>
        <FilterPill
          href="/admin/tenants?status=suspended"
          active={statusFilter === 'suspended'}
        >
          Suspended ({suspended.count ?? 0})
        </FilterPill>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter
              ? `${statusFilter.charAt(0).toUpperCase()}${statusFilter.slice(1)} tenants`
              : 'All tenants'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({rows.length} shown)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No tenants match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Slug</th>
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Plan</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Tournaments</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b border-border/30 last:border-0">
                      <td className="px-6 py-3 font-medium">
                        {t.name}
                        {t.custom_domain && (
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-primary">
                            {t.custom_domain}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                        {t.slug}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {t.owner?.full_name?.trim() ||
                          t.owner?.email ||
                          t.contact_email ||
                          '—'}
                      </td>
                      <td className="px-6 py-3">
                        {t.plan && t.plan !== 'free' ? (
                          <Badge variant="outline">{t.plan}</Badge>
                        ) : (
                          <span className="text-muted-foreground">free</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {tournamentsByTenant.get(t.id) ?? 0}
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString('en-IN', {
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

function parseStatusFilter(v: string | undefined): TenantStatus | null {
  if (
    v === 'pending' ||
    v === 'active' ||
    v === 'suspended' ||
    v === 'archived'
  )
    return v;
  return null;
}

function StatusBadge({ status }: { status: TenantStatus }) {
  if (status === 'active') return <Badge variant="success">Active</Badge>;
  if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
  if (status === 'suspended') return <Badge variant="destructive">Suspended</Badge>;
  return <Badge variant="outline">{status}</Badge>;
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
