/**
 * DEV-ONLY demo account credentials.
 *
 * Imported by both the dev-actions server module (to provision + sign in)
 * and the dev quick-login UI (to display credentials). Lives in its own file
 * because `'use server'` files can only export async functions.
 *
 * These accounts only ever exist on local Supabase projects; the login page
 * itself is hidden in production builds.
 */

import type { Role } from '@kabaddiadda/shared';

export type DevRole = 'fan' | 'organiser' | 'superadmin';

export interface DevAccount {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  /** Organiser only: demo league we auto-create + link the user to. */
  tenantSlug?: string;
  tenantName?: string;
}

export const DEV_ACCOUNTS: Record<DevRole, DevAccount> = {
  fan: {
    email: 'fan@kabaddiadda.dev',
    password: 'KabaddiFan-Demo!',
    fullName: 'Demo Fan',
    role: 'user',
  },
  organiser: {
    email: 'organiser@kabaddiadda.dev',
    password: 'KabaddiOrg-Demo!',
    fullName: 'Demo Organiser',
    role: 'organiser',
    tenantSlug: 'demo-league',
    tenantName: 'Demo Kabaddi League',
  },
  superadmin: {
    email: 'admin@kabaddiadda.dev',
    password: 'KabaddiAdmin-Demo!',
    fullName: 'Platform Superadmin',
    role: 'superadmin',
  },
};
