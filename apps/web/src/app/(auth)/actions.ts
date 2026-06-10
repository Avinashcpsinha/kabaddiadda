'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashboardPathForRole, getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDemoSession } from '@/lib/demo-seed';
import { sendMail } from '@/lib/email/mailer';
import { resetPasswordEmail, welcomeEmail } from '@/lib/email/templates';
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
    // Send a branded welcome email via our own SMTP. Never let a mail failure
    // block registration — the user is already signed in at this point.
    try {
      const mail = welcomeEmail({
        name: parsed.data.fullName,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
      });
      await sendMail({ to: parsed.data.email, ...mail });
    } catch (err) {
      console.error('[signup] welcome email failed', err);
    }

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
 * Forgot-password: mint a recovery token via the admin client and email a
 * branded reset link through our own SMTP. We deliberately return the same
 * generic success regardless of whether the email exists, to avoid leaking
 * which addresses have accounts (no account enumeration).
 */
export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { error: 'Enter a valid email address.' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password` },
    });

    // generateLink errors for unknown emails — swallow it so the response is
    // identical for existing and non-existing accounts.
    const tokenHash = data?.properties?.hashed_token;
    if (!error && tokenHash) {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token_hash=${tokenHash}&type=recovery`;
      const mail = resetPasswordEmail({ resetUrl });
      await sendMail({ to: email, ...mail });
    }
  } catch (err) {
    console.error('[forgot-password] failed', err);
  }

  return { ok: true as const };
}

/**
 * One-click "Try live scoring" — provisions a fresh, isolated demo organiser
 * account + seeded league for THIS visitor, then signs them in. Each click
 * spawns its own tenant so concurrent visitors never collide. Sessions
 * older than 24 hours are reaped by /api/cron/reset-demo.
 */
export async function tryDemoAction(formData?: FormData) {
  const str = (k: string) => {
    const v = formData?.get(k);
    const s = typeof v === 'string' ? v.trim() : '';
    return s || undefined;
  };
  const session = await createDemoSession({
    name: str('name'),
    mobile: str('mobile'),
    email: str('email'),
    pageUrl: str('page_url'),
    userAgent: str('user_agent'),
  });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: session.password,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect(session.liveMatchPath);
}
