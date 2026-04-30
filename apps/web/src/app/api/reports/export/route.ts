import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// CSV export for reports. Five types:
//   - tenant_summary  : tournaments + match counts + headline stats
//   - standings       : team standings within one tournament
//   - players         : per-player season stats within one tournament
//   - matches         : match list within one tournament
//   - match_events    : raw event log for one match (raid-by-raid)
//
// Auth: must be a tenant organiser. Tenant scope is enforced via the
// existing RLS policies on each query — we explicitly pass tenant_id
// as a defence-in-depth check before serving the file.

type ExportType = 'tenant_summary' | 'standings' | 'players' | 'matches' | 'match_events';

const VALID_TYPES: ExportType[] = [
  'tenant_summary',
  'standings',
  'players',
  'matches',
  'match_events',
];

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.tenantId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (user.role !== 'organiser' && user.role !== 'superadmin') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as ExportType | null;
  const tournamentId = searchParams.get('tournament');
  const matchId = searchParams.get('match');
  const tenantId = searchParams.get('tenant') ?? user.tenantId;

  if (!type || !VALID_TYPES.includes(type)) {
    return new NextResponse('Invalid type', { status: 400 });
  }

  // Cross-tenant access blocked unless superadmin
  if (tenantId !== user.tenantId && user.role !== 'superadmin') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  let csv: string;
  let filename: string;

  switch (type) {
    case 'tenant_summary': {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name, format, status, start_date, end_date')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false, nullsFirst: false });
      const { data: matchCounts } = await supabase
        .from('matches')
        .select('tournament_id, status')
        .eq('tenant_id', tenantId);

      const counts = new Map<string, { total: number; completed: number; live: number }>();
      for (const m of matchCounts ?? []) {
        const c = counts.get(m.tournament_id) ?? { total: 0, completed: 0, live: 0 };
        c.total += 1;
        if (m.status === 'completed') c.completed += 1;
        if (m.status === 'live') c.live += 1;
        counts.set(m.tournament_id, c);
      }

      const rows = (tournaments ?? []).map((t) => {
        const c = counts.get(t.id) ?? { total: 0, completed: 0, live: 0 };
        return [t.name, t.format, t.status, t.start_date ?? '', t.end_date ?? '', c.total, c.completed, c.live];
      });
      csv = toCsv(
        ['Tournament', 'Format', 'Status', 'Start', 'End', 'Matches', 'Completed', 'Live'],
        rows,
      );
      filename = `tenant-summary-${todayStamp()}.csv`;
      break;
    }
    case 'standings': {
      if (!tournamentId) return new NextResponse('Missing tournament param', { status: 400 });
      const { data } = await supabase
        .from('team_season_stats')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('league_points', { ascending: false })
        .order('points_diff', { ascending: false });
      const rows = (data ?? []).map((s, i) => [
        i + 1, s.team_name, s.matches_played, s.wins, s.draws, s.losses,
        s.points_for, s.points_against, s.points_diff, s.league_points,
      ]);
      csv = toCsv(
        ['Rank', 'Team', 'P', 'W', 'D', 'L', 'PF', 'PA', '+/-', 'Pts'],
        rows,
      );
      filename = `standings-${tournamentId}-${todayStamp()}.csv`;
      break;
    }
    case 'players': {
      if (!tournamentId) return new NextResponse('Missing tournament param', { status: 400 });
      const { data } = await supabase
        .from('player_season_stats')
        .select(
          'full_name, jersey_number, role, matches_played, raid_points, tackle_points, bonus_points, super_raids, super_tackles, empty_raids, dod_conversions, raid_success_pct, total_points',
        )
        .eq('tournament_id', tournamentId)
        .order('total_points', { ascending: false });
      const rows = (data ?? []).map((p) => [
        p.full_name, p.jersey_number ?? '', p.role,
        p.matches_played, p.raid_points, p.tackle_points, p.bonus_points,
        p.super_raids, p.super_tackles, p.empty_raids,
        p.dod_conversions, p.raid_success_pct ?? '', p.total_points,
      ]);
      csv = toCsv(
        [
          'Player', 'Jersey', 'Role', 'M', 'Raid pts', 'Tackle pts', 'Bonus',
          'Super raids', 'Super tackles', 'Empty raids',
          'DOD wins', 'Raid success %', 'Total pts',
        ],
        rows,
      );
      filename = `players-${tournamentId}-${todayStamp()}.csv`;
      break;
    }
    case 'matches': {
      if (!tournamentId) return new NextResponse('Missing tournament param', { status: 400 });
      const { data } = await supabase
        .from('matches')
        .select(
          'id, round, scheduled_at, status, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name)',
        )
        .eq('tournament_id', tournamentId)
        .order('scheduled_at', { ascending: false });
      const rows = (data ?? []).map((m) => [
        m.id,
        m.round ?? '',
        m.scheduled_at ? new Date(m.scheduled_at).toISOString() : '',
        m.status,
        // @ts-expect-error supabase nested
        m.home_team?.name ?? '',
        m.home_score,
        // @ts-expect-error supabase nested
        m.away_team?.name ?? '',
        m.away_score,
      ]);
      csv = toCsv(
        ['Match ID', 'Round', 'Scheduled at (UTC)', 'Status', 'Home', 'Home score', 'Away', 'Away score'],
        rows,
      );
      filename = `matches-${tournamentId}-${todayStamp()}.csv`;
      break;
    }
    case 'match_events': {
      if (!matchId) return new NextResponse('Missing match param', { status: 400 });
      // Re-validate the match belongs to caller's tenant
      const { data: match } = await supabase
        .from('matches')
        .select('id, tenant_id, home_team_id')
        .eq('id', matchId)
        .maybeSingle();
      if (!match || match.tenant_id !== tenantId) {
        return new NextResponse('Match not found', { status: 404 });
      }
      const { data: events } = await supabase
        .from('match_events')
        .select(
          'created_at, half, clock_seconds, type, attacking_team_id, raider_id, defender_ids, points_attacker, points_defender, is_super_raid, is_super_tackle, is_all_out',
        )
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      const rows = (events ?? []).map((e) => [
        new Date(e.created_at).toISOString(),
        e.half,
        e.clock_seconds,
        e.type,
        e.attacking_team_id ?? '',
        e.raider_id ?? '',
        Array.isArray(e.defender_ids) ? e.defender_ids.join('|') : '',
        e.points_attacker,
        e.points_defender,
        e.is_super_raid,
        e.is_super_tackle,
        e.is_all_out,
      ]);
      csv = toCsv(
        [
          'Timestamp (UTC)', 'Half', 'Clock (s)', 'Event type',
          'Attacking team', 'Raider', 'Defender IDs',
          'Points attacker', 'Points defender',
          'Super raid', 'Super tackle', 'All-out',
        ],
        rows,
      );
      filename = `match-${matchId}-events-${todayStamp()}.csv`;
      break;
    }
    default:
      return new NextResponse('Invalid type', { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function toCsv(headers: string[], rows: (string | number | boolean)[][]): string {
  const escape = (v: string | number | boolean) => {
    const s = String(v ?? '');
    // Quote if contains delimiter, quote, newline, or starts with =/+/-/@ (CSV injection guard)
    const needsQuote = /[",\n\r]|^[=+\-@]/.test(s);
    return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\r\n') + '\r\n';
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
