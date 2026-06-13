import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';

interface TenantLite {
  name: string;
  slug: string;
}

interface RecentTournament {
  id: string;
  name: string;
  slug: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export default function OrganiserDashboardScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [tenant, setTenant] = useState<TenantLite | null>(null);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [weekMatches, setWeekMatches] = useState(0);
  const [recent, setRecent] = useState<RecentTournament[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pulseLive, setPulseLive] = useState(true);

  // Auth gate
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role === 'user') {
      router.replace('/(fan)/feed');
      return;
    }
    if (!user.tenantId) {
      router.replace('/setup');
    }
  }, [sessionLoading, user, router]);

  // Pulse effect for Live scoring button
  useEffect(() => {
    const t = setInterval(() => {
      setPulseLive((p) => !p);
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const tenantId = user.tenantId;
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const [tenantRes, tournamentsRes, teamsRes, matchesRes, recentRes] = await Promise.all([
      supabase
        .from('tenants')
        .select('name, slug')
        .eq('id', tenantId)
        .maybeSingle(),
      supabase
        .from('tournaments')
        .select('id, status', { count: 'exact' })
        .eq('tenant_id', tenantId),
      supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', now)
        .lte('scheduled_at', weekFromNow),
      supabase
        .from('tournaments')
        .select('id, name, slug, status, start_date, end_date')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    setTenant((tenantRes.data ?? null) as TenantLite | null);
    setTournamentCount(tournamentsRes.count ?? 0);
    const liveTournaments = (tournamentsRes.data ?? []).filter((t) => t.status === 'live');
    setLiveCount(liveTournaments.length);
    setTeamCount(teamsRes.count ?? 0);
    setWeekMatches(matchesRes.count ?? 0);
    setRecent((recentRes.data ?? []) as RecentTournament[]);
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

  async function onSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/');
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const navButtons = [
    { label: 'Overview', icon: '⚡', color: '#ff5c1a', href: '/organiser' },
    { label: 'Tournaments', icon: '🏆', color: '#32ff7e', href: '/organiser/tournaments' },
    { label: 'Teams', icon: '👥', color: '#18dcff', href: '/organiser/teams' },
    { label: 'Fixtures', icon: '📅', color: '#7d5fff', href: '/organiser/fixtures' },
    { label: 'Live scoring', icon: '🎙️', color: theme.colors.danger, href: '/organiser/scoring', isLive: true },
    { label: 'Reports', icon: '📊', color: '#4b7bec', href: '/organiser/reports' },
    { label: 'Billing', icon: '💳', color: '#f1c40f', href: '/organiser/billing' },
    { label: 'Settings', icon: '⚙️', color: '#a1a1aa', href: '/organiser/settings' },
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
          colors={[theme.colors.primary + '12', 'transparent']}
          style={styles.radialGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* HERO HEADER */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(255, 92, 26, 0.12)', 'rgba(0,0,0,0)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.kicker}>ORGANISER · CONTROL CENTRE</Text>
          <Text style={styles.title}>
            Welcome{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </Text>
          {tenant && (
            <View style={styles.tenantBadge}>
              <Text style={styles.tenantName}>{tenant.name}</Text>
              <Text style={styles.tenantDomain}>kabaddiadda.com/t/{tenant.slug}</Text>
            </View>
          )}
        </View>

        {/* TELEMETRY STAT GRID */}
        <View style={styles.statGrid}>
          <StatCard label="Tournaments" value={tournamentCount} sub={liveCount ? `${liveCount} live now` : 'none active'} color="#32ff7e" />
          <StatCard label="Teams" value={teamCount} sub="across rosters" color="#18dcff" />
          <StatCard label="Matches This Week" value={weekMatches} sub="next 7 days" color="#7d5fff" />
          <StatCard label="Revenue (MTD)" value="₹0" sub="billing standard" color="#f1c40f" />
        </View>

        {/* THE CORE 2X4 NAVIGATION TILES GRID */}
        <Text style={styles.sectionTitle}>Dashboard navigation</Text>
        <View style={styles.gridContainer}>
          {navButtons.map((btn) => {
            const isActive = btn.label === 'Overview';
            return (
              <Pressable
                key={btn.label}
                style={({ pressed }) => [
                  styles.navCard,
                  isActive && styles.navCardActive,
                  pressed && styles.navCardPressed,
                ]}
                onPress={() => {
                  if (isActive) {
                    onRefresh();
                  } else {
                    router.push(btn.href as never);
                  }
                }}
              >
                <View style={[styles.navIconContainer, { backgroundColor: btn.color + '15' }]}>
                  <Text style={styles.navIcon}>{btn.icon}</Text>
                  {btn.isLive && (
                    <View style={[
                      styles.livePillDot,
                      pulseLive && styles.livePillDotPulse,
                    ]} />
                  )}
                </View>
                <View style={styles.navTextContainer}>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{btn.label}</Text>
                  {btn.isLive && (
                    <View style={styles.liveScoreBadge}>
                      <Text style={styles.liveScoreBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* PRIMARY ACTION CTA */}
        <Link href="/organiser/tournaments/new" asChild>
          <Pressable
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && styles.ctaPrimaryPressed,
            ]}
          >
            <Text style={styles.ctaPrimaryText}>+ Create new tournament</Text>
          </Pressable>
        </Link>

        {/* RECENT TOURNAMENTS LIST */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent tournaments</Text>
          <Link href="/organiser/tournaments" asChild>
            <Pressable>
              <Text style={styles.sectionLink}>View all →</Text>
            </Pressable>
          </Link>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tournaments yet</Text>
            <Text style={styles.emptyBody}>Create your first tournament to start scheduling teams and fixtures.</Text>
            <Link href="/organiser/tournaments/new" asChild>
              <Pressable style={styles.emptyCta}>
                <Text style={styles.emptyCtaText}>Create tournament →</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View style={styles.list}>
            {recent.map((t) => (
              <Link key={t.id} href={`/organiser/tournaments/${t.id}` as never} asChild>
                <Pressable style={({ pressed }) => [styles.tournamentRow, pressed && styles.rowPressed]}>
                  <View style={styles.tournamentRowMain}>
                    <Text style={styles.tournamentName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.tournamentDates}>
                      {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
                      {' — '}
                      {t.end_date ? new Date(t.end_date).toLocaleDateString() : 'TBD'}
                    </Text>
                  </View>
                  <StatusPill status={t.status} />
                  <Text style={styles.rowArrow}>→</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        {/* SIGN OUT */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
          onPress={onSignOut}
        >
          <Text style={styles.signOutText}>Sign out from account</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; fg: string; label: string }> = {
    live: { bg: theme.colors.danger + '22', fg: theme.colors.danger, label: 'LIVE' },
    completed: { bg: theme.colors.success + '22', fg: theme.colors.success, label: 'DONE' },
    draft: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'DRAFT' },
    scheduled: { bg: theme.colors.primary + '22', fg: theme.colors.primary, label: 'SCHED' },
    registration: { bg: theme.colors.primary + '22', fg: theme.colors.primary, label: 'OPEN' },
  };
  const s = styleMap[status] ?? { bg: theme.colors.border, fg: theme.colors.textMuted, label: status.toUpperCase() };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.fg }]}>{s.label}</Text>
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
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070a' },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 24,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },

  /* HERO HEADER */
  hero: {
    backgroundColor: '#111622',
    borderRadius: theme.radius.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  kicker: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  tenantBadge: {
    marginTop: theme.spacing.md,
    gap: 2,
  },
  tenantName: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  tenantDomain: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },

  /* STAT GRID */
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#111622',
    borderRadius: theme.radius.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: theme.spacing.md,
    gap: 2,
  },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  statSub: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  /* CORE 2X4 GRID NAV TILES */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: -theme.spacing.sm,
  },
  navCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    height: 70,
  },
  navCardActive: {
    borderColor: theme.colors.primary + '55',
    backgroundColor: '#171e2e',
  },
  navCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  navIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navIcon: { fontSize: 18 },
  navTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '800',
  },
  navLabelActive: {
    color: theme.colors.primary,
  },
  livePillDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    borderWidth: 1,
    borderColor: '#111622',
  },
  livePillDotPulse: {
    opacity: 0.3,
  },
  liveScoreBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.danger + '44',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  liveScoreBadgeText: {
    color: theme.colors.danger,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* PRIMARY CREATE CTA */
  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginTop: theme.spacing.sm,
  },
  ctaPrimaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaPrimaryText: { color: '#fff', fontSize: theme.font.body, fontWeight: '900', letterSpacing: 0.5 },

  /* RECENT TOURNAMENTS */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  sectionLink: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },

  list: { gap: theme.spacing.xs },

  tournamentRow: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rowPressed: {
    borderColor: theme.colors.primary + '33',
    backgroundColor: '#171e2e',
  },
  tournamentRowMain: { flex: 1, gap: 2 },
  tournamentName: { color: theme.colors.text, fontSize: theme.font.small + 1, fontWeight: '800' },
  tournamentDates: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  rowArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  emptyCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 6,
    alignItems: 'flex-start',
  },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
  emptyCta: { marginTop: theme.spacing.sm },
  emptyCtaText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },

  /* SIGN OUT */
  signOutBtn: {
    marginTop: theme.spacing.lg,
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  signOutText: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '800' },
});
