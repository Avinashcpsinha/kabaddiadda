import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { playerRoleEnum } from './enums';
import { tenants } from './tenants';
import { teams } from './teams';
import { people } from './people';

/**
 * A `players` row is a roster entry: a person on a team for a particular
 * tournament. Identity (mobile / PAN / Aadhaar) lives on the linked `people`
 * row — the same person can have many roster entries across leagues.
 *
 * full_name and photo_url are denormalised here as a per-roster cache. They
 * default to the person's values at creation time, and can be customised
 * (e.g. nickname for a particular league).
 */
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  /** Links to the canonical person. NULL for guest entries without mobile. */
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  userId: uuid('user_id'),
  fullName: text('full_name').notNull(),
  jerseyNumber: integer('jersey_number'),
  role: playerRoleEnum('role').default('all_rounder').notNull(),
  heightCm: integer('height_cm'),
  weightKg: integer('weight_kg'),
  dob: text('dob'),
  isCaptain: boolean('is_captain').default(false).notNull(),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
