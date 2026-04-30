# Architecture overview

## Request flow (web)

```
User browser
   │
   ▼
[ Vercel Edge ] ──► Next.js middleware (apps/web/src/middleware.ts)
                    ├─ updateSession() ──► refresh Supabase JWT cookies
                    └─ getTenantFromRequest() ──► sets x-tenant-slug header
   │
   ▼
[ Next.js App Router ]
   ├─ Server Components ──► lib/supabase/server.ts (cookie-bound, RLS-enforced)
   ├─ Server Actions    ──► same client, secure mutations
   └─ Client Components ──► lib/supabase/client.ts (browser, RLS-enforced)
   │
   ▼
[ Supabase Postgres ]
   └─ Row-Level Security policies (auth.uid(), is_tenant_organiser, is_superadmin)
```

## Why RLS, not application checks?

In a multitenant app, "did the application remember to filter by `tenant_id` in this query?" is the bug class that leaks data across tenants. We push tenant isolation into Postgres so:

- Every query — including ones we forget to scope — returns only the caller's tenant rows.
- A compromised application key (anon JWT) still can't read another tenant's data.
- New developers can't accidentally bypass scoping by writing `select * from teams`.

The `service_role` key is the one exception — it bypasses RLS by design. We isolate its use to `lib/supabase/admin.ts` and never import that file from a Client Component.

## Realtime / live scoring

When a scorer presses "Raid Point" in the organiser console:

1. Server Action calls `supabase.from('match_events').insert({...})`.
2. RLS confirms the user is `is_tenant_organiser(tenant_id)`.
3. Postgres triggers update `matches.home_score`/`away_score`.
4. Supabase Realtime broadcasts the row change on `postgres_changes` channel `match:{id}`.
5. Every spectator subscribed (web + mobile) sees the score update within ~150ms.

We chose this over self-hosting WebSockets because (a) Vercel can't run a long-lived WS server in a Function, and (b) Supabase's Realtime is postgres-native, so the source of truth and the broadcast are the same row.

## Tenant resolution

```
Host                            → tenant
pkl.kabaddiadda.com             → slug=pkl
bengal.kabaddiadda.com          → slug=bengal
www.kabaddiadda.com             → root (slug=null)
kabaddiadda.com                 → root (slug=null)
league.example.com (custom)     → looked up in tenants.custom_domain
localhost:3000                  → root (dev fallback)
```

The middleware sets `x-tenant-slug` on the response headers; Server Components read it via `headers()` to scope their queries (in addition to RLS).

## Data ownership

- **Tenant-scoped** (every row has `tenant_id`): tournaments, teams, players, venues, matches, match_events.
- **Global**: tenants, profiles, audit_log. (Profiles have a nullable `tenant_id` — used for organiser staff.)
- **Auth**: `auth.users` is managed by Supabase. We mirror it into `public.profiles` via the `handle_new_user()` trigger.

## Why Drizzle alongside Supabase?

- Drizzle gives us **typed schema** + reproducible migrations checked into git.
- The Supabase JS client gives us **RLS-enforced reads/writes** in user code.
- We write the schema once in `packages/db/src/schema/*.ts`, generate migrations, and apply them via `supabase db push` (or paste into the SQL Editor).
