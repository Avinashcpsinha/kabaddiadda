import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { matchStatusEnum } from './enums';
import { tenants } from './tenants';
import { teams } from './teams';
import { tournaments } from './tournaments';
import { venues } from './venues';

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  homeTeamId: uuid('home_team_id')
    .notNull()
    .references(() => teams.id),
  awayTeamId: uuid('away_team_id')
    .notNull()
    .references(() => teams.id),
  venueId: uuid('venue_id').references(() => venues.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: matchStatusEnum('status').default('scheduled').notNull(),
  homeScore: integer('home_score').default(0).notNull(),
  awayScore: integer('away_score').default(0).notNull(),
  currentHalf: integer('current_half').default(1).notNull(),
  /** Seconds elapsed in the current half (resets each half). */
  clockSeconds: integer('clock_seconds').default(0).notNull(),
  /** Free-text label e.g. "Quarter Final 1" or "Group A · Match 3". */
  round: text('round'),
  /** 1 = legacy "tap a button" console; 2 = new lineup-aware console. */
  scoringVersion: integer('scoring_version').default(1).notNull(),
  /** Monotonically increasing raid number — used to group raid_point + bonus_point into one logical raid. */
  currentRaidSeq: integer('current_raid_seq').default(0).notNull(),
  /** Consecutive empty raids by each side. Reset on any point that team scores; 2 means the next raid is do-or-die. */
  homeDodCounter: integer('home_dod_counter').default(0).notNull(),
  awayDodCounter: integer('away_dod_counter').default(0).notNull(),
  homeTimeoutsUsed: integer('home_timeouts_used').default(0).notNull(),
  awayTimeoutsUsed: integer('away_timeouts_used').default(0).notNull(),
  homeReviewsUsed: integer('home_reviews_used').default(0).notNull(),
  awayReviewsUsed: integer('away_reviews_used').default(0).notNull(),
  homeAllOuts: integer('home_all_outs').default(0).notNull(),
  awayAllOuts: integer('away_all_outs').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
