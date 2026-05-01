import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  IndianRupee,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TournamentStatusControl } from './status-control';
import { DangerDelete } from './danger-delete';
import { FixturesManageCard } from './fixtures-manage-card';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League · round-robin',
  knockout: 'Knockout · single elimination',
  group_knockout: 'Group stage → Knockout',
  double_elimination: 'Double elimination',
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(
      'id, name, slug, description, format, status, start_date, end_date, max_teams, entry_fee, prize_pool, tenant_id',
    )
    .eq('id', id)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!tournament) notFound();

  const [{ data: tenant }, { count: teamCount }, { count: matchCount }, { data: teams }] = await Promise.all([
    supabase.from('tenants').select('slug').eq('id', tournament.tenant_id).single(),
    supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id),
    // Pulled here so the Fixtures Manage card can pre-load the AddFixtureModal
    // without an extra round-trip on click.
    supabase
      .from('teams')
      .select('id, name, short_name')
      .eq('tournament_id', tournament.id)
      .order('name'),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/organiser/tournaments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to tournaments
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              {FORMAT_LABEL[tournament.format] ?? tournament.format}
            </span>
            {tournament.start_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(tournament.start_date).toLocaleDateString()}
                {tournament.end_date && ` → ${new Date(tournament.end_date).toLocaleDateString()}`}
              </span>
            )}
            {tournament.entry_fee !== null && tournament.entry_fee !== undefined && (
              <span className="inline-flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" />
                Entry ₹{tournament.entry_fee}
              </span>
            )}
          </div>
          {tournament.description && (
            <p className="max-w-prose text-sm text-muted-foreground">{tournament.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tenant?.slug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/t/${tenant.slug}/${tournament.slug}`} target="_blank">
                <ExternalLink className="h-3 w-3" />
                Public page
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Registered teams" value={teamCount ?? 0} icon={Users} />
        <StatCard label="Matches scheduled" value={matchCount ?? 0} icon={Calendar} />
        <StatCard
          label="Prize pool"
          value={tournament.prize_pool ? `₹${tournament.prize_pool.toLocaleString('en-IN')}` : '—'}
          icon={IndianRupee}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Manage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ManageLink
              href={`/organiser/tournaments/${tournament.id}/teams`}
              icon={Users}
              title="Teams & rosters"
              description={`${teamCount ?? 0} registered${tournament.max_teams ? ` of ${tournament.max_teams}` : ''}`}
            />
            <FixturesManageCard
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              matchCount={matchCount ?? 0}
              teams={(teams ?? []).map((t) => ({
                id: t.id,
                name: t.name,
                short_name: t.short_name ?? null,
              }))}
            />
            <ManageLink
              href={`/organiser/scoring`}
              icon={Trophy}
              title="Live scoring"
              description="Open the scoring console for any live match"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TournamentStatusControl id={tournament.id} current={tournament.status} />
            <p className="text-xs text-muted-foreground">
              Draft tournaments are hidden from the public site. Open registration when teams can
              start signing up.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerDelete id={tournament.id} name={tournament.name} />
        </CardContent>
      </Card>
    </div>
  );
}

function ManageLink({
  href,
  icon: Icon,
  title,
  description,
  comingSoon,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  comingSoon?: boolean;
}) {
  const content = (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 p-4 transition-colors hover:bg-accent/30">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 font-medium">
          {title}
          {comingSoon && (
            <Badge variant="outline" className="text-[10px]">
              Soon
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  return comingSoon ? <div className="opacity-60">{content}</div> : <Link href={href}>{content}</Link>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return <Badge variant="live">LIVE</Badge>;
    case 'completed':
      return <Badge variant="success">COMPLETED</Badge>;
    case 'draft':
      return <Badge variant="outline">DRAFT</Badge>;
    case 'registration':
      return <Badge>REGISTRATION OPEN</Badge>;
    case 'scheduled':
      return <Badge variant="secondary">SCHEDULED</Badge>;
    default:
      return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
  }
}
