export const ROLES = ['user', 'organiser', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

export function isOrganiserOrAbove(role: Role): boolean {
  return role === 'organiser' || role === 'superadmin';
}

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin';
}
