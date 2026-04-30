import { z } from 'zod';
import { ROLES } from './roles';

const slug = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Use lowercase letters, numbers, and hyphens only.');

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});

export const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  fullName: z.string().min(2, 'Tell us your name').max(80),
  role: z.enum(['user', 'organiser']).default('user'),
});

export const tenantCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug,
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

export const tournamentCreateSchema = z.object({
  name: z.string().min(2).max(120),
  slug,
  description: z.string().max(2000).optional(),
  format: z.enum(['league', 'knockout', 'group_knockout', 'double_elimination']),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  registrationDeadline: z.string().datetime().optional(),
  maxTeams: z.number().int().min(2).max(256).optional(),
  entryFee: z.number().int().min(0).optional(),
  prizePool: z.number().int().min(0).optional(),
});

export const teamCreateSchema = z.object({
  name: z.string().min(2).max(80),
  shortName: z.string().max(8).optional(),
  city: z.string().max(80).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

/** India mobile: 10–15 digits, optional leading +. */
export const mobileSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid mobile number (10–15 digits, + allowed)');

/** PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter). */
export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F (uppercase)');

/** Aadhaar: exactly 12 digits, no spaces. */
export const aadhaarSchema = z
  .string()
  .regex(/^[0-9]{12}$/, 'Aadhaar must be exactly 12 digits, no spaces');

export const playerCreateSchema = z.object({
  fullName: z.string().min(2).max(80),
  jerseyNumber: z.number().int().min(0).max(999).optional(),
  role: z
    .enum(['raider', 'all_rounder', 'defender_corner', 'defender_cover'])
    .default('all_rounder'),
  heightCm: z.number().int().min(120).max(230).optional(),
  weightKg: z.number().int().min(30).max(150).optional(),
  isCaptain: z.boolean().default(false),
  mobile: mobileSchema.optional(),
  pan: panSchema.optional(),
  aadhaar: aadhaarSchema.optional(),
});

export const matchEventSchema = z.object({
  matchId: z.string().uuid(),
  type: z.enum([
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
  ]),
  half: z.number().int().min(1).max(4),
  clockSeconds: z.number().int().min(0).max(99 * 60),
  raiderId: z.string().uuid().optional(),
  defenderIds: z.array(z.string().uuid()).optional(),
  pointsAttacker: z.number().int().min(0).max(10).default(0),
  pointsDefender: z.number().int().min(0).max(10).default(0),
  isSuperRaid: z.boolean().default(false),
  isSuperTackle: z.boolean().default(false),
  isAllOut: z.boolean().default(false),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone: z.string().optional(),
  role: z.enum(ROLES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>;
export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type PlayerCreateInput = z.infer<typeof playerCreateSchema>;
export type MatchEventInput = z.infer<typeof matchEventSchema>;
