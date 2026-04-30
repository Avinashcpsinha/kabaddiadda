-- =====================================================================
-- Phase 1 — extra RLS policies for self-service organiser onboarding.
-- Run this AFTER 0001_init.sql.
-- =====================================================================

-- Allow any authenticated user to create a tenant of which they're the owner.
-- This powers the /organiser/setup flow where a new organiser claims their
-- league. Without this, only superadmins could create tenants.
drop policy if exists tenants_self_create on public.tenants;
create policy tenants_self_create on public.tenants
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Block users from escalating their own role. Profile updates are still
-- allowed (display name, phone, tenant_id), but the role column requires the
-- caller to either be a superadmin OR not change the value.
create or replace function public.profiles_role_unchanged() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.role is distinct from old.role and not public.is_superadmin() then
    raise exception 'role can only be changed by a superadmin';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function public.profiles_role_unchanged();
