import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `people` is the canonical record of a human on the platform. Mobile is
 * the global identity (UNIQUE). One person can be rostered into many teams
 * across many tenants — those rosters live in `players`.
 */
export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  mobile: text('mobile').notNull().unique(),
  fullName: text('full_name').notNull(),
  photoUrl: text('photo_url'),
  email: text('email'),
  /** PII — encrypt at rest for production. */
  pan: text('pan'),
  /** PII — UIDAI-regulated. Encrypt and consider replacing with verification ID. */
  aadhaar: text('aadhaar'),
  dob: date('dob'),
  /** auth.users.id once this person signs up. NULL for guest-registered players. */
  userId: uuid('user_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
