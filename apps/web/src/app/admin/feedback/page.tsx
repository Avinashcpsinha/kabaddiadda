import { MessageSquare, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Feedback' };

interface FeedbackRow {
  id: string;
  type: 'working' | 'not_working' | 'idea' | 'other';
  message: string;
  email: string | null;
  user_id: string | null;
  page_url: string | null;
  user_agent: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  user: { full_name: string | null; email: string } | null;
}

export default async function AdminFeedbackPage() {
  // Service-role client — bypasses RLS. Safe: admin/layout.tsx already gates
  // this route to superadmin.
  const supabase = createAdminClient();

  const [
    totalRes,
    openRes,
    brokenRes,
    ideasRes,
    rowsRes,
  ] = await Promise.all([
    supabase.from('feedback').select('*', { count: 'exact', head: true }),
    supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'not_working'),
    supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'idea'),
    supabase
      .from('feedback')
      .select(
        'id, type, message, email, user_id, page_url, user_agent, status, created_at, user:user_id(full_name, email)',
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const rows = (rowsRes.data ?? []) as unknown as FeedbackRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback inbox</h1>
        <p className="mt-1 text-muted-foreground">
          What users say is working, broken, or could be better.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={totalRes.count ?? 0} icon={MessageSquare} />
        <StatCard label="Open" value={openRes.count ?? 0} icon={MessageSquare} />
        <StatCard label="Reported broken" value={brokenRes.count ?? 0} icon={ThumbsDown} />
        <StatCard label="Ideas" value={ideasRes.count ?? 0} icon={Sparkles} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest feedback</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No feedback yet. The widget is live on every public/fan page.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {rows.map((r) => (
                <li key={r.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={r.type} />
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    {r.page_url && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        on <span className="text-foreground">{r.page_url}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      From:{' '}
                      <span className="text-foreground">
                        {r.user?.full_name?.trim() ||
                          r.user?.email ||
                          r.email ||
                          'anonymous'}
                      </span>
                    </span>
                    {r.user_agent && (
                      <span
                        className="max-w-md truncate"
                        title={r.user_agent}
                      >
                        UA: {r.user_agent}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TypeBadge({ type }: { type: FeedbackRow['type'] }) {
  if (type === 'working') {
    return (
      <Badge variant="success">
        <ThumbsUp className="mr-1 h-3 w-3" /> Working
      </Badge>
    );
  }
  if (type === 'not_working') {
    return (
      <Badge variant="destructive">
        <ThumbsDown className="mr-1 h-3 w-3" /> Broken
      </Badge>
    );
  }
  if (type === 'idea') {
    return (
      <Badge variant="outline">
        <Sparkles className="mr-1 h-3 w-3" /> Idea
      </Badge>
    );
  }
  return <Badge variant="secondary">Other</Badge>;
}

function StatusBadge({ status }: { status: FeedbackRow['status'] }) {
  const map: Record<FeedbackRow['status'], 'default' | 'secondary' | 'outline'> = {
    open: 'default',
    reviewing: 'secondary',
    resolved: 'outline',
    dismissed: 'outline',
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}
