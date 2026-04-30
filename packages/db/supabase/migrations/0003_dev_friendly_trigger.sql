-- =====================================================================
-- Phase 1.1 — make the role-escalation trigger compatible with admin writes.
-- Run this AFTER 0002_phase1.sql.
-- =====================================================================

-- The original trigger blocked any non-superadmin from changing `role`.
-- That includes the service-role connection (used by trusted server code +
-- dev seed scripts), because `auth.uid()` is NULL there and is_superadmin()
-- returns false. We treat NULL auth.uid() as "trusted server context" and let
-- it through. Regular user JWTs still cannot promote themselves.

create or replace function public.profiles_role_unchanged() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_superadmin() then
    raise exception 'role can only be changed by a superadmin';
  end if;
  return new;
end;
$$;
