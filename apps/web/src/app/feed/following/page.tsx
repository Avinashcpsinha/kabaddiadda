import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Following' };

export default async function FollowingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/feed/following');

  const supabase = await createClient();

  const { data: follows } = await supabase
    .from('follows')
    .select('target_type, target_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!follows || follows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Following</h1>
        <EmptyState
          icon={Heart}
          title="You aren't following anything yet"
          description="Browse tournaments and tap Follow on the ones you care about."
          action={
            <Button asChild variant="flame">
              <Link href="/feed/tournaments">Browse tournaments</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const tournamentIds = follows
    .filter((f) => f.target_type === 'tournament')
    .map((f) => f.target_id);

  const { data: tournaments } = tournamentIds.length
    ? await supabase
        .from('tournaments')
        .select('id, name, slug, status, tenant:tenant_id(slug, name)')
        .in('id', tournamentIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Following</h1>
        <p className="mt-1 text-muted-foreground">{follows.length} entities you follow.</p>
      </div>

      {tournaments && tournaments.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4" />
            Tournaments
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => {
              // @ts-expect-error supabase nested
              const tenant = t.tenant;
              return (
                <Link key={t.id} href={`/t/${tenant?.slug}/${t.slug}`}>
                  <Card className="transition-all hover:border-primary/40">
                    <CardContent className="space-y-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tenant?.name ?? 'Independent'}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
