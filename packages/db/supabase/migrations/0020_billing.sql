-- ===================================================================
-- 0020: Billing — plan storage, invoices, webhook event log
-- ===================================================================
--
-- Adds the persistence layer for paid subscriptions. The provider
-- (Razorpay first, Stripe later) is opaque to the schema — we only
-- store the foreign IDs and let the provider abstraction in
-- apps/web/src/lib/billing handle protocol differences.
--
-- Three concerns split across this migration:
--   1. tenants: which plan + status the tenant is on, plus the
--      provider-side IDs so cancel/change/sync operations can find
--      the right subscription record.
--   2. invoices: a local mirror of provider invoices so the billing
--      UI can render history without an extra API call per page load.
--   3. billing_events: every webhook delivery is logged here keyed by
--      provider event ID. Idempotency: if the same event is delivered
--      twice (which providers do), the second insert hits the unique
--      constraint and we skip processing.

-- 1. ENUMS ----------------------------------------------------------

do $$ begin
  create type tenant_plan as enum ('free', 'pro', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_plan_status as enum (
    'free',                  -- never subscribed (default)
    'active',                -- subscription is current and paid
    'trialing',              -- trial period (unused for now, here for forward compat)
    'past_due',              -- payment failed, retrying
    'cancel_at_period_end',  -- user cancelled, access until plan_renews_at
    'cancelled',             -- subscription terminated, dropped to free
    'paused'                 -- provider-paused (rare)
  );
exception when duplicate_object then null; end $$;

-- 2. PLAN COLUMNS ON TENANTS ----------------------------------------

alter table public.tenants
  add column if not exists plan tenant_plan not null default 'free',
  add column if not exists plan_status tenant_plan_status not null default 'free',
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_renews_at timestamptz,
  add column if not exists plan_canceled_at timestamptz,
  add column if not exists plan_provider text,                  -- 'razorpay' | 'stripe'
  add column if not exists plan_provider_customer_id text,      -- razorpay customer id
  add column if not exists plan_provider_subscription_id text;  -- razorpay subscription id

create index if not exists idx_tenants_plan on public.tenants (plan);
create index if not exists idx_tenants_plan_provider_sub
  on public.tenants (plan_provider_subscription_id)
  where plan_provider_subscription_id is not null;

-- 3. INVOICES TABLE -------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,                              -- 'razorpay' | 'stripe'
  provider_invoice_id text not null,                   -- e.g. razorpay invoice id 'inv_…'
  provider_subscription_id text,                       -- subscription that generated this
  amount_minor integer not null,                       -- in paise / cents (4999 INR = 499900)
  currency text not null default 'INR',
  status text not null,                                -- 'paid' | 'issued' | 'pending' | 'cancelled' | 'expired'
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  hosted_url text,                                     -- short_url from provider for receipt download
  pdf_url text,                                        -- provider invoice PDF when available
  raw_payload jsonb,                                   -- keep the full provider object for audit
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (provider, provider_invoice_id)
);

create index if not exists idx_invoices_tenant on public.invoices (tenant_id, created_at desc);

alter table public.invoices enable row level security;

-- Tenant members (organisers/superadmins of this tenant) can read invoices.
-- The link is profiles.tenant_id; we treat any profile row with the matching
-- tenant_id as a member. Read-only — only the webhook (service role) inserts.
do $$ begin
  create policy invoices_read on public.invoices
    for select using (
      tenant_id in (
        select tenant_id from public.profiles
        where id = auth.uid() and tenant_id is not null
      )
      or public.is_superadmin()
    );
exception when duplicate_object then null; end $$;

-- 4. BILLING_EVENTS TABLE -------------------------------------------

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,                     -- razorpay 'x-razorpay-event-id' header value
  event_type text not null,                            -- 'subscription.activated', etc.
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default clock_timestamp(),
  unique (provider, provider_event_id)
);

create index if not exists idx_billing_events_tenant
  on public.billing_events (tenant_id, created_at desc);
create index if not exists idx_billing_events_unprocessed
  on public.billing_events (created_at)
  where processed_at is null;

alter table public.billing_events enable row level security;

-- Superadmin reads only. Tenants don't see their webhook log; they see
-- the resulting plan/invoice state. The webhook handler runs as
-- service-role and bypasses RLS.
do $$ begin
  create policy billing_events_superadmin_read on public.billing_events
    for select using (public.is_superadmin());
exception when duplicate_object then null; end $$;
