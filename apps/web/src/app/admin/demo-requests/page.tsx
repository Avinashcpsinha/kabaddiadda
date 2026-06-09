import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  Inbox,
  Link as LinkIcon,
  Mail,
  Phone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusForm } from './status-form';
import { PurgeSandboxesButton } from './purge-button';

export const metadata = { title: 'Leads' };

type DemoStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam';

interface DemoRequestRow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  organisation: string | null;
  social_link: string | null;
  page_url: string | null;
  user_agent: string | null;
  status: DemoStatus;
  admin_note: string | null;
  source: 'booked' | 'instant';
  created_at: string;
  user_id: string | null;
  user: { full_name: string | null; email: string } | null;
}

export default async function AdminDemoRequestsPage() {
  // Service-role client — admin/layout.tsx already gates this to superadmin.
  const supabase = createAdminClient();

  const [totalRes, newRes, wonRes, lostRes, rowsRes] = await Promise.all([
    supabase.from('demo_requests').select('*', { count: 'exact', head: true }),
    supabase
      .from('demo_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('demo_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'won'),
    supabase
      .from('demo_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lost'),
    supabase
      .from('demo_requests')
      .select(
        'id, name, mobile, email, organisation, social_link, page_url, user_agent, status, admin_note, source, created_at, user_id, user:user_id(full_name, email)',
      )
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const rows = (rowsRes.data ?? []) as unknown as DemoRequestRow[];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-muted-foreground">
            Booked demos and instant "Try live scoring" visitors — call, email, and track
            each conversation. Leads are never removed by the demo cleanup.
          </p>
        </div>
        <PurgeSandboxesButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={totalRes.count ?? 0} icon={Inbox} />
        <StatCard label="New" value={newRes.count ?? 0} icon={CalendarCheck} />
        <StatCard label="Won" value={wonRes.count ?? 0} icon={CheckCircle2} />
        <StatCard label="Lost" value={lostRes.count ?? 0} icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No demo requests yet. The button is live on every marketing page.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {rows.map((r) => (
                <li key={r.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{r.name}</span>
                        <StatusBadge status={r.status} />
                        <SourceBadge source={r.source} />
                      </div>
                      {r.organisation && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          {r.organisation}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {r.mobile && (
                      <ContactLine
                        icon={<Phone className="h-3.5 w-3.5" />}
                        href={`tel:${r.mobile.replace(/\s+/g, '')}`}
                        whatsapp={`https://wa.me/${r.mobile.replace(/[^\d+]/g, '').replace(/^\+/, '')}`}
                        label={r.mobile}
                      />
                    )}
                    {r.email && (
                      <ContactLine
                        icon={<Mail className="h-3.5 w-3.5" />}
                        href={`mailto:${r.email}`}
                        label={r.email}
                      />
                    )}
                    {!r.mobile && !r.email && (
                      <span className="text-sm text-muted-foreground">No contact provided</span>
                    )}
                    {r.social_link && (
                      <ContactLine
                        icon={<LinkIcon className="h-3.5 w-3.5" />}
                        href={r.social_link}
                        external
                        label={r.social_link}
                        className="sm:col-span-2"
                      />
                    )}
                  </dl>

                  {(r.page_url || r.user) && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.page_url && (
                        <span className="font-mono">
                          from <span className="text-foreground">{r.page_url}</span>
                        </span>
                      )}
                      {r.user && (
                        <span>
                          signed in as{' '}
                          <span className="text-foreground">
                            {r.user.full_name?.trim() || r.user.email}
                          </span>
                        </span>
                      )}
                    </div>
                  )}

                  <StatusForm
                    id={r.id}
                    status={r.status}
                    adminNote={r.admin_note ?? ''}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactLine({
  icon,
  href,
  label,
  external,
  whatsapp,
  className,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
  external?: boolean;
  whatsapp?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      <span className="text-muted-foreground">{icon}</span>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="truncate text-foreground hover:text-primary hover:underline"
      >
        {label}
      </a>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-emerald-500 hover:underline"
          title="Open in WhatsApp"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: 'booked' | 'instant' }) {
  return source === 'instant' ? (
    <Badge variant="outline" className="border-primary/40 text-primary">
      Instant demo
    </Badge>
  ) : (
    <Badge variant="outline">Booked</Badge>
  );
}

function StatusBadge({ status }: { status: DemoStatus }) {
  if (status === 'new') return <Badge variant="default">New</Badge>;
  if (status === 'contacted') return <Badge variant="secondary">Contacted</Badge>;
  if (status === 'qualified') return <Badge variant="outline">Qualified</Badge>;
  if (status === 'won') return <Badge variant="success">Won</Badge>;
  if (status === 'lost') return <Badge variant="outline">Lost</Badge>;
  return <Badge variant="destructive">Spam</Badge>;
}
