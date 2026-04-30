import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roleEnum } from './enums';
import { tenants } from './tenants';

/**
 * `profiles` mirrors `auth.users` (managed by Supabase) one-to-one.
 * On signup, a trigger inserts a row here with role + tenant. RLS allows users
 * to read their own row and superadmins to read all.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  role: roleEnum('role').default('user').notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
