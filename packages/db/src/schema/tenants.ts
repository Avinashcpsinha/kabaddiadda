import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantStatusEnum } from './enums';

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
