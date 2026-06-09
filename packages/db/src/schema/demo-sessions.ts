import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/**
 * A `demo_sessions` row records who launched the instant "Try live
 * scoring" demo: their name (+ optional mobile/email) and the ephemeral
 * demo tenant they were given. tenant_id is ON DELETE SET NULL so the
 * lead survives the nightly demo-tenant cleanup. Distinct from
 * demo_requests (the "Book a Demo" form).
 */
export const demoSessions = pgTable('demo_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  mobile: text('mobile'),
  email: text('email'),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  pageUrl: text('page_url'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DemoSession = typeof demoSessions.$inferSelect;
export type NewDemoSession = typeof demoSessions.$inferInsert;
