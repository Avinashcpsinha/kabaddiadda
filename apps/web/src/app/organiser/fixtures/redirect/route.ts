import { NextResponse, type NextRequest } from 'next/server';

// Tiny redirect endpoint: the Fixtures page form posts here with ?t=<tournamentId>
// and we forward to that tournament's per-tournament fixtures page where the
// AddMatchForm lives.
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tournamentId = url.searchParams.get('t');
  if (!tournamentId) return NextResponse.redirect(new URL('/organiser/fixtures', req.url));
  return NextResponse.redirect(
    new URL(`/organiser/tournaments/${tournamentId}/fixtures`, req.url),
  );
}
