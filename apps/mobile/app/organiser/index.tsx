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

// Organiser dashboard. Tenant-scoped via RLS — every query below filters by
// tenant_id explicitly so the SQL plan stays cheap and so we don't accidentally
// rely on RLS for correctness.
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
        .limit(5),
    ]);

    setTenant((tenantRes.data ?? null) as TenantLite | null);
    setTournamentCount(tournamentsRes.count ?? 0);
    setLiveCount((tournamentsRes.data ?? []).filter((t) => t.status === 'live').length);
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      {/* HERO */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[theme.colors.primary + '22', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.kicker}>ORGANISER · DASHBOARD</Text>
        <Text style={styles.title}>
          Welcome{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </Text>
        {tenant && (
          <Text style={styles.tenantLine}>
            {tenant.name} · kabaddiadda.com/t/{tenant.slug}
          </Text>
        )}
      </View>

      {/* STAT GRID */}
      <View style={styles.statGrid}>
        <StatCard label="Tournaments" value={tournamentCount} sub={liveCount ? `${liveCount} live now` : 'none live'} />
        <StatCard label="Teams" value={teamCount} sub="across leagues" />
        <StatCard label="Matches this week" value={weekMatches} sub="next 7 days" />
        <StatCard label="Revenue (MTD)" value="₹0" sub="billing TBD" />
      </View>

      {/* PRIMARY CTA */}
      <Link href="/organiser/tournaments/new" asChild>
        <Pressable style={styles.ctaPrimary}>
          <Text style={styles.ctaPrimaryText}>+ New tournament</Text>
        </Pressable>
      </Link>

      {/* RECENT TOURNAMENTS */}
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
              <Pressable style={styles.tournamentRow}>
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

      {/* QUICK ACTIONS */}
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.list}>
        <QuickAction icon="♔" label="Browse tournaments" href="/organiser/tournaments" />
        <QuickAction icon="◊" label="Reports & analytics" href="/organiser/reports" />
        <QuickAction icon="⚙" label="League settings" href="/organiser/settings" />
        <QuickAction icon="●" label="Scoring UI sandbox" href="/scoring" />
        <QuickAction icon="★" label="Switch to fan view" href="/(fan)/feed" />
      </View>

      <Pressable style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

function QuickAction({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.quickAction}>
        <View style={styles.quickActionIcon}>
          <Text style={styles.quickActionIconText}>{icon}</Text>
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <Text style={styles.rowArrow}>→</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + 24, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },

  hero: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  tenantLine: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 6 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 2,
  },
  statValue: { color: theme.colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: theme.colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statSub: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800', marginTop: theme.spacing.sm },
  sectionLink: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '700' },

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
  tournamentRowMain: { flex: 1, gap: 2 },
  tournamentName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  tournamentDates: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  rowArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  emptyCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 6,
    alignItems: 'flex-start',
  },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
  emptyCta: { marginTop: theme.spacing.sm },
  emptyCtaText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },

  quickAction: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconText: { color: theme.colors.primary, fontSize: 16, fontWeight: '900' },
  quickActionLabel: { flex: 1, color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },

  signOutBtn: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  signOutText: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
});
