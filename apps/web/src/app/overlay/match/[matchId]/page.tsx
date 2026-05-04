import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OverlayStrip } from './overlay-strip';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return { title: `Overlay · ${matchId.slice(0, 8)}`, robots: { index: false } };
}

/**
 * Broadcaster overlay — meant to be loaded as an OBS / Streamyard browser
 * source. Renders a 100%-wide × 120px strip pinned to the bottom of the
 * viewport with team logos, scores, half + clock, raid timer, and live
 * context badges (do-or-die, all-out, current raider). Subscribes to the
 * same Supabase realtime channels the public live page uses, so updates
 * are pushed in real time.
 *
 * Recommended OBS settings:
 *   • Width 1920, Height 200 (gives a little headroom for the strip)
 *   • Custom CSS (none required)
 *   • Refresh browser when scene becomes active: ON
 */
export default async function OverlayPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select(
      `id, status, home_score, away_score, current_half, clock_seconds,
       current_raider_id, current_attacking_team_id,
       home_dod_counter, away_dod_counter,
       home_team:home_team_id(id, name, short_name, primary_color),
       away_team:away_team_id(id, name, short_name, primary_color)`,
    )
    .eq('id', matchId)
    .maybeSingle();

  if (!match) notFound();

  // Resolve the in-progress raider's name so the badge can render on first
  // paint (before any realtime broadcast arrives).
  let initialRaider: {
    fullName: string;
    jerseyNumber: number | null;
    teamName: string;
  } | null = null;
  if (match.current_raider_id && match.current_attacking_team_id) {
    const { data: player } = await supabase
      .from('players')
      .select('full_name, jersey_number')
      .eq('id', match.current_raider_id)
      .maybeSingle();
    if (player) {
      // @ts-expect-error supabase nested join
      const homeId: string = match.home_team.id;
      const teamName =
        match.current_attacking_team_id === homeId
          ? // @ts-expect-error supabase nested join
            (match.home_team.name as string)
          : // @ts-expect-error supabase nested join
            (match.away_team.name as string);
      initialRaider = {
        fullName: player.full_name,
        jerseyNumber: player.jersey_number,
        teamName,
      };
    }
  }

  return (
    <OverlayStrip
      matchId={matchId}
      initial={{
        status: match.status,
        homeScore: match.home_score,
        awayScore: match.away_score,
        currentHalf: match.current_half,
        clockSeconds: match.clock_seconds,
        currentAttackingTeamId: match.current_attacking_team_id ?? null,
        homeDodCounter: match.home_dod_counter ?? 0,
        awayDodCounter: match.away_dod_counter ?? 0,
        currentRaider: initialRaider,
        // @ts-expect-error supabase nested join
        home: match.home_team,
        // @ts-expect-error supabase nested join
        away: match.away_team,
      }}
    />
  );
}
