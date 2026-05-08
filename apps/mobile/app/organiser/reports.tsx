import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';
import { FORMAT_LABEL, formatDateRange } from '../../src/lib/format';

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

// Headline tenant-wide stats + per-tournament breakdown. Mirrors the web
// /organiser/reports page but trimmed to what fits comfortably on a phone:
// 4 headline cards + a tournament list. CSV export and per-match exports
// stay on the web for now.
export default function OrganiserReportsScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [tournamentCount, setTournamentCount] = useState(0);
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [allOuts, setAllOuts] = useState(0);
  const [superRaids, setSuperRaids] = useState(0);
  const [superTackles, setSuperTackles] = useState(0);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const tenantId = user.tenantId;

    const [tournamentsCountRes, completedRes, eventsRes, tournamentsRes] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('matches')
        .select('id, home_score, away_score, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed'),
      supabase
        .from('match_events')
        .select('type, is_super_raid, is_super_tackle, is_all_out')
        .eq('tenant_id', tenantId),
      supabase
        .from('tournaments')
        .select('id, slug, name, format, status, start_date, end_date')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false, nullsFirst: false }),
    ]);

    const completed = completedRes.data ?? [];
    const events = eventsRes.data ?? [];

    setTournamentCount(tournamentsCountRes.count ?? 0);
    setMatchesPlayed(completed.length);
    setTotalPoints(completed.reduce((sum, m) => sum + (m.home_score ?? 0) + (m.away_score ?? 0), 0));
    setAllOuts(events.filter((e) => e.is_all_out).length);
    setSuperRaids(events.filter((e) => e.is_super_raid).length);
    setSuperTackles(events.filter((e) => e.is_super_tackle).length);
    setTournaments((tournamentsRes.data ?? []) as TournamentRow[]);
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
        <Stack.Screen options={{ title: 'Reports' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const avgPoints = matchesPlayed > 0 ? Math.round((totalPoints / matchesPlayed) * 10) / 10 : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <Stack.Screen options={{ title: 'Reports' }} />

      <View>
        <Text style={styles.kicker}>LEAGUE</Text>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>
          Headline numbers across your league. Per-match CSV export lives on the web for now.
        </Text>
      </View>

      {/* HEADLINE STATS */}
      <View style={styles.statGrid}>
        <Stat label="Tournaments" value={tournamentCount} sub="all-time" icon="♔" />
        <Stat label="Matches played" value={matchesPlayed} sub="completed" icon="●" />
        <Stat label="Total points" value={totalPoints} sub={`avg ${avgPoints}/match`} icon="★" />
        <Stat label="All-outs" value={allOuts} sub="across all matches" icon="↯" />
        <Stat label="Super raids" value={superRaids} sub="3+ point raids" icon="⚡" />
        <Stat label="Super tackles" value={superTackles} sub="≤3 defenders" icon="◈" />
      </View>

      {/* TOURNAMENTS LIST */}
      <Text style={styles.sectionKicker}>TOURNAMENTS · {tournaments.length}</Text>
      {tournaments.length === 0 ? (
        <Text style={styles.empty}>No tournaments yet — create one to start collecting stats.</Text>
      ) : (
        <View style={styles.list}>
          {tournaments.map((t) => (
            <Link key={t.id} href={`/organiser/tournaments/${t.id}` as never} asChild>
              <Pressable style={styles.tournamentRow}>
                <View style={styles.tournamentMain}>
                  <Text style={styles.tournamentName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tournamentMeta}>
                    {FORMAT_LABEL[t.format] ?? t.format}
                    {formatDateRange(t.start_date, t.end_date) ? ` · ${formatDateRange(t.start_date, t.end_date)}` : ''}
                    {' · '}
                    <Text style={{ color: theme.colors.primary }}>{t.status.toUpperCase()}</Text>
                  </Text>
                </View>
                <Text style={styles.rowArrow}>→</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>More reports on the web</Text>
        <Text style={styles.infoBody}>
          Per-match event logs, CSV exports, and player leaderboards are on the web console at
          /organiser/reports. Mobile shows the headline numbers; deeper exports stay desktop-bound for now.
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },

  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20, marginTop: 4 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
  },
  statIcon: { color: theme.colors.primary, fontSize: 18, fontWeight: '900' },
  statValue: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  statLabel: { color: theme.colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statSub: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  sectionKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.md },
  list: { gap: theme.spacing.xs },
  tournamentRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tournamentMain: { flex: 1, gap: 2 },
  tournamentName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  tournamentMeta: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },

  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },

  infoCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 4,
    marginTop: theme.spacing.md,
  },
  infoTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  infoBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
});
