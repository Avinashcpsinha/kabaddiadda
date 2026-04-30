import { createClient } from '@/lib/supabase/server';
import { Role } from '@kabaddiadda/shared';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
  fullName: string | null;
}

/**
 * Returns the current authenticated user with their resolved role + tenant.
 * Returns null if not signed in. Reads from Postgres `profiles` table.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? '',
      role: 'user',
      tenantId: null,
      fullName: null,
    };
  }

  return {
    id: profile.id,
    email: user.email ?? '',
    role: (profile.role as Role) ?? 'user',
    tenantId: profile.tenant_id ?? null,
    fullName: profile.full_name ?? null,
  };
}

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case 'superadmin':
      return '/admin';
    case 'organiser':
      return '/organiser';
    case 'user':
    default:
      return '/feed';
  }
}
