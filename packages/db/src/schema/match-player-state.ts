import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { playerMatchStateEnum } from './enums';
import { matches } from './matches';
import { players } from './players';
import { teams } from './teams';
import { tenants } from './tenants';

/**
 * Live state of every rostered player in a single match. Maintained by
 * `initialize_match_player_state(match_id)` at kick-off and (in a later
 * migration) by triggers that react to match_events.
 *
 * `out_seq` orders the revival queue: the player with the lowest out_seq
 * for a team revives next when that team scores.
 */
export const matchPlayerState = pgTable(
  'match_player_state',
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
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    state: playerMatchStateEnum('state').default('bench').notNull(),
    outSeq: integer('out_seq'),
    suspendedUntilSeconds: integer('suspended_until_seconds'),
    suspendedUntilHalf: integer('suspended_until_half'),
    lastEventId: uuid('last_event_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqMatchPlayer: unique().on(t.matchId, t.playerId),
  }),
);

export type MatchPlayerState = typeof matchPlayerState.$inferSelect;
export type NewMatchPlayerState = typeof matchPlayerState.$inferInsert;
