import Link from 'next/link';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

export const metadata = { title: 'Live matches' };

export default async function LiveListPage() {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, home_score, away_score, current_half, clock_seconds, home_team:home_team_id(name, short_name, primary_color), away_team:away_team_id(name, short_name, primary_color), tournament:tournament_id(name, slug, tenant:tenant_id(slug))',
    )
    .eq('status', 'live')
    .order('scheduled_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live matches</h1>
        <p className="mt-1 text-muted-foreground">
          Every match currently being scored across Kabaddiadda.
        </p>
      </div>

      {!matches || matches.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="Nothing live right now"
          description="Live matches show here as soon as an organiser starts scoring."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((m) => {
            // @ts-expect-error supabase nested
            const home = m.home_team;
            // @ts-expect-error supabase nested
            const away = m.away_team;
            // @ts-expect-error supabase nested
            const tournament = m.tournament;
            return (
              <Link key={m.id} href={`/live/${m.id}`}>
                <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {tournament?.name ?? 'Match'}
                      </span>
                      <Badge variant="live" className="text-[10px]">
                        ● LIVE
                      </Badge>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <Side team={home} score={m.home_score} side="home" />
                      <div className="text-center text-xs text-muted-foreground">
                        Q{m.current_half}{' '}
                        {Math.floor(m.clock_seconds / 60)
                          .toString()
                          .padStart(2, '0')}
                        :{(m.clock_seconds % 60).toString().padStart(2, '0')}
                      </div>
                      <Side team={away} score={m.away_score} side="away" />
                    </div>
                    <div className="mt-4 flex items-center justify-end text-xs text-primary">
                      Watch live
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Side({
  team,
  score,
  side,
}: {
  team: { name: string; short_name: string | null; primary_color: string | null } | null;
  score: number;
  side: 'home' | 'away';
}) {
  if (!team) return <div />;
  const align = side === 'home' ? 'flex-row' : 'flex-row-reverse';
  return (
    <div className={`flex items-center gap-2 ${align}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{
          background: team.primary_color
            ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
            : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
        }}
      >
        {team.short_name || initials(team.name)}
      </div>
      <div className={side === 'home' ? '' : 'text-right'}>
        <div className="text-xs text-muted-foreground">{team.name}</div>
        <div className="font-mono text-2xl font-bold tabular-nums">{score}</div>
      </div>
    </div>
  );
}
