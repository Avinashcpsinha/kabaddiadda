import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Calendar,
  IndianRupee,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function OrganiserHome() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const tenantId = user!.tenantId!;

  // Parallel count queries — RLS already scopes to this tenant.
  const [tournamentsRes, teamsRes, matchesRes, recentRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, status', { count: 'exact' })
      .eq('tenant_id', tenantId),
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('tournaments')
      .select('id, name, slug, status, start_date, end_date')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const tournamentCount = tournamentsRes.count ?? 0;
  const liveCount =
    tournamentsRes.data?.filter((t) => t.status === 'live').length ?? 0;
  const teamCount = teamsRes.count ?? 0;
  const weekMatches = matchesRes.count ?? 0;
  const recent = recentRes.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organiser dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {user?.fullName
              ? `${user.fullName.split(' ')[0]}, manage your tournaments and live scoring.`
              : 'Manage your tournaments and live scoring.'}
          </p>
        </div>
        <Button asChild variant="flame" size="lg">
          <Link href="/organiser/tournaments/new">
            <Plus className="h-4 w-4" />
            New tournament
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active tournaments"
          value={tournamentCount}
          icon={Trophy}
          delta={liveCount ? `${liveCount} live now` : 'none live'}
        />
        <StatCard label="Registered teams" value={teamCount} icon={Users} />
        <StatCard label="Matches this week" value={weekMatches} icon={Calendar} />
        <StatCard label="Revenue (MTD)" value="₹0" icon={IndianRupee} delta="billing in Phase 5" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent tournaments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/organiser/tournaments">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No tournaments yet"
                description="Create your first tournament to get started."
                action={
                  <Button asChild variant="flame">
                    <Link href="/organiser/tournaments/new">
                      <Plus className="h-4 w-4" />
                      Create tournament
                    </Link>
                  </Button>
                }
                className="border-0 py-8"
              />
            ) : (
              <div className="space-y-3">
                {recent.map((t) => (
                  <Link
                    key={t.id}
                    href={`/organiser/tournaments/${t.id}`}
                    className="block rounded-lg border border-border/50 p-4 transition-all hover:border-primary/40 hover:bg-accent/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{t.name}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'} —{' '}
                          {t.end_date ? new Date(t.end_date).toLocaleDateString() : 'TBD'}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickAction icon={Trophy} label="Create tournament" href="/organiser/tournaments/new" />
            <QuickAction icon={Users} label="Browse tournaments" href="/organiser/tournaments" />
            <QuickAction icon={Calendar} label="Generate fixtures" href="/organiser/fixtures" />
            <QuickAction icon={Activity} label="Open scoring console" href="/organiser/scoring" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return (
        <Badge variant="live" className="text-[10px]">
          LIVE
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="success" className="text-[10px]">
          DONE
        </Badge>
      );
    case 'draft':
      return (
        <Badge variant="outline" className="text-[10px]">
          DRAFT
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          {status.toUpperCase()}
        </Badge>
      );
  }
}

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Activity;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md p-3 text-sm transition-colors hover:bg-accent/40"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 font-medium">{label}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
    </Link>
  );
}
