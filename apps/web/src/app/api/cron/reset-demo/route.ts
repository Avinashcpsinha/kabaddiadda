import { NextResponse, type NextRequest } from 'next/server';
import { reseedDemoTenant } from '@/lib/demo-seed';

/**
 * Nightly cron — resets the demo tenant to its canonical seeded state.
 *
 * Scheduled via vercel.json (3:00 IST / 21:30 UTC by default). Vercel cron
 * adds an Authorization: Bearer header using CRON_SECRET, set in Vercel
 * project env vars. Any request without that header gets a 401 so this
 * endpoint can't be hit by random callers to wipe the demo.
 *
 * Manual run (e.g. from your laptop):
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
    const result = await reseedDemoTenant();
    return NextResponse.json({
      ok: true,
      resetAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error('Demo reset failed:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
