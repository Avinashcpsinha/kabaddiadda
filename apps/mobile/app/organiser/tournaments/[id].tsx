import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { supabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/lib/use-session';
import { theme } from '../../../src/theme';
import { FORMAT_LABEL, formatDateRange, formatDateTime } from '../../../src/lib/format';

interface TournamentDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  max_teams: number | null;
  entry_fee: number | null;
  prize_pool: number | null;
}

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  primary_color: string | null;
}

interface Match {
  id: string;
  scheduled_at: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  home_team: { id: string; name: string; short_name: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null } | null;
}

const STATUS_FLOW: { value: string; label: string; hint: string }[] = [
  { value: 'draft', label: 'Draft', hint: 'Visible only to you' },
  { value: 'registration', label: 'Registration', hint: 'Teams can join' },
  { value: 'scheduled', label: 'Scheduled', hint: 'Fixtures published' },
  { value: 'live', label: 'Live', hint: 'Matches happening' },
  { value: 'completed', label: 'Completed', hint: 'Tournament over' },
];

const STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  live: { bg: theme.colors.danger + '22', fg: theme.colors.danger },
  draft: { bg: theme.colors.border, fg: theme.colors.textMuted },
  scheduled: { bg: theme.colors.primary + '22', fg: theme.colors.primary },
  registration: { bg: theme.colors.success + '22', fg: theme.colors.success },
  completed: { bg: theme.colors.border, fg: theme.colors.textMuted },
};

export default function OrganiserTournamentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { user, loading: sessionLoading } = useSession();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Auth gate (organiser-only). Same routing rules as the dashboard.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!tournamentId || !user?.tenantId) return;
    const [tRes, teamsRes, matchesRes, tenantRes] = await Promise.all([
      supabase
        .from('tournaments')
        .select(
          'id, name, slug, description, format, status, start_date, end_date, max_teams, entry_fee, prize_pool',
        )
        .eq('id', tournamentId)
        .eq('tenant_id', user.tenantId)
        .maybeSingle(),
      supabase
        .from('teams')
        .select('id, name, short_name, city, primary_color')
        .eq('tournament_id', tournamentId)
        .order('name'),
      supabase
        .from('matches')
        .select(
          `id, scheduled_at, status, round, home_score, away_score,
           home_team:home_team_id(id, name, short_name),
           away_team:away_team_id(id, name, short_name)`,
        )
        .eq('tournament_id', tournamentId)
        .order('scheduled_at', { ascending: true })
        .limit(20),
      supabase.from('tenants').select('slug').eq('id', user.tenantId).maybeSingle(),
    ]);

    setTournament((tRes.data ?? null) as TournamentDetail | null);
    setTeams((teamsRes.data ?? []) as Team[]);
    setMatches((matchesRes.data ?? []) as unknown as Match[]);
    setTenantSlug(tenantRes.data?.slug ?? null);
    setLoaded(true);
  }, [tournamentId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function changeStatus(newStatus: string) {
    if (!tournamentId) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('tournaments')
      .update({ status: newStatus })
      .eq('id', tournamentId);
    setUpdatingStatus(false);
    if (error) {
      Alert.alert('Could not update status', error.message);
      return;
    }
    setTournament((prev) => (prev ? { ...prev, status: newStatus } : prev));
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Loading…' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.notFound}>Tournament not found in your league.</Text>
      </View>
    );
  }

  const tint = STATUS_TINT[tournament.status] ?? STATUS_TINT.draft;
  const dateRange = formatDateRange(tournament.start_date, tournament.end_date);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <Stack.Screen options={{ title: tournament.name }} />

      <View style={styles.hero}>
        <View style={[styles.statusPill, { backgroundColor: tint.bg, alignSelf: 'flex-start' }]}>
          <Text style={[styles.statusPillText, { color: tint.fg }]}>{tournament.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.heroMeta}>
          {FORMAT_LABEL[tournament.format] ?? tournament.format}
          {dateRange ? ` · ${dateRange}` : ''}
        </Text>
        {tournament.description && (
          <Text style={styles.heroDescription}>{tournament.description}</Text>
        )}

        {tenantSlug && tournament.status !== 'draft' && (
          <Link href={`/tournament/${tenantSlug}/${tournament.slug}` as never} asChild>
            <Pressable style={styles.publicLink}>
              <Text style={styles.publicLinkText}>View public page →</Text>
            </Pressable>
          </Link>
        )}
      </View>

      {/* STATUS SWITCHER */}
      <Text style={styles.sectionKicker}>STATUS</Text>
      <View style={styles.statusRow}>
        {STATUS_FLOW.map((s) => {
          const active = s.value === tournament.status;
          return (
            <Pressable
              key={s.value}
              disabled={active || updatingStatus}
              onPress={() => changeStatus(s.value)}
              style={[styles.statusOption, active && styles.statusOptionActive]}
            >
              <Text style={[styles.statusOptionLabel, active && styles.statusOptionLabelActive]}>{s.label}</Text>
              <Text style={[styles.statusOptionHint, active && styles.statusOptionHintActive]}>{s.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* OVERVIEW STATS */}
      <Text style={styles.sectionKicker}>OVERVIEW</Text>
      <View style={styles.statGrid}>
        <Stat label="Teams" value={teams.length} sub={tournament.max_teams ? `of ${tournament.max_teams}` : undefined} />
        <Stat label="Matches" value={matches.length} sub="scheduled or done" />
        <Stat label="Entry fee" value={tournament.entry_fee != null ? `₹${tournament.entry_fee.toLocaleString('en-IN')}` : '—'} />
        <Stat label="Prize pool" value={tournament.prize_pool != null ? `₹${tournament.prize_pool.toLocaleString('en-IN')}` : '—'} />
      </View>

      {/* TEAMS */}
      <Text style={styles.sectionKicker}>TEAMS · {teams.length}</Text>
      {teams.length === 0 ? (
        <Text style={styles.empty}>No teams registered yet.</Text>
      ) : (
        <View style={styles.teamsList}>
          {teams.map((t) => (
            <View key={t.id} style={styles.teamRow}>
              <View
                style={[styles.teamBadge, { backgroundColor: t.primary_color ?? theme.colors.primary }]}
              >
                <Text style={styles.teamBadgeText}>{t.short_name ?? t.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.teamMain}>
                <Text style={styles.teamName} numberOfLines={1}>{t.name}</Text>
                {t.city && <Text style={styles.teamCity}>{t.city}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* FIXTURES */}
      <Text style={styles.sectionKicker}>FIXTURES · {matches.length}</Text>
      {matches.length === 0 ? (
        <Text style={styles.empty}>No matches yet. Generate fixtures from the web app.</Text>
      ) : (
        <View style={styles.matchesList}>
          {matches.map((m) => (
            <Link key={m.id} href={`/match/${m.id}` as never} asChild>
              <Pressable style={styles.matchRow}>
                <View style={styles.matchSideBlock}>
                  <Text style={styles.matchTeam} numberOfLines={1}>{m.home_team?.name ?? 'TBD'}</Text>
                  <Text style={styles.matchTeam} numberOfLines={1}>{m.away_team?.name ?? 'TBD'}</Text>
                </View>
                <View style={styles.matchScoreBlock}>
                  {m.status === 'completed' || m.status === 'live' ? (
                    <Text style={styles.matchScore}>{m.home_score} · {m.away_score}</Text>
                  ) : (
                    <Text style={styles.matchTime}>
                      {formatDateTime(m.scheduled_at)}
                    </Text>
                  )}
                  <Text style={styles.matchStatus}>{m.status.toUpperCase()}{m.round ? ` · ${m.round}` : ''}</Text>
                </View>
                <Text style={styles.rowArrow}>→</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      {/* DEEP LINKS — manage teams + fixtures from the phone */}
      <Text style={styles.sectionKicker}>MANAGE</Text>
      <View style={styles.manageGrid}>
        <Link href={`/organiser/tournaments/${tournament.id}/teams` as never} asChild>
          <Pressable style={styles.manageCard}>
            <Text style={styles.manageGlyph}>♔</Text>
            <Text style={styles.manageLabel}>Teams</Text>
            <Text style={styles.manageSub}>{teams.length} registered</Text>
          </Pressable>
        </Link>
        <Link href={`/organiser/tournaments/${tournament.id}/fixtures` as never} asChild>
          <Pressable style={styles.manageCard}>
            <Text style={styles.manageGlyph}>●</Text>
            <Text style={styles.manageLabel}>Fixtures</Text>
            <Text style={styles.manageSub}>{matches.length} match{matches.length === 1 ? '' : 'es'}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  notFound: { color: theme.colors.textMuted, fontSize: theme.font.body },

  hero: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 6,
  },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 6 },
  heroMeta: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  heroDescription: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20, marginTop: theme.spacing.sm },
  publicLink: { marginTop: theme.spacing.md },
  publicLinkText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  sectionKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.md },

  statusRow: { gap: theme.spacing.xs },
  statusOption: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statusOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' },
  statusOptionLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
  statusOptionLabelActive: { color: theme.colors.primary },
  statusOptionHint: { color: theme.colors.textMuted, fontSize: 11 },
  statusOptionHintActive: { color: theme.colors.primary + 'cc' },

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
  statValue: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statSub: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },

  teamsList: { gap: theme.spacing.xs },
  teamRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  teamBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  teamBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  teamMain: { flex: 1, gap: 2 },
  teamName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  teamCity: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  matchesList: { gap: theme.spacing.xs },
  matchRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  matchSideBlock: { flex: 1, gap: 2 },
  matchTeam: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  matchScoreBlock: { alignItems: 'flex-end', gap: 2 },
  matchScore: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '900' },
  matchTime: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  matchStatus: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  rowArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },

  manageGrid: { flexDirection: 'row', gap: theme.spacing.sm },
  manageCard: {
    flex: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  manageGlyph: { color: theme.colors.primary, fontSize: 28, fontWeight: '900' },
  manageLabel: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  manageSub: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
});
