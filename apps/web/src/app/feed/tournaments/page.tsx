import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { FollowButton } from '@/components/follow-button';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Tournaments' };

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + KO',
  double_elimination: 'Double Elim.',
};

export default async function BrowseTournamentsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [{ data: tournaments }, { data: follows }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, slug, status, format, start_date, end_date, tenant:tenant_id(slug, name)')
      .neq('status', 'draft')
      .order('start_date', { ascending: false })
      .limit(60),
    user
      ? supabase
          .from('follows')
          .select('target_id')
          .eq('user_id', user.id)
          .eq('target_type', 'tournament')
      : Promise.resolve({ data: [] }),
  ]);

  const followedSet = new Set((follows ?? []).map((f) => f.target_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
        <p className="mt-1 text-muted-foreground">
          Every public tournament running on Kabaddiadda.
        </p>
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Once organisers publish their tournaments, they'll appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((t) => {
            // @ts-expect-error supabase nested
            const tenant = t.tenant;
            return (
              <Card
                key={t.id}
                className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <Link href={`/t/${tenant?.slug}/${t.slug}`} className="flex flex-1 flex-col">
                  <div className="relative h-20 bg-gradient-to-br from-primary/20 via-orange-500/10 to-transparent">
                    <div className="absolute inset-0 bg-grid opacity-30" />
                    <div className="absolute right-3 top-3">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <CardContent className="flex-1 space-y-2 p-5">
                    <div className="text-xs text-muted-foreground">{tenant?.name ?? 'Independent'}</div>
                    <h3 className="line-clamp-2 font-semibold leading-tight">{t.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {FORMAT_LABEL[t.format] ?? t.format}
                      </Badge>
                      <span>
                        {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
                      </span>
                    </div>
                  </CardContent>
                </Link>
                <div className="flex items-center justify-between border-t border-border/50 px-5 py-3">
                  {user ? (
                    <FollowButton
                      targetType="tournament"
                      targetId={t.id}
                      initiallyFollowing={followedSet.has(t.id)}
                    />
                  ) : (
                    <Link href="/login" className="text-xs text-muted-foreground hover:underline">
                      Sign in to follow
                    </Link>
                  )}
                  <Link
                    href={`/t/${tenant?.slug}/${t.slug}`}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            );
          })}
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
      return <Badge variant="success">DONE</Badge>;
    case 'registration':
      return <Badge>OPEN</Badge>;
    default:
      return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
  }
}
