import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tournamentFormatEnum, tournamentStatusEnum } from './enums';
import { tenants } from './tenants';

export const tournaments = pgTable('tournaments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  format: tournamentFormatEnum('format').notNull(),
  status: tournamentStatusEnum('status').default('draft').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),
  maxTeams: integer('max_teams'),
  entryFee: integer('entry_fee'),
  prizePool: integer('prize_pool'),
  rules: jsonb('rules').$type<{ raidTime?: number; halfDuration?: number; teamSize?: number }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
