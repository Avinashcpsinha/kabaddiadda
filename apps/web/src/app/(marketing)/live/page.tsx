import Link from 'next/link';
import { ArrowRight, Calendar, PlayCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';

// Live page revalidates every 15s — public, no auth required.
export const revalidate = 15;
export const metadata = { title: 'Live now · Kabaddiadda' };

interface LiveMatchCard {
  id: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  scheduled_at: string;
  round: string | null;
  home_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { name: string; short_name: string | null; primary_color: string | null } | null;
  tournament: { name: string; slug: string } | null;
  tenant: { name: string; logo_url: string | null; slug: string } | null;
}

interface UpcomingMatchRow {
  id: string;
  scheduled_at: string;
  round: string | null;
  home_team: { name: string; short_name: string | null } | null;
  away_team: { name: string; short_name: string | null } | null;
  tournament: { name: string } | null;
  tenant: { name: string; slug: string } | null;
}

export default async function LivePage() {
  const supabase = await createClient();

  const [{ data: live }, { data: upcoming }] = await Promise.all([
    supabase
      .from('matches')
      .select(
        `id, home_score, away_score, current_half, clock_seconds, scheduled_at, round,
         home_team:home_team_id(name, short_name, primary_color),
         away_team:away_team_id(name, short_name, primary_color),
         tournament:tournament_id(name, slug),
         tenant:tenant_id(name, logo_url, slug)`,
      )
      .eq('status', 'live')
      .order('updated_at', { ascending: false }),
    supabase
      .from('matches')
      .select(
        `id, scheduled_at, round,
         home_team:home_team_id(name, short_name),
         away_team:away_team_id(name, short_name),
         tournament:tournament_id(name),
         tenant:tenant_id(name, slug)`,
      )
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(12),
  ]);

  const liveMatches = (live ?? []) as unknown as LiveMatchCard[];
  const upcomingMatches = (upcoming ?? []) as unknown as UpcomingMatchRow[];

  return (
    <div className="container mx-auto max-w-6xl space-y-10 px-4 py-12">
      <div>
        <Badge variant="outline" className="mb-3 gap-1.5 border-red-500/40 bg-red-500/5 text-red-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span>Live now</span>
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight">
          {liveMatches.length === 0
            ? 'Nothing live right now'
            : `${liveMatches.length} ${liveMatches.length === 1 ? 'match' : 'matches'} on the mat`}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Tap any card to watch the scoreboard live — no signup needed. The page refreshes every 15
          seconds.
        </p>
      </div>

      {/* Live cards */}
      {liveMatches.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="Nothing live right now"
          description="Check back when an organiser opens a match, or browse upcoming fixtures below."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {liveMatches.map((m) => (
            <Link
              key={m.id}
              href={`/live/${m.id}`}
              className="group block rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <Trophy className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">
                    {m.tenant?.name ?? 'Organiser'}
                  </span>
                </div>
                <Badge variant="live" className="shrink-0 text-[10px]">
                  ● LIVE
                </Badge>
              </div>

              {m.tournament?.name && (
                <div className="mb-4 truncate text-xs font-medium text-foreground/80">
                  {m.tournament.name}
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamSide team={m.home_team} score={m.home_score} align="left" />
                <span className="text-xs font-mono text-muted-foreground">vs</span>
                <TeamSide team={m.away_team} score={m.away_score} align="right" />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                <span className="font-mono">
                  Q{m.current_half} · {formatClock(m.clock_seconds)}
                </span>
                <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Watch live
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Coming up next</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/40">
                {upcomingMatches.map((m) => {
                  // @ts-expect-error supabase nested
                  const home = m.home_team;
                  // @ts-expect-error supabase nested
                  const away = m.away_team;
                  const scheduled = new Date(m.scheduled_at);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/live/${m.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">
                              {home?.name ?? 'TBD'}{' '}
                              <span className="text-muted-foreground">vs</span>{' '}
                              {away?.name ?? 'TBD'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {m.tournament?.name ?? ''}
                              {m.tenant?.slug && (
                                <>
                                  {' · '}
                                  <span>{m.tenant?.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-medium">
                            {scheduled.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </div>
                          <div className="text-muted-foreground">
                            {scheduled.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TeamSide({
  team,
  score,
  align,
}: {
  team: LiveMatchCard['home_team'];
  score: number;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === 'right' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
        style={{
          background: team?.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team?.short_name ?? '??'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{team?.name ?? 'TBD'}</div>
        <div className="font-mono text-xl font-bold tabular-nums">{score}</div>
      </div>
    </div>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
