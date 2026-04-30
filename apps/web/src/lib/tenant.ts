import type { NextRequest } from 'next/server';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'static',
  'cdn',
  'assets',
  'mail',
  'docs',
]);

export interface TenantContext {
  /** The tenant slug from subdomain (e.g. "pkl") or null for the root site. */
  slug: string | null;
  /** True if this request is the platform root (kabaddiadda.com itself). */
  isRoot: boolean;
}

/**
 * Resolve the tenant from a request's host header.
 *
 *   pkl.kabaddiadda.com  → { slug: "pkl", isRoot: false }
 *   kabaddiadda.com      → { slug: null,  isRoot: true  }
 *   www.kabaddiadda.com  → { slug: null,  isRoot: true  }
 *   localhost:3000       → { slug: null,  isRoot: true  } (dev fallback)
 *
 * Custom domains (e.g. league.example.com pointing to a tenant) are resolved
 * at the DB layer in middleware — see middleware.ts.
 */
export function resolveTenantFromHost(host: string | null): TenantContext {
  if (!host) return { slug: null, isRoot: true };

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const cleanHost = host.replace(/:\d+$/, '');
  const cleanRoot = rootDomain.replace(/:\d+$/, '');

  // Localhost dev — no subdomain support without /etc/hosts; treat as root.
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return { slug: null, isRoot: true };
  }

  if (cleanHost === cleanRoot) return { slug: null, isRoot: true };

  if (cleanHost.endsWith('.' + cleanRoot)) {
    const sub = cleanHost.slice(0, -(cleanRoot.length + 1));
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return { slug: null, isRoot: true };
    return { slug: sub, isRoot: false };
  }

  // Unrecognised host — likely a custom domain. Caller should look it up.
  return { slug: null, isRoot: false };
}

export function getTenantFromRequest(request: NextRequest): TenantContext {
  return resolveTenantFromHost(request.headers.get('host'));
}
