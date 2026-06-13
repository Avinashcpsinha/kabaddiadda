import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/lib/use-session';
import { theme } from '../../../src/theme';
import { formatClock } from '../../../src/lib/format';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface MatchRow {
  id: string;
  tournament_id: string;
  scheduled_at: string;
  status: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
  tournamentName?: string;
}

export default function OrganiserScoringSelectScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pulseState, setPulseState] = useState(true);

  // Pulse effect for live status
  useEffect(() => {
    const t = setInterval(() => {
      setPulseState((p) => !p);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const tenantId = user.tenantId;

    // Fetch matches that are either scheduled or live or half_time
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id, tournament_id, scheduled_at, status, home_score, away_score, current_half, clock_seconds,
        home_team:home_team_id(id, name, short_name, primary_color),
        away_team:away_team_id(id, name, short_name, primary_color),
        tournament:tournament_id(name)
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['scheduled', 'live', 'half_time'])
      .order('scheduled_at', { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      setLoaded(true);
      return;
    }

    const compiled: MatchRow[] = (matchesData ?? []).map((m: any) => ({
      id: m.id,
      tournament_id: m.tournament_id,
      scheduled_at: m.scheduled_at,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      current_half: m.current_half,
      clock_seconds: m.clock_seconds,
      home_team: m.home_team,
      away_team: m.away_team,
      tournamentName: m.tournament?.name ?? 'Unknown Tournament',
    }));

    setMatches(compiled);
    setLoaded(true);
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Select Match' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#05070a' }}>
      {/* Stadium Night Glow Backdrop */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['#0d1527', '#06080e', '#030407']}
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.45, 1]}
        />
        <LinearGradient
          colors={[theme.colors.primary + '10', 'transparent']}
          style={styles.radialGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <Stack.Screen options={{ title: 'Select Scoring Match' }} />

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.wrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>LIVE MATCH CONSOLE</Text>
            <Text style={styles.title}>Scoring Desk</Text>
            <Text style={styles.subtitle}>
              Select an active scheduled or live match to launch the scoring interface and update scores in real-time.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Active Matches</Text>
            <Text style={styles.emptyBody}>
              All registered matches are either completed or have not been scheduled yet. Go to Tournaments or Fixtures to manage match statuses.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLive = item.status === 'live' || item.status === 'half_time';
          const homeColor = item.home_team?.primary_color ?? theme.colors.primary;
          const awayColor = item.away_team?.primary_color ?? theme.colors.primary;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.matchCard,
                isLive && styles.matchCardLive,
                pressed && styles.matchCardPressed,
              ]}
              onPress={() => {
                router.push(`/organiser/scoring/${item.id}` as never);
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.tournamentName} numberOfLines={1}>
                  {item.tournamentName?.toUpperCase()}
                </Text>
                {isLive ? (
                  <View style={[styles.liveBadge, pulseState && styles.liveBadgePulse]}>
                    <Text style={styles.liveBadgeText}>
                      {item.status === 'half_time' ? 'HALF TIME' : `Q${item.current_half} · LIVE`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.scheduledBadge}>
                    <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
                  </View>
                )}
              </View>

              {/* TEAMS INFO */}
              <View style={styles.teamsGrid}>
                <View style={styles.teamContainer}>
                  <View style={[styles.colorIndicator, { backgroundColor: homeColor }]} />
                  <Text style={styles.teamText} numberOfLines={1}>
                    {item.home_team?.name ?? 'TBD'}
                  </Text>
                  <Text style={styles.scoreText}>{item.home_score}</Text>
                </View>

                <View style={styles.vsDivider}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                <View style={styles.teamContainer}>
                  <View style={[styles.colorIndicator, { backgroundColor: awayColor }]} />
                  <Text style={styles.teamText} numberOfLines={1}>
                    {item.away_team?.name ?? 'TBD'}
                  </Text>
                  <Text style={styles.scoreText}>{item.away_score}</Text>
                </View>
              </View>

              {/* CARD FOOTER */}
              <View style={styles.cardFooter}>
                <Text style={styles.timeText}>
                  {isLive
                    ? `Clock: ${formatClock(item.clock_seconds)}`
                    : new Date(item.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                <View style={styles.launchBtn}>
                  <Text style={styles.launchBtnText}>Launch Console →</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  radialGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070a' },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  header: { gap: 4, marginBottom: theme.spacing.md },
  kicker: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  matchCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  matchCardLive: {
    borderColor: theme.colors.danger + '44',
    backgroundColor: '#16121a',
    shadowColor: theme.colors.danger,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  matchCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentName: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  liveBadge: {
    backgroundColor: theme.colors.danger + '22',
    borderWidth: 1,
    borderColor: theme.colors.danger + '77',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgePulse: {
    opacity: 0.7,
  },
  liveBadgeText: {
    color: theme.colors.danger,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scheduledBadge: {
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scheduledBadgeText: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  teamsGrid: {
    gap: 8,
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  teamText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  scoreText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  vsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  vsText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 8,
    fontWeight: '900',
    backgroundColor: '#111622',
    paddingHorizontal: 6,
    position: 'absolute',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  launchBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  launchBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  emptyCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.lg,
  },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },
});
