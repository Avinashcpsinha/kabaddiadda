import { getSessionUser } from '@/lib/auth';
import { TryDemoFabClient } from './try-demo-fab-client';

/**
 * Server wrapper around the demo FAB — checks for a logged-in user and
 * suppresses the button if one is present. We don't want a real organiser
 * accidentally clicking "Try live scoring" and getting bounced into an
 * ephemeral demo session (losing their session in the process).
 */
export async function TryDemoFab() {
  const user = await getSessionUser();
  if (user) return null;
  return <TryDemoFabClient />;
}
