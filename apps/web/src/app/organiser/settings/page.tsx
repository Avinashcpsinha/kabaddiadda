import { AlertCircle, CheckCircle2, Globe, Save, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateTenantSettingsAction } from './actions';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, custom_domain, logo_url, status, contact_email, contact_phone, branding')
    .eq('id', user!.tenantId!)
    .maybeSingle();

  const branding = (tenant?.branding as { primaryColor?: string; tagline?: string; heroImageUrl?: string } | null) ?? null;
  const primaryColor = branding?.primaryColor ?? '';
  const tagline = branding?.tagline ?? '';
  const heroImageUrl = branding?.heroImageUrl ?? '';

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'kabaddiadda.com';
  const subdomainUrl = `https://${tenant?.slug}.${rootDomain}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Branding, contact info, and your league&apos;s public address.
        </p>
      </div>

      {params.saved && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Settings saved.
        </div>
      )}
      {params.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form action={updateTenantSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="h-4 w-4" />
              League details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">
                League name <Req />
              </Label>
              <Input id="name" name="name" defaultValue={tenant?.name ?? ''} required />
              <p className="text-[10px] text-muted-foreground">
                Shown across your public pages and on the organiser sidebar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-xs">
                  Slug
                </Label>
                <Input id="slug" value={tenant?.slug ?? ''} disabled className="font-mono" />
                <p className="text-[10px] text-muted-foreground">
                  Read-only — changing this would break your subdomain.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs">
                  Status
                </Label>
                <Input
                  id="status"
                  value={tenant?.status?.toUpperCase() ?? ''}
                  disabled
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Managed by Superadmin.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Public address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Subdomain</Label>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 font-mono text-sm">
                <span className="truncate text-foreground">{subdomainUrl}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Always available, free.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customDomain" className="text-xs">
                Custom domain <span className="text-muted-foreground">(Pro / Enterprise)</span>
              </Label>
              <Input
                id="customDomain"
                name="customDomain"
                placeholder="yourleague.com"
                defaultValue={tenant?.custom_domain ?? ''}
                className="font-mono"
              />
              {tenant?.custom_domain ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Two steps to go live:</p>
                      <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
                        <li>
                          At your DNS provider, add a CNAME record:
                          <div className="mt-1 grid grid-cols-[80px_1fr] gap-x-2 rounded bg-background/60 p-2 font-mono">
                            <span className="text-muted-foreground">Host</span>
                            <span className="break-all text-foreground">{tenant.custom_domain}</span>
                            <span className="text-muted-foreground">Type</span>
                            <span className="text-foreground">CNAME</span>
                            <span className="text-muted-foreground">Target</span>
                            <span className="break-all text-foreground">cname.vercel-dns.com</span>
                          </div>
                        </li>
                        <li>
                          In your Vercel project (Project Settings → Domains), add{' '}
                          <span className="font-mono text-foreground">{tenant.custom_domain}</span>.
                          SSL is provisioned automatically.
                        </li>
                      </ol>
                      <p className="pt-1 text-[10px] text-muted-foreground">
                        Once DNS propagates (usually a few minutes), visiting{' '}
                        <span className="font-mono text-foreground">https://{tenant.custom_domain}</span>{' '}
                        will load your league page.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Add your domain to use a vanity URL like{' '}
                  <span className="font-mono">yourleague.com</span> instead of the default subdomain.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-xs">
                Logo URL
              </Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                placeholder="https://..."
                defaultValue={tenant?.logo_url ?? ''}
              />
              <p className="text-[10px] text-muted-foreground">
                Square PNG / SVG works best. ~256×256.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="text-xs">
                Primary color
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="primaryColor"
                  name="primaryColor"
                  placeholder="#f97316"
                  defaultValue={primaryColor}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="font-mono"
                />
                {primaryColor && (
                  <div
                    className="h-9 w-9 shrink-0 rounded-md border border-border/60"
                    style={{ background: primaryColor }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Hex code (e.g. <span className="font-mono">#f97316</span>). Used for accent CTAs and
                public-page highlights.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline" className="text-xs">
                Tagline
              </Label>
              <Input
                id="tagline"
                name="tagline"
                placeholder="The premier kabaddi league of West Bengal"
                defaultValue={tagline}
                maxLength={120}
              />
              <p className="text-[10px] text-muted-foreground">
                Shown under your league name on the public page. ~120 chars.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroImageUrl" className="text-xs">
                Hero banner image URL
              </Label>
              <Input
                id="heroImageUrl"
                name="heroImageUrl"
                type="url"
                placeholder="https://..."
                defaultValue={heroImageUrl}
              />
              <p className="text-[10px] text-muted-foreground">
                Optional. Wide image (~1600×400) shown as backdrop on your league&apos;s public page.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-xs">
                Email
              </Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                placeholder="hello@yourleague.com"
                defaultValue={tenant?.contact_email ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="text-xs">
                Phone
              </Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                placeholder="+91 98765 43210"
                defaultValue={tenant?.contact_phone ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="flame" size="lg">
            <Save className="h-4 w-4" />
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function Req() {
  return <span className="text-destructive">*</span>;
}
