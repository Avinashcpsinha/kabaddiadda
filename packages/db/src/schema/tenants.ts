import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantStatusEnum, tenantPlanEnum, tenantPlanStatusEnum } from './enums';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  customDomain: text('custom_domain').unique(),
  logoUrl: text('logo_url'),
  status: tenantStatusEnum('status').default('pending').notNull(),
  branding: jsonb('branding').$type<{
    primaryColor?: string;
    secondaryColor?: string;
    coverImage?: string;
  }>(),
  ownerId: uuid('owner_id'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  plan: tenantPlanEnum('plan').default('free').notNull(),
  planStatus: tenantPlanStatusEnum('plan_status').default('free').notNull(),
  planStartedAt: timestamp('plan_started_at', { withTimezone: true }),
  planRenewsAt: timestamp('plan_renews_at', { withTimezone: true }),
  planCanceledAt: timestamp('plan_canceled_at', { withTimezone: true }),
  planProvider: text('plan_provider'),
  planProviderCustomerId: text('plan_provider_customer_id'),
  planProviderSubscriptionId: text('plan_provider_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
