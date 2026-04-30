import { jsonb, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { matches } from './matches';
import { players } from './players';
import { teams } from './teams';
import { tenants } from './tenants';

/**
 * Per-match, per-team lineup. The 7 starters and the bench substitutes
 * for one team in one match. `locked_at` is set when the match starts
 * (via `initialize_match_player_state`), after which the lineup is frozen
 * and changes happen via substitution events.
 */
export const matchLineups = pgTable(
  'match_lineups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    startingPlayerIds: jsonb('starting_player_ids').$type<string[]>().notNull().default([]),
    benchPlayerIds: jsonb('bench_player_ids').$type<string[]>().notNull().default([]),
    captainId: uuid('captain_id').references(() => players.id, { onDelete: 'set null' }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqMatchTeam: unique().on(t.matchId, t.teamId),
  }),
);

export type MatchLineup = typeof matchLineups.$inferSelect;
export type NewMatchLineup = typeof matchLineups.$inferInsert;
