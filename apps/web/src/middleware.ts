import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';
import { getTenantFromRequest } from '@/lib/tenant';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/auth'];
const PROTECTED_PREFIXES = ['/feed', '/organiser', '/admin', '/settings'];

// Module-scoped cache for custom-domain → tenant slug lookups. Edge runtime
// restarts wipe this, but within a hot instance it spares us a DB query
// on every request to a custom domain. 10 minute TTL.
const CUSTOM_DOMAIN_CACHE = new Map<string, { slug: string | null; expiresAt: number }>();
const CUSTOM_DOMAIN_TTL_MS = 10 * 60 * 1000;

async function resolveCustomDomain(host: string): Promise<string | null> {
  const cached = CUSTOM_DOMAIN_CACHE.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.slug;

  // Anonymous client — custom_domain lookup hits a publicly-readable column
  // (tenants.tenants_read policy allows status='active' for anon).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  const { data } = await supabase
    .from('tenants')
    .select('slug')
    .eq('custom_domain', host)
    .eq('status', 'active')
    .maybeSingle();

  const slug = data?.slug ?? null;
  CUSTOM_DOMAIN_CACHE.set(host, { slug, expiresAt: Date.now() + CUSTOM_DOMAIN_TTL_MS });
  return slug;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const tenant = getTenantFromRequest(request);
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // Custom domain handling: if the host doesn't match the configured root
  // domain or any localhost variant, look it up in tenants.custom_domain.
  // On a hit, internally rewrite to /t/[slug]{remainder} so the existing
  // public tenant pages handle it without any extra routing.
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '').replace(/:\d+$/, '');
  const cleanHost = host.replace(/:\d+$/, '');
  const isOurDomain =
    !rootDomain ||
    cleanHost === rootDomain ||
    cleanHost.endsWith('.' + rootDomain) ||
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost.endsWith('.vercel.app');

  if (!isOurDomain && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const customSlug = await resolveCustomDomain(cleanHost);
    if (customSlug) {
      const url = request.nextUrl.clone();
      // /xyz on a custom domain becomes /t/{slug}/xyz internally
      url.pathname = pathname === '/' ? `/t/${customSlug}` : `/t/${customSlug}${pathname}`;
      const rewritten = NextResponse.rewrite(url);
      rewritten.headers.set('x-tenant-slug', customSlug);
      rewritten.headers.set('x-tenant-is-root', 'false');
      rewritten.headers.set('x-custom-domain', cleanHost);
      return rewritten;
    }
    // Unknown custom domain — fall through; if it's truly unknown the page
    // will 404. Don't redirect, that would break domain-verification probes.
  }

  // Expose tenant slug to downstream RSCs via a request header.
  supabaseResponse.headers.set('x-tenant-slug', tenant.slug ?? '');
  supabaseResponse.headers.set('x-tenant-is-root', String(tenant.isRoot));

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  // Suppress unused-var warning when both flags are evaluated.
  void isPublic;

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - any file with an extension (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
