import { NextResponse, type NextRequest } from 'next/server';
import { cleanupExpiredDemoSessions } from '@/lib/demo-seed';

/**
 * Nightly cron — deletes demo organiser accounts (and their cascade-linked
 * tenants/data) older than 24 hours. Each "Try live scoring" click spawns
 * a new ephemeral account, so without this cleanup the auth user list
 * grows without bound.
 *
 * Scheduled via vercel.json (21:30 UTC / 03:00 IST). Vercel cron adds an
 * Authorization: Bearer header using CRON_SECRET (set in Vercel env vars).
 * Without that secret the endpoint stays locked.
 *
 * Manual run from your laptop:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-domain/api/cron/reset-demo
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredDemoSessions();
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error('Demo cleanup failed:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
