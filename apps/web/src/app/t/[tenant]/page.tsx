import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Crown, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Logo } from '@/components/logo';
import { createClient } from '@/lib/supabase/server';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  group_knockout: 'Group + KO',
  double_elimination: 'Double Elim.',
};

interface TenantBranding {
  primaryColor?: string;
  tagline?: string;
  heroImageUrl?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .eq('slug', tenant)
    .eq('status', 'active')
    .maybeSingle();
  if (!data) return { title: 'League not found' };
  return { title: data.name };
}

export default async function PublicTenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, contact_email, branding')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!tenant) notFound();

  const branding = (tenant.branding as TenantBranding | null) ?? null;
  const brandColor = branding?.primaryColor ?? null;
  const heroImage = branding?.heroImageUrl ?? null;
  const tagline = branding?.tagline ?? null;

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, status, format, start_date, end_date, max_teams')
    .eq('tenant_id', tenant.id)
    .neq('status', 'draft')
    .order('start_date', { ascending: false });

  return (
    <div
      className="min-h-screen bg-background"
      // CSS custom property scoped to this microsite — accents below pick it up
      style={brandColor ? ({ ['--brand-primary' as string]: brandColor } as React.CSSProperties) : undefined}
    >
      <header className="border-b border-border/50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/50">
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-grid opacity-[0.05]" />
            <div className="absolute inset-0 bg-radial-fade" />
            {brandColor && (
              <div
                className="absolute inset-0 opacity-10"
                style={{ background: `linear-gradient(135deg, ${brandColor}, transparent 60%)` }}
              />
            )}
          </>
        )}
        <div className="container relative mx-auto px-4 py-16">
          <div className="flex items-center gap-5">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-16 w-16 rounded-2xl object-cover shadow-xl ring-2 ring-background"
                style={brandColor ? { boxShadow: `0 0 0 2px ${brandColor}33, 0 10px 30px ${brandColor}40` } : undefined}
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl"
                style={{
                  background: brandColor
                    ? `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`
                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                }}
              >
                <Crown className="h-7 w-7 text-white" />
              </div>
            )}
            <div>
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: brandColor ?? undefined }}
              >
                Kabaddi League
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{tenant.name}</h1>
              {tagline && (
                <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{tagline}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                kabaddiadda.com/t/{tenant.slug}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Tournaments</h2>
          <Badge variant="outline">{tournaments?.length ?? 0}</Badge>
        </div>

        {!tournaments || tournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No public tournaments yet"
            description="When this league publishes a tournament, it will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <Link key={t.id} href={`/t/${tenant.slug}/${t.slug}`}>
                <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div
                    className="relative h-20"
                    style={
                      brandColor
                        ? { background: `linear-gradient(135deg, ${brandColor}33, ${brandColor}05)` }
                        : { background: 'linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--primary)/0.05))' }
                    }
                  >
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
                      {t.max_teams && <span>· up to {t.max_teams} teams</span>}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
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
      </section>

      <footer className="mt-12 border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        Powered by{' '}
        <Link href="/" className="font-semibold text-foreground hover:underline">
          Kabaddiadda
        </Link>
      </footer>
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
