import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { matchEventTypeEnum } from './enums';
import { matches } from './matches';
import { tenants } from './tenants';

export const matchEvents = pgTable('match_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  type: matchEventTypeEnum('type').notNull(),
  /** Half the event happened in (1, 2, or 3+ for super-overs). */
  half: integer('half').notNull(),
  /** Seconds into the half when the event occurred. */
  clockSeconds: integer('clock_seconds').notNull(),
  raiderId: uuid('raider_id'),
  defenderIds: jsonb('defender_ids').$type<string[]>(),
  /** Players revived by this event (FIFO from the out queue). */
  revivedPlayerIds: jsonb('revived_player_ids').$type<string[]>(),
  pointsAttacker: integer('points_attacker').default(0).notNull(),
  pointsDefender: integer('points_defender').default(0).notNull(),
  isSuperRaid: boolean('is_super_raid').default(false).notNull(),
  isSuperTackle: boolean('is_super_tackle').default(false).notNull(),
  isAllOut: boolean('is_all_out').default(false).notNull(),
  /** Groups events that belong to the same raid (touch + bonus + outcome share a seq). NULL for non-raid events. */
  raidSeq: integer('raid_seq'),
  /** 'green' | 'yellow' | 'red' for card events; NULL otherwise. */
  cardColor: text('card_color'),
  /** Loose extra data: substitution player_in/player_out, review reason, etc. */
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
});

export type MatchEvent = typeof matchEvents.$inferSelect;
export type NewMatchEvent = typeof matchEvents.$inferInsert;
