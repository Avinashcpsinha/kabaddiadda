import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getTenantFromRequest } from '@/lib/tenant';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/auth'];
const PROTECTED_PREFIXES = ['/feed', '/organiser', '/admin', '/settings'];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const tenant = getTenantFromRequest(request);
  const { pathname } = request.nextUrl;

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
