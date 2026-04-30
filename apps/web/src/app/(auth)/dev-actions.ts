'use server';

/**
 * DEVELOPMENT ONLY — server actions for the demo-account quick-login flow.
 * The actions here use the service-role key (admin client) so they MUST be
 * guarded by NODE_ENV !== 'production'. The Login page also hides its dev
 * block in prod builds.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { dashboardPathForRole } from '@/lib/auth';
import { DEV_ACCOUNTS, type DevAccount, type DevRole } from './dev-accounts.config';

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureDevAccount(account: DevAccount): Promise<string> {
  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, account.email);

  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role },
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  await admin
    .from('profiles')
    .upsert(
      { id: userId, email: account.email, full_name: account.fullName, role: account.role },
      { onConflict: 'id' },
    );

  if (account.role === 'organiser' && account.tenantSlug) {
    const { data: tenant } = await admin
      .from('tenants')
      .upsert(
        {
          slug: account.tenantSlug,
          name: account.tenantName!,
          status: 'active',
          owner_id: userId,
          contact_email: account.email,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();

    if (tenant) {
      await admin.from('profiles').update({ tenant_id: tenant.id }).eq('id', userId);
    }
  }

  return userId;
}

export async function devSignInAction(role: DevRole) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Dev quick-login is disabled in production.' };
  }

  const account = DEV_ACCOUNTS[role];
  if (!account) return { error: 'Unknown role' };

  try {
    await ensureDevAccount(account);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to provision demo account',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect(dashboardPathForRole(account.role));
}
