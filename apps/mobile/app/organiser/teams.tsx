import { Stack, useRouter } from 'expo-router';
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

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  created_at: string;
  playerCount?: number;
  coachCount?: number;
  headCoach?: string;
}

export default function OrganiserTeamsScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [teams, setTeams] = useState<TeamRow[]>([]);
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

    // Fetch teams
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, short_name, primary_color, created_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (teamsError) {
      console.error(teamsError);
      setLoaded(true);
      return;
    }

    // Fetch players to get headcount per team
    const { data: playersData } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('tenant_id', tenantId);

    const counts: Record<string, number> = {};
    if (playersData) {
      playersData.forEach((p) => {
        if (p.team_id) {
          counts[p.team_id] = (counts[p.team_id] || 0) + 1;
        }
      });
    }

    // Fetch coaching staff to show head coach + count per team.
    const { data: coachesData } = await supabase
      .from('coaches')
      .select('team_id, full_name, role')
      .eq('tenant_id', tenantId);

    const coachCounts: Record<string, number> = {};
    const headCoach: Record<string, string> = {};
    coachesData?.forEach((c) => {
      if (!c.team_id) return;
      coachCounts[c.team_id] = (coachCounts[c.team_id] || 0) + 1;
      if (c.role === 'head_coach' && !headCoach[c.team_id]) {
        headCoach[c.team_id] = c.full_name;
      }
    });

    const compiled: TeamRow[] = (teamsData ?? []).map((t) => ({
      ...t,
      playerCount: counts[t.id] || 0,
      coachCount: coachCounts[t.id] || 0,
      headCoach: headCoach[t.id],
    }));

    setTeams(compiled);
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
        <Stack.Screen options={{ title: 'Teams' }} />
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

      <Stack.Screen options={{ title: 'Teams & Rosters' }} />

      <FlatList
        data={teams}
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
            <Text style={styles.kicker}>LEAGUE CLUBS</Text>
            <Text style={styles.title}>Teams & Rosters</Text>
            <Text style={styles.subtitle}>
              {teams.length === 0
                ? 'No teams registered in your league yet.'
                : `${teams.length} active teams with player rosters.`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No teams found</Text>
            <Text style={styles.emptyBody}>
              Create a tournament first and invite/register teams and players to start listing them here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const badgeColor = item.primary_color ?? theme.colors.primary;
          return (
            <View style={styles.teamCard}>
              <View style={[styles.colorBadge, { backgroundColor: badgeColor }]}>
                <Text style={styles.colorBadgeText}>
                  {item.short_name ? item.short_name.substring(0, 2).toUpperCase() : item.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>

              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{item.name}</Text>
                <Text style={styles.teamMeta}>
                  {item.short_name ? `${item.short_name} · ` : ''}
                  {item.playerCount ?? 0} player{(item.playerCount ?? 0) === 1 ? '' : 's'}
                  {(item.coachCount ?? 0) > 0
                    ? ` · ${item.coachCount} coach${(item.coachCount ?? 0) === 1 ? '' : 'es'}`
                    : ''}
                </Text>
                {item.headCoach ? (
                  <Text style={styles.coachLine}>🧢 {item.headCoach}</Text>
                ) : null}
              </View>

              <View style={styles.arrowContainer}>
                <Text style={styles.rowArrow}>→</Text>
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

  teamCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  colorBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  colorBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  teamMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  coachLine: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  arrowContainer: {
    justifyContent: 'center',
  },
  rowArrow: {
    color: theme.colors.primary,
    fontSize: 16,
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
