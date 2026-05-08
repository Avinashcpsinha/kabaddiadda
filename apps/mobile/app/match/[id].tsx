import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';
import { formatClock } from '../../src/lib/format';
import { FollowButton } from '../../src/components/follow-button';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface MatchRow {
  id: string;
  status: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  scheduled_at: string;
  round: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
  tournament: { id: string; name: string; slug: string; tenant: { slug: string; name: string } | null } | null;
}

interface PlayerRef {
  full_name: string;
  jersey_number: number | null;
}

interface MatchEvent {
  id: string;
  type: string;
  half: number;
  clock_seconds: number;
  points_attacker: number;
  points_defender: number;
  attacking_team_id: string | null;
  raider_id: string | null;
  defender_ids: string[] | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Raid point',
  tackle_point: 'Tackle point',
  bonus_point: 'Bonus point',
  super_raid: 'Super raid',
  super_tackle: 'Super tackle',
  all_out: 'All out',
  do_or_die_raid: 'Do-or-die raid',
  empty_raid: 'Empty raid',
  time_out: 'Time out',
  technical_point: 'Technical point',
  substitution: 'Substitution',
  review: 'Review',
};

// Public live scoreboard. Anyone can watch — no auth required. RLS on the
// matches table allows anonymous SELECT.
//
// Realtime: postgres_changes listens for UPDATE on matches (score / clock
// ticks) and INSERT on match_events (new commentary line). Both are scoped
// to this match_id so we don't get spammed by activity on other games.
export default function MatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Array.isArray(id) ? id[0] : id;

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Map<string, PlayerRef>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadMatch = useCallback(async () => {
    if (!matchId) return;
    const { data } = await supabase
      .from('matches')
      .select(
        `id, status, home_score, away_score, current_half, clock_seconds, scheduled_at, round,
         home_team:home_team_id(id, name, short_name, primary_color),
         away_team:away_team_id(id, name, short_name, primary_color),
         tournament:tournament_id(id, name, slug, tenant:tenant_id(slug, name))`,
      )
      .eq('id', matchId)
      .maybeSingle();

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setMatch(data as unknown as MatchRow);
  }, [matchId]);

  const loadEvents = useCallback(async () => {
    if (!matchId) return;
    const { data } = await supabase
      .from('match_events')
      .select(
        'id, type, half, clock_seconds, points_attacker, points_defender, attacking_team_id, raider_id, defender_ids, created_at',
      )
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(50);
    setEvents((data ?? []) as unknown as MatchEvent[]);

    // Resolve player names referenced by raider_id / defender_ids so the
    // commentary lines have human names, not UUIDs.
    const referenced = new Set<string>();
    for (const e of data ?? []) {
      if (e.raider_id) referenced.add(e.raider_id);
      for (const did of (e.defender_ids as string[] | null) ?? []) referenced.add(did);
    }
    if (referenced.size > 0) {
      const { data: pdata } = await supabase
        .from('players')
        .select('id, full_name, jersey_number')
        .in('id', Array.from(referenced));
      const map = new Map<string, PlayerRef>();
      for (const p of pdata ?? []) {
        map.set(p.id, { full_name: p.full_name, jersey_number: p.jersey_number });
      }
      setPlayers(map);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    Promise.all([loadMatch(), loadEvents()]).then(() => setLoading(false));
  }, [matchId, loadMatch, loadEvents]);

  // Realtime subscriptions — scoped to this match. We could parse the new
  // payload directly instead of refetching, but the row is small and refetch
  // keeps the join data fresh too.
  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => loadMatch(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        () => loadEvents(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, loadMatch, loadEvents]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Loading…' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (notFound || !match) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Match not found' }} />
        <Text style={styles.notFoundTitle}>Match not found</Text>
        <Text style={styles.notFoundBody}>It may have been removed or you followed an old link.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const home = match.home_team;
  const away = match.away_team;
  const homeColor = home?.primary_color ?? theme.colors.primary;
  const awayColor = away?.primary_color ?? '#0ea5e9';
  const tournamentName = match.tournament?.name ?? null;
  const isLive = match.status === 'live';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: tournamentName ?? 'Match' }} />

      {/* Scoreboard hero — split-color background tinted by team primary colors */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.heroSplit}>
            <LinearGradient
              colors={[homeColor + 'cc', homeColor + '66']}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <LinearGradient
              colors={[awayColor + '66', awayColor + 'cc']}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
          <LinearGradient
            colors={[theme.colors.bg + 'aa', theme.colors.bg + 'cc']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <View style={styles.heroBadgeRow}>
          {isLive ? (
            <View style={styles.heroLiveBadge}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveText}>LIVE · Q{match.current_half} · {formatClock(match.clock_seconds)}</Text>
            </View>
          ) : (
            <View style={[styles.heroLiveBadge, { backgroundColor: theme.colors.border, borderColor: theme.colors.border }]}>
              <Text style={[styles.heroLiveText, { color: theme.colors.textMuted }]}>{match.status.toUpperCase()}</Text>
            </View>
          )}
          {match.round && <Text style={styles.heroRound}>{match.round}</Text>}
        </View>

        <View style={styles.heroScoreRow}>
          <TeamScore team={home} score={match.home_score} winning={match.home_score > match.away_score} />
          <Text style={styles.heroVs}>VS</Text>
          <TeamScore team={away} score={match.away_score} winning={match.away_score > match.home_score} />
        </View>

        {tournamentName && (
          <Text style={styles.heroTournament} numberOfLines={1}>
            {tournamentName}
            {match.tournament?.tenant?.name ? ` · ${match.tournament.tenant.name}` : ''}
          </Text>
        )}
      </View>

      {/* FOLLOW ROW — tournament + each team. Tap pushes anonymous visitors
          through signup; signed-in fans flip the follow state in place. */}
      <View style={styles.followRow}>
        {match.tournament?.id && (
          <FollowButton targetType="tournament" targetId={match.tournament.id} label={tournamentName ?? 'tournament'} />
        )}
        {home?.id && (
          <FollowButton targetType="team" targetId={home.id} label={home.short_name ?? home.name} />
        )}
        {away?.id && (
          <FollowButton targetType="team" targetId={away.id} label={away.short_name ?? away.name} />
        )}
      </View>

      {/* Events feed */}
      <View style={styles.eventsHeader}>
        <Text style={styles.eventsTitle}>Commentary</Text>
        <Text style={styles.eventsCount}>{events.length}</Text>
      </View>

      {events.length === 0 ? (
        <View style={styles.eventsEmpty}>
          <Text style={styles.eventsEmptyTitle}>No events yet</Text>
          <Text style={styles.eventsEmptyBody}>
            {isLive
              ? 'The scorer hasn’t logged a raid yet. Stay tuned.'
              : 'This match has no recorded events.'}
          </Text>
        </View>
      ) : (
        <View style={styles.eventsList}>
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} match={match} players={players} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TeamScore({
  team,
  score,
  winning,
}: {
  team: TeamLite | null;
  score: number;
  winning: boolean;
}) {
  return (
    <View style={styles.teamScore}>
      <View
        style={[
          styles.teamShortBadge,
          { backgroundColor: team?.primary_color ?? theme.colors.primary },
        ]}
      >
        <Text style={styles.teamShortBadgeText}>{team?.short_name ?? '??'}</Text>
      </View>
      <Text style={styles.teamScoreName} numberOfLines={1}>
        {team?.name ?? 'TBD'}
      </Text>
      <Text style={[styles.teamScoreValue, !winning && styles.teamScoreValueDim]}>{score}</Text>
    </View>
  );
}

function EventRow({
  event,
  match,
  players,
}: {
  event: MatchEvent;
  match: MatchRow;
  players: Map<string, PlayerRef>;
}) {
  const raider = event.raider_id ? players.get(event.raider_id) : null;
  const defenders = (event.defender_ids ?? [])
    .map((id) => players.get(id))
    .filter(Boolean) as PlayerRef[];

  const attackingHome = event.attacking_team_id === match.home_team?.id;
  const accent = attackingHome
    ? match.home_team?.primary_color ?? theme.colors.primary
    : match.away_team?.primary_color ?? '#0ea5e9';
  const attackerName = attackingHome ? match.home_team?.short_name : match.away_team?.short_name;

  const label = EVENT_LABEL[event.type] ?? event.type;
  const points = event.points_attacker + event.points_defender;

  let line = '';
  if (raider) {
    line += `${shortPlayer(raider)}`;
    if (defenders.length > 0) {
      line += defenders.length === 1
        ? ` × ${shortPlayer(defenders[0]!)}`
        : ` × ${shortPlayer(defenders[0]!)} +${defenders.length - 1}`;
    }
  } else if (defenders.length > 0) {
    line = defenders.map(shortPlayer).join(', ');
  }

  return (
    <View style={[styles.eventRow, { borderLeftColor: accent }]}>
      <View style={styles.eventTopRow}>
        <Text style={styles.eventLabel}>{label}</Text>
        <Text style={styles.eventClock}>Q{event.half} · {formatClock(event.clock_seconds)}</Text>
      </View>
      {line ? <Text style={styles.eventLine}>{line}</Text> : null}
      {points > 0 && (
        <Text style={[styles.eventPoints, { color: accent }]}>
          +{points} {attackerName ?? ''}
        </Text>
      )}
    </View>
  );
}

function shortPlayer(p: PlayerRef): string {
  const first = p.full_name.split(' ')[0] ?? p.full_name;
  return p.jersey_number != null ? `${first} #${p.jersey_number}` : first;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 24 },

  notFoundTitle: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900' },
  notFoundBody: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', marginTop: 8 },
  backBtn: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  backBtnText: { color: '#fff', fontWeight: '800' },

  hero: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    gap: theme.spacing.md,
  },
  heroSplit: { flexDirection: 'row', flex: 1 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  heroLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.danger + '22',
    borderWidth: 1,
    borderColor: theme.colors.danger + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  heroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger },
  heroLiveText: { color: theme.colors.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroRound: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  heroScoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  heroVs: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  teamScore: { flex: 1, alignItems: 'center', gap: 6 },
  teamShortBadge: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  teamShortBadgeText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  teamScoreName: { color: theme.colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', maxWidth: 120 },
  teamScoreValue: { color: theme.colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  teamScoreValueDim: { color: theme.colors.textMuted },
  heroTournament: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textAlign: 'center', marginTop: theme.spacing.sm },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },

  eventsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  eventsTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800' },
  eventsCount: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800' },

  eventsList: { gap: theme.spacing.sm },
  eventRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  eventTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
  eventClock: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  eventLine: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18 },
  eventPoints: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  eventsEmpty: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  eventsEmptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  eventsEmptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },
});
