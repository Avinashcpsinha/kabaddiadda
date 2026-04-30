# Kabaddiadda

A multitenant Kabaddi platform — web + mobile, three interfaces (General User, Organiser, Superadmin), built on Next.js 15, Supabase, and React Native.

## Stack

| Layer       | Tech                                                                            |
| ----------- | ------------------------------------------------------------------------------- |
| Web         | Next.js 15 (App Router) · Tailwind v4 · shadcn/ui · Geist font                  |
| Mobile      | Expo · React Native · expo-router                                               |
| Database    | Supabase Postgres with Row-Level Security (multitenant via `tenant_id`)         |
| Auth        | Supabase Auth (email + password, OAuth, magic links)                            |
| Realtime    | Supabase Realtime (postgres LISTEN/NOTIFY) — powers live scoring                |
| Storage     | Supabase Storage                                                                |
| ORM         | Drizzle (for migrations + types). Reads/writes go through Supabase JS so RLS is enforced. |
| Hosting     | Vercel (web) · Expo EAS (mobile)                                                |
| Background  | Inngest (planned, Phase 5)                                                      |

## Repository layout

```
.
├── apps/
│   ├── web/              Next.js 15 app — landing, auth, three role dashboards
│   └── mobile/           Expo app — fan feed, live match view, scoring (Phase 4)
├── packages/
│   ├── db/               Drizzle schema + Supabase migration SQL (RLS, triggers)
│   └── shared/           Zod validators, role helpers, Kabaddi rule constants
├── package.json          pnpm workspace root
├── turbo.json            Turborepo task pipeline
└── .env.example          Reference for all env vars
```

## Getting started

### Prerequisites

- Node 20+, pnpm 9+. Enable via Corepack:
  - **macOS / Linux / Git Bash**: `corepack enable && corepack use pnpm@9.12.0`
  - **Windows PowerShell**: run as two lines — `corepack enable` then `corepack use pnpm@9.12.0` (PowerShell 5.1 doesn't support `&&`)
- A free [Supabase](https://supabase.com) project
- Optional: a [Vercel](https://vercel.com) account (we deploy from GitHub)

### 1. Install

```bash
pnpm install
```

### 2. Set up Supabase

1. Create a new project at supabase.com (free tier).
2. Open **SQL Editor** → paste contents of `packages/db/supabase/migrations/0001_init.sql` → run.
3. (Optional) Run `packages/db/supabase/seed.sql` for sample tournaments + teams.
4. **Settings → Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Add `http://localhost:3000/auth/callback` to redirect URLs.
5. **Settings → API**: copy the project URL, `anon` key, and `service_role` key.

### 3. Configure env

```bash
cp .env.example .env.local             # at the repo root
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the Supabase values. The repo-root `.env.local` is read by Drizzle migrations; the per-app `.env.local` is read by Next.js / Expo at runtime.

### 4. Run the web app

```bash
pnpm dev:web
# → http://localhost:3000
```

### 5. Run the mobile app

```bash
pnpm dev:mobile
# → scan the QR code with Expo Go
```

## Granting yourself superadmin

After signing up via the UI, run this in the Supabase SQL Editor:

```sql
update public.profiles set role = 'superadmin' where email = 'you@example.com';
```

Then visit `/admin`.

## Multitenancy model

- Every tenant-scoped table has a `tenant_id` column.
- `public.is_tenant_organiser(tenant_id)` and `public.is_superadmin()` are used inside RLS policies — Postgres enforces tenant isolation, not the application.
- Tenants are addressed by subdomain: `pkl.kabaddiadda.com`, `bengal.kabaddiadda.com`. The Next.js middleware reads the `Host` header and sets `x-tenant-slug`. In local dev (no subdomains without `/etc/hosts` tricks), the app falls back to the platform root.

## Three interfaces

| Path           | Role        | What you see                                                |
| -------------- | ----------- | ------------------------------------------------------------ |
| `/feed`        | user        | Fan home: live matches, followed teams, trending tournaments |
| `/organiser`   | organiser   | Tournament + team CRUD, fixtures, scoring console, billing   |
| `/admin`       | superadmin  | All tenants, plans, moderation, audit log, system health     |

## Roadmap

- [x] **Phase 0** — Foundations (auth, tenant resolver, RLS, role dashboards) ← **you are here**
- [ ] Phase 1 — Organiser MVP (tournament/team CRUD, fixtures)
- [ ] Phase 2 — General User web (browse, follow, results)
- [ ] Phase 3 — Live scoring (websockets via Supabase Realtime)
- [ ] Phase 4 — Mobile app (RN + Expo)
- [ ] Phase 5 — Superadmin & billing
- [ ] Phase 6 — Polish (highlights, custom domains)

## Deploy

### Web → Vercel

1. Push this repo to GitHub.
2. In Vercel, **Import Project** → select the repo.
3. **Root Directory**: `apps/web`. Build command and output dir auto-detect.
4. Paste env vars from `apps/web/.env.local`. Don't paste `SUPABASE_SERVICE_ROLE_KEY` to any client-side framework — it stays server-only.
5. In Supabase **Auth → URL Configuration**, add the Vercel preview/production URLs to redirect URLs.

### Mobile → Expo EAS

```bash
pnpm dlx eas-cli build --platform all --profile preview
```

## Security notes

- Never commit `.env.local` or any service-role key.
- The `service_role` key bypasses RLS — only use it from server-only code (`lib/supabase/admin.ts`). Never import it into a Client Component.
- Audit-log every sensitive action via `public.audit_log`.

## License

UNLICENSED — proprietary, all rights reserved (for now).
