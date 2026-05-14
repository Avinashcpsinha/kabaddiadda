'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashboardPathForRole, getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DEMO_EMAIL, DEMO_LANDING_PATH, DEMO_PASSWORD } from '@/lib/demo';
import { loginSchema, signupSchema } from '@kabaddiadda/shared';

export async function signInAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');

  const session = await getSessionUser();
  redirect(session ? dashboardPathForRole(session.role) : '/feed');
}

export async function signUpAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    role: formData.get('role') ?? 'user',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    },
  });
  if (error) return { error: error.message };

  // With "Confirm email" disabled in Supabase, signUp returns a live session —
  // sign the user straight in and redirect to their dashboard.
  if (data.session) {
    revalidatePath('/', 'layout');
    const session = await getSessionUser();
    redirect(session ? dashboardPathForRole(session.role) : '/feed');
  }

  // If we reach here, Supabase still has email confirmation switched on at
  // the project level — flip it off in Auth → Providers → Email.
  return { error: 'Account created but could not sign you in. Please log in.' };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * One-click sign-in as the demo organiser, then drop the user straight into
 * the live scoring console. Credentials are imported server-side from
 * @/lib/demo and never flow through the client — the homepage button just
 * triggers this action.
 */
export async function signInAsDemoAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect(DEMO_LANDING_PATH);
}
