import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { coachRoleEnum } from './enums';
import { tenants } from './tenants';
import { teams } from './teams';
import { people } from './people';

/**
 * A `coaches` row is a staff entry: a person coaching a team for a
 * particular tournament. It mirrors `players` — identity (mobile / PII /
 * photo / app login) lives on the linked `people` row, so the same human
 * can coach many teams across leagues, or coach one team and play for
 * another, all under one `people` record.
 *
 * Coaches live entirely outside the match engine — no jersey, lineup,
 * or scoring state.
 *
 * full_name / photo_url are denormalised here as a per-team cache,
 * exactly like players.full_name / players.photo_url.
 */
export const coaches = pgTable('coaches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  /** Links to the canonical person. NULL for guest entries without mobile. */
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  fullName: text('full_name').notNull(),
  role: coachRoleEnum('role').default('head_coach').notNull(),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Coach = typeof coaches.$inferSelect;
export type NewCoach = typeof coaches.$inferInsert;
