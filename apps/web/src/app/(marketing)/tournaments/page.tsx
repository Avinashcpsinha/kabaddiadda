import Link from 'next/link';
import { ArrowRight, Calendar, Crown, Sparkles, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;
export const metadata = { title: 'Tournaments · Kabaddiadda' };

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + KO',
  double_elimination: 'Double Elim.',
};

const STATUS_VARIANT: Record<string, 'live' | 'default' | 'outline' | 'secondary'> = {
  live: 'live',
  scheduled: 'outline',
  upcoming: 'outline',
  completed: 'secondary',
};

// Filter pill values
type StatusFilter = 'all' | 'live' | 'upcoming' | 'completed';

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  tenant: { slug: string; name: string; logo_url: string | null } | null;
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; league?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter: StatusFilter = (['all', 'live', 'upcoming', 'completed'] as const).includes(
    sp.status as StatusFilter,
  )
    ? (sp.status as StatusFilter)
    : 'all';
  const leagueFilter = sp.league ?? '';

  const supabase = await createClient();

  // Tenants for the filter dropdown
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('status', 'active')
    .order('name');

  // Tournaments query — RLS hides drafts from anonymous visitors but we filter
  // again so the SQL plan is cleaner.
  let query = supabase
    .from('tournaments')
    .select(
      'id, slug, name, format, status, start_date, end_date, cover_image, tenant:tenant_id(slug, name, logo_url)',
    )
    .neq('status', 'draft')
    .order('start_date', { ascending: false, nullsFirst: false });

  if (statusFilter !== 'all') {
    if (statusFilter === 'upcoming') {
      query = query.eq('status', 'scheduled');
    } else {
      query = query.eq('status', statusFilter);
    }
  }
  if (leagueFilter) {
    const tenant = (tenants ?? []).find((t) => t.slug === leagueFilter);
    if (tenant) query = query.eq('tenant_id', tenant.id);
  }

  const { data: rows } = await query.limit(60);
  const tournaments = (rows ?? []) as unknown as TournamentRow[];

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-12">
      <div>
        <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5">
          <Trophy className="h-3 w-3 text-primary" />
          <span className="text-primary">Tournaments</span>
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight">
          Every tournament on Kabaddiadda
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Browse leagues, knockouts, and championships across the platform. Tap any card to open the
          tournament page — fixtures, teams, and live scoring without signing up.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            {(['all', 'live', 'upcoming', 'completed'] as StatusFilter[]).map((f) => (
              <FilterPill
                key={f}
                href={`/tournaments?${new URLSearchParams({
                  status: f,
                  ...(leagueFilter ? { league: leagueFilter } : {}),
                }).toString()}`}
                active={f === statusFilter}
                label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              />
            ))}
          </div>
          {tenants && tenants.length > 0 && (
            <form className="ml-auto flex items-center gap-2" action="/tournaments" method="get">
              <input type="hidden" name="status" value={statusFilter} />
              <span className="text-xs text-muted-foreground">League:</span>
              <select
                name="league"
                defaultValue={leagueFilter}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All leagues</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Apply
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      {tournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments match"
          description="Try clearing the filters above or come back when more leagues publish their schedules."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => {
            const dateRange = formatDateRange(t.start_date, t.end_date);
            const tenantSlug = t.tenant?.slug;
            const tenantName = t.tenant?.name ?? 'Organiser';
            const href = tenantSlug ? `/t/${tenantSlug}/${t.slug}` : '#';
            return (
              <Link
                key={t.id}
                href={href}
                className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                {t.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.cover_image}
                    alt={t.name}
                    className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                    <Trophy className="h-10 w-10 text-primary/40" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Crown className="h-3 w-3 shrink-0" />
                        <span className="truncate">{tenantName}</span>
                      </div>
                      <h3 className="truncate text-base font-semibold">{t.name}</h3>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[t.status] ?? 'outline'}
                      className="shrink-0 text-[10px] uppercase"
                    >
                      {t.status === 'live' ? '● LIVE' : t.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {FORMAT_LABEL[t.format] ?? t.format}
                    </span>
                    {dateRange && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dateRange}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-3 text-xs">
                    <span className="text-muted-foreground">View tournament</span>
                    <ArrowRight className="h-3 w-3 text-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start ?? end)!);
}
