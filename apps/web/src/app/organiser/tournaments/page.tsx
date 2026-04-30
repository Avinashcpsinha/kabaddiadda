import Link from 'next/link';
import { ArrowRight, Plus, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Tournaments' };

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + KO',
  double_elimination: 'Double Elim.',
};

export default async function TournamentsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, status, format, start_date, end_date, max_teams')
    .eq('tenant_id', user!.tenantId!)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
          <p className="mt-1 text-muted-foreground">
            All tournaments in your league. Click any to manage teams, fixtures, and live
            scoring.
          </p>
        </div>
        <Button asChild variant="flame">
          <Link href="/organiser/tournaments/new">
            <Plus className="h-4 w-4" />
            New tournament
          </Link>
        </Button>
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Spin up your first tournament — league, knockout, or hybrid format."
          action={
            <Button asChild variant="flame">
              <Link href="/organiser/tournaments/new">
                <Plus className="h-4 w-4" />
                Create your first tournament
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/organiser/tournaments/${t.id}`}>
              <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <div className="relative h-24 bg-gradient-to-br from-primary/20 via-orange-500/10 to-transparent">
                  <div className="absolute inset-0 bg-grid opacity-30" />
                  <div className="absolute right-3 top-3">
                    <StatusBadge status={t.status} />
                  </div>
                </div>
                <CardContent className="space-y-2 p-5">
                  <h3 className="line-clamp-2 font-semibold leading-tight">{t.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {FORMAT_LABEL[t.format] ?? t.format}
                    </Badge>
                    {t.max_teams && <span>· Up to {t.max_teams} teams</span>}
                  </div>
                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                    <span>
                      {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
                      {' → '}
                      {t.end_date ? new Date(t.end_date).toLocaleDateString() : 'TBD'}
                    </span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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
      return <Badge variant="default">REGISTRATION</Badge>;
    default:
      return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
  }
}
