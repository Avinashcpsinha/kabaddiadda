import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['user', 'organiser', 'superadmin']);

export const tenantStatusEnum = pgEnum('tenant_status', [
  'pending',
  'active',
  'suspended',
  'archived',
]);

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'league',
  'knockout',
  'group_knockout',
  'double_elimination',
]);

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft',
  'registration',
  'scheduled',
  'live',
  'completed',
  'cancelled',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'live',
  'half_time',
  'completed',
  'abandoned',
]);

export const matchEventTypeEnum = pgEnum('match_event_type', [
  'raid_point',
  'tackle_point',
  'bonus_point',
  'super_raid',
  'super_tackle',
  'all_out',
  'do_or_die_raid',
  'technical_point',
  'empty_raid',
  'review',
  'time_out',
  'substitution',
  'green_card',
  'yellow_card',
  'red_card',
  'card_expired',
  'injury_timeout',
  'review_upheld',
  'review_overturned',
  'golden_raid',
  'match_end',
  'lineup_set',
]);

export const playerRoleEnum = pgEnum('player_role', [
  'raider',
  'all_rounder',
  'defender_corner',
  'defender_cover',
]);

export const playerMatchStateEnum = pgEnum('player_match_state', [
  'on_mat',
  'bench',
  'out',
  'suspended',
  'red_carded',
  'injured',
]);
