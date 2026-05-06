import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Mirrors apps/web/src/lib/auth.ts SessionUser shape so any code we
// share between platforms talks about the same thing.
export interface MobileSessionUser {
  id: string;
  email: string;
  role: 'user' | 'organiser' | 'superadmin';
  tenantId: string | null;
  fullName: string | null;
}

interface SessionState {
  loading: boolean;
  session: Session | null;
  user: MobileSessionUser | null;
}

// Reads the current Supabase session and the matching profile row, then
// keeps both in sync via onAuthStateChange. Profile re-fetched whenever
// the auth user id changes (sign-in / sign-out / token refresh with new
// claims). Components that need the latest tenant_id after the user
// finishes the setup screen call refetch() to force a re-read.
export function useSession() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
  });

  async function loadProfile(session: Session | null): Promise<MobileSessionUser | null> {
    if (!session) return null;
    const { user } = session;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      // The handle_new_user trigger creates the row, but during the few
      // ms between auth.signUp and the trigger firing we may see no row
      // yet. Return a synthetic so the UI can still route.
      return {
        id: user.id,
        email: user.email ?? '',
        role: 'user',
        tenantId: null,
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      };
    }

    return {
      id: profile.id,
      email: user.email ?? '',
      role: (profile.role as MobileSessionUser['role']) ?? 'user',
      tenantId: profile.tenant_id ?? null,
      fullName: profile.full_name ?? null,
    };
  }

  async function refetch() {
    const { data } = await supabase.auth.getSession();
    const user = await loadProfile(data.session);
    setState({ loading: false, session: data.session, user });
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = await loadProfile(data.session);
      if (!mounted) return;
      setState({ loading: false, session: data.session, user });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = await loadProfile(session);
      if (!mounted) return;
      setState({ loading: false, session, user });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { ...state, refetch };
}
