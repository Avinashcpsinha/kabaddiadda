import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Calendar,
  Crown,
  IndianRupee,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League — round-robin',
  knockout: 'Knockout — single elimination',
  group_knockout: 'Group + Knockout',
  double_elimination: 'Double elimination',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; tournament: string }>;
}) {
  const { tenant, tournament } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from('tournaments')
    .select('name, description, tenants!inner(slug, name)')
    .eq('slug', tournament)
    .eq('tenants.slug', tenant)
    .neq('status', 'draft')
    .maybeSingle();
  if (!t) return { title: 'Tournament not found' };
  return {
    title: t.name,
    description: t.description ?? `${t.name} — live on Kabaddiadda.`,
  };
}

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tenant: string; tournament: string }>;
}) {
  const { tenant: tenantSlug, tournament: tournamentSlug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, branding')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .maybeSingle();
  if (!tenant) notFound();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(
      'id, name, slug, description, format, status, start_date, end_date, max_teams, prize_pool, cover_image',
    )
    .eq('tenant_id', tenant.id)
    .eq('slug', tournamentSlug)
    .neq('status', 'draft')
    .maybeSingle();
  if (!tournament) notFound();

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, city, primary_color')
    .eq('tournament_id', tournament.id)
    .order('name');

  const branding = (tenant.branding as { primaryColor?: string; tagline?: string } | null) ?? null;
  const brandColor = branding?.primaryColor ?? null;

  return (
    <div
      className="min-h-screen bg-background"
      style={brandColor ? ({ ['--brand-primary' as string]: brandColor } as React.CSSProperties) : undefined}
    >
      <Hero tenant={tenant} tournament={tournament} brandColor={brandColor} />

      <section className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Teams</CardTitle>
                <Badge variant="outline">{teams?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent>
                {!teams || teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No teams have registered yet. Check back soon.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {teams.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={{
                            background: t.primary_color
                              ? `linear-gradient(135deg, ${t.primary_color}, ${t.primary_color}cc)`
                              : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
                          }}
                        >
                          {t.short_name || initials(t.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          {t.city && (
                            <div className="text-xs text-muted-foreground">{t.city}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fixtures</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Fixtures will appear here once the organiser publishes them. Phase 2 launches the
                follow + notify experience.
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hosted by</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {tenant.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tenant.logo_url}
                      alt={tenant.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 font-bold text-white">
                      <Crown className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">
                      kabaddiadda.com/t/{tenant.slug}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow icon={Trophy} label="Format" value={FORMAT_LABEL[tournament.format] ?? tournament.format} />
                {tournament.start_date && (
                  <DetailRow
                    icon={Calendar}
                    label="Dates"
                    value={`${new Date(tournament.start_date).toLocaleDateString()}${
                      tournament.end_date ? ` → ${new Date(tournament.end_date).toLocaleDateString()}` : ''
                    }`}
                  />
                )}
                {tournament.max_teams && (
                  <DetailRow
                    icon={Users}
                    label="Capacity"
                    value={`${teams?.length ?? 0} / ${tournament.max_teams} teams`}
                  />
                )}
                {tournament.prize_pool && (
                  <DetailRow
                    icon={IndianRupee}
                    label="Prize pool"
                    value={`₹${tournament.prize_pool.toLocaleString('en-IN')}`}
                  />
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        Powered by{' '}
        <Link href="/" className="font-semibold text-foreground hover:underline">
          Kabaddiadda
        </Link>
      </footer>
    </div>
  );
}

function Hero({
  tenant,
  tournament,
  brandColor,
}: {
  tenant: { name: string; slug: string };
  tournament: {
    name: string;
    description: string | null;
    status: string;
    cover_image: string | null;
  };
  brandColor: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 bg-grid opacity-[0.05]" />
      <div className="absolute inset-0 bg-radial-fade" />
      {tournament.cover_image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${tournament.cover_image})` }}
        />
      )}
      {brandColor && !tournament.cover_image && (
        <div
          className="absolute inset-0 opacity-15"
          style={{ background: `linear-gradient(135deg, ${brandColor}, transparent 60%)` }}
        />
      )}

      <div className="container relative mx-auto px-4 py-20">
        <Link
          href={`/t/${tenant.slug}`}
          className="text-sm hover:text-foreground"
          style={{ color: brandColor ?? undefined }}
        >
          ← {tenant.name}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{tournament.name}</h1>
          <StatusBadge status={tournament.status} />
        </div>
        {tournament.description && (
          <p className="mt-4 max-w-2xl text-muted-foreground">{tournament.description}</p>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'live':
      return (
        <Badge variant="live" className="text-xs">
          ● LIVE
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="success" className="text-xs">
          COMPLETED
        </Badge>
      );
    case 'registration':
      return <Badge>REGISTRATION OPEN</Badge>;
    default:
      return null;
  }
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
