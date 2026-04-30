import Link from 'next/link';
import { Activity, ArrowRight, Heart, PlayCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { StatCard } from '@/components/dashboard/stat-card';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export default async function FeedHome() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [{ data: liveMatches, count: liveCount }, { data: upcoming }, { count: followingCount }] =
    await Promise.all([
      supabase
        .from('matches')
        .select(
          'id, home_score, away_score, current_half, clock_seconds, home_team:home_team_id(name, short_name, primary_color), away_team:away_team_id(name, short_name, primary_color)',
          { count: 'exact' },
        )
        .eq('status', 'live')
        .order('scheduled_at', { ascending: false })
        .limit(5),
      supabase
        .from('matches')
        .select(
          'id, scheduled_at, home_team:home_team_id(name, short_name), away_team:away_team_id(name, short_name)',
        )
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(6),
      user
        ? supabase
            .from('follows')
            .select('target_id', { count: 'exact', head: true })
            .eq('user_id', user.id)
        : Promise.resolve({ count: 0 }),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-muted-foreground">Live matches and upcoming fixtures.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live now" value={liveCount ?? 0} icon={PlayCircle} />
        <StatCard label="You follow" value={followingCount ?? 0} icon={Heart} />
        <StatCard label="Upcoming this week" value={upcoming?.length ?? 0} icon={Activity} />
        <StatCard label="Rank in your league" value="—" icon={Trophy} delta="coming soon" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live now</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/feed/live">See all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!liveMatches || liveMatches.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No matches are live right now"
                description="Come back when an organiser opens a match."
                action={
                  <Button asChild variant="outline">
                    <Link href="/feed/tournaments">
                      Browse tournaments
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                }
                className="border-0 py-8"
              />
            ) : (
              <div className="space-y-3">
                {liveMatches.map((m) => {
                  // @ts-expect-error supabase nested
                  const home = m.home_team;
                  // @ts-expect-error supabase nested
                  const away = m.away_team;
                  return (
                    <Link
                      key={m.id}
                      href={`/live/${m.id}`}
                      className="group flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-accent/30"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="live" className="text-[10px]">
                          ● LIVE
                        </Badge>
                        <div>
                          <div className="font-medium">
                            {home?.name} <span className="text-muted-foreground">vs</span>{' '}
                            {away?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Q{m.current_half} ·{' '}
                            {Math.floor(m.clock_seconds / 60)
                              .toString()
                              .padStart(2, '0')}
                            :{(m.clock_seconds % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-mono text-2xl font-bold tabular-nums">
                          {m.home_score}{' '}
                          <span className="text-muted-foreground/40">·</span> {m.away_score}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {!upcoming || upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches scheduled. Check back later.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {upcoming.map((m) => {
                  // @ts-expect-error supabase nested
                  const home = m.home_team;
                  // @ts-expect-error supabase nested
                  const away = m.away_team;
                  return (
                    <li key={m.id} className="border-b border-border/30 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {new Date(m.scheduled_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                      <div className="mt-1 font-medium">
                        {initials(home?.name ?? '')} vs {initials(away?.name ?? '')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {home?.name} · {away?.name}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
