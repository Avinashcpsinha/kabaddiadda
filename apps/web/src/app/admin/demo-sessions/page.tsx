import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { createClient } from '@/lib/supabase/server';
import { DeleteSessionButton, PurgeAllButton } from './buttons';

export const metadata = { title: 'Demo sessions · Superadmin' };

interface SessionRow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  page_url: string | null;
  created_at: string;
  tenant: { slug: string; status: string } | null;
}

export default async function DemoSessionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('demo_sessions')
    .select('id, name, mobile, email, page_url, created_at, tenant:tenant_id(slug, status)')
    .order('created_at', { ascending: false })
    .limit(500);
  const sessions = (data ?? []) as unknown as SessionRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            Demo sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitors who launched the instant “Try live scoring” demo. Sandbox tenants
            auto-clean nightly; these lead records are kept.
          </p>
        </div>
        <PurgeAllButton />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No demo sessions yet"
          description="When someone clicks “Try live scoring” and enters their name, they'll appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 hidden md:table-cell">When</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Sandbox</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex flex-col">
                        {s.mobile && <span className="font-mono text-xs">{s.mobile}</span>}
                        {s.email && <span className="text-xs">{s.email}</span>}
                        {!s.mobile && !s.email && <span className="text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.tenant ? (
                        <Badge variant="outline" className="text-[10px]">
                          {s.tenant.slug}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">cleaned up</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteSessionButton id={s.id} name={s.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
