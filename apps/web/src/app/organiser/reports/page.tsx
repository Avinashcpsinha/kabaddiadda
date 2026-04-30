import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Calendar,
  Crown,
  Download,
  Shield,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Reports' };

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

export default async function ReportsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const tenantId = user!.tenantId!;

  // Headline numbers — same as before, kept tight.
  const [tournamentsRes, completedMatchesRes, eventsRes, allTournaments] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('matches')
      .select('id, home_score, away_score, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed'),
    supabase
      .from('match_events')
      .select('type, is_super_raid, is_super_tackle, is_all_out')
      .eq('tenant_id', tenantId),
    supabase
      .from('tournaments')
      .select('id, slug, name, format, status, start_date, end_date')
      .eq('tenant_id', tenantId)
      .order('start_date', { ascending: false, nullsFirst: false }),
  ]);

  const completed = completedMatchesRes.data ?? [];
  const events = eventsRes.data ?? [];
  const tournaments = allTournaments.data ?? [];

  const totalPoints = completed.reduce((s, m) => s + m.home_score + m.away_score, 0);
  const allOuts = events.filter((e) => e.is_all_out).length;
  const superRaids = events.filter((e) => e.is_super_raid).length;
  const superTackles = events.filter((e) => e.is_super_tackle).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-muted-foreground">
            League-wide analytics + per-tournament breakdowns + CSV export.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/reports/export?type=tenant_summary&tenant=${tenantId}`}>
            <Download className="h-3 w-3" />
            Export tenant summary
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tournaments" value={tournamentsRes.count ?? 0} icon={Trophy} />
        <StatCard label="Completed matches" value={completed.length} icon={Activity} />
        <StatCard label="Total points scored" value={totalPoints} icon={Target} />
        <StatCard label="All-outs delivered" value={allOuts} icon={Zap} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Super raids (3+ pt single raid)" value={superRaids} icon={Crown} />
        <StatCard label="Super tackles (≤3 defenders)" value={superTackles} icon={Shield} />
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Tournaments — drill in</h2>
          <span className="text-xs text-muted-foreground">
            Open any tournament for standings, top performers, charts and per-match breakdowns.
          </span>
        </div>

        {tournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description="Create your first tournament to start collecting reportable data."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => {
              const dateRange = formatDateRange(t.start_date, t.end_date);
              return (
                <Link
                  key={t.id}
                  href={`/organiser/reports/tournaments/${t.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{t.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{FORMAT_LABEL[t.format] ?? t.format}</span>
                        {dateRange && (
                          <>
                            <span>·</span>
                            <Calendar className="h-3 w-3" />
                            <span>{dateRange}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[t.status] ?? 'outline'}
                      className="shrink-0 text-[10px] uppercase"
                    >
                      {t.status === 'live' ? '● LIVE' : t.status}
                    </Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">View report</span>
                    <ArrowRight className="h-3 w-3 text-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start ?? end)!);
}
