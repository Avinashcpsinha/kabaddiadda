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
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';
import { formatClock } from '../../src/lib/format';

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

type TabType = 'all' | 'live' | 'scheduled' | 'completed';

export default function OrganiserFixturesScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const tenantId = user.tenantId;

    // Fetch matches with tournaments
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id, tournament_id, scheduled_at, status, home_score, away_score, current_half, clock_seconds,
        home_team:home_team_id(id, name, short_name, primary_color),
        away_team:away_team_id(id, name, short_name, primary_color),
        tournament:tournament_id(name)
      `)
      .eq('tenant_id', tenantId)
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
        <Stack.Screen options={{ title: 'Fixtures' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const filteredMatches = matches.filter((m) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'live') return m.status === 'live' || m.status === 'half_time';
    if (activeTab === 'scheduled') return m.status === 'scheduled';
    if (activeTab === 'completed') return m.status === 'completed' || m.status === 'abandoned';
    return true;
  });

  const tabDetails: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: '🔴 Live' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
  ];

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

      <Stack.Screen options={{ title: 'Fixtures' }} />

      {/* FILTER TABS */}
      <View style={styles.tabBar}>
        {tabDetails.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredMatches}
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
            <Text style={styles.kicker}>LEAGUE FIXTURES</Text>
            <Text style={styles.title}>Match Schedule</Text>
            <Text style={styles.subtitle}>
              {filteredMatches.length === 0
                ? 'No fixtures match your current filter.'
                : `${filteredMatches.length} match${filteredMatches.length === 1 ? '' : 'es'} listed.`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyBody}>
              Create a tournament or add fixtures to schedule matches in this league.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLive = item.status === 'live' || item.status === 'half_time';
          const isScheduled = item.status === 'scheduled';
          const homeColor = item.home_team?.primary_color ?? theme.colors.primary;
          const awayColor = item.away_team?.primary_color ?? theme.colors.primary;

          return (
            <View style={[styles.matchCard, isLive && styles.matchCardLive]}>
              <View style={styles.matchCardHeader}>
                <Text style={styles.matchTournamentName} numberOfLines={1}>
                  {item.tournamentName?.toUpperCase()}
                </Text>
                {isLive ? (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>
                      {item.status === 'half_time' ? 'HT' : `Q${item.current_half}`}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusPill, isScheduled ? styles.pillScheduled : styles.pillDone]}>
                    <Text style={styles.statusPillText}>{item.status.toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* TEAM ROW */}
              <View style={styles.teamScoreSection}>
                <View style={styles.teamRow}>
                  <View style={[styles.teamSwatch, { backgroundColor: homeColor }]} />
                  <Text style={styles.teamName} numberOfLines={1}>
                    {item.home_team?.name ?? 'TBD'}
                  </Text>
                  {!isScheduled && (
                    <Text style={styles.teamScore}>{item.home_score}</Text>
                  )}
                </View>

                <View style={styles.teamRow}>
                  <View style={[styles.teamSwatch, { backgroundColor: awayColor }]} />
                  <Text style={styles.teamName} numberOfLines={1}>
                    {item.away_team?.name ?? 'TBD'}
                  </Text>
                  {!isScheduled && (
                    <Text style={styles.teamScore}>{item.away_score}</Text>
                  )}
                </View>
              </View>

              {/* BOTTOM ACTIONS / CLOCK */}
              <View style={styles.matchCardFooter}>
                <Text style={styles.matchDateText}>
                  {isLive
                    ? `Clock: ${formatClock(item.clock_seconds)}`
                    : new Date(item.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </Text>

                {(isLive || isScheduled) && (
                  <Link href={`/organiser/scoring/${item.id}` as never} asChild>
                    <Pressable style={styles.scoreCta}>
                      <Text style={styles.scoreCtaText}>Score Match 🎙️</Text>
                    </Pressable>
                  </Link>
                )}
              </View>
            </View>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111622',
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    gap: 6,
  },
  tabItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
  },
  tabLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: theme.colors.primary,
  },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  header: { gap: 4, marginBottom: theme.spacing.xs },
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
    borderColor: theme.colors.danger + '33',
    backgroundColor: '#16121a',
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchTournamentName: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  liveBadge: {
    backgroundColor: theme.colors.danger + '22',
    borderWidth: 1,
    borderColor: theme.colors.danger + '55',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  liveBadgeText: {
    color: theme.colors.danger,
    fontSize: 8,
    fontWeight: '900',
  },
  statusPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pillScheduled: {
    backgroundColor: theme.colors.primary + '22',
  },
  pillDone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusPillText: {
    color: theme.colors.text,
    fontSize: 8,
    fontWeight: '900',
  },
  teamScoreSection: {
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  teamSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  teamName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  teamScore: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  matchCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  matchDateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  scoreCta: {
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreCtaText: {
    color: theme.colors.primary,
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
