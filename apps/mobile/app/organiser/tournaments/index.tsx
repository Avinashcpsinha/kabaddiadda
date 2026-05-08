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
import { supabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/lib/use-session';
import { theme } from '../../../src/theme';
import { FORMAT_LABEL, formatDateRange } from '../../../src/lib/format';

interface OrganiserTournamentRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  format: string;
  start_date: string | null;
  end_date: string | null;
}

const STATUS_TINT: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: theme.colors.danger + '22', fg: theme.colors.danger, label: '● LIVE' },
  draft: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'DRAFT' },
  scheduled: { bg: theme.colors.primary + '22', fg: theme.colors.primary, label: 'SCHEDULED' },
  registration: { bg: theme.colors.success + '22', fg: theme.colors.success, label: 'REGISTRATION' },
  completed: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'COMPLETED' },
  archived: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'ARCHIVED' },
};

// Organiser-side tournaments index — every tournament owned by this tenant,
// drafts included. Tap a row to open management; tap "+ New" to create.
export default function OrganiserTournamentsIndex() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<OrganiserTournamentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Auth gate — same pattern as the dashboard.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, slug, status, format, start_date, end_date')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as OrganiserTournamentRow[]);
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
        <Stack.Screen options={{ title: 'Tournaments' }} />
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
      <Stack.Screen options={{ title: 'Tournaments' }} />

      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR LEAGUE</Text>
        <Text style={styles.title}>Tournaments</Text>
        <Text style={styles.subtitle}>
          {rows.length === 0
            ? 'No tournaments yet — create your first below.'
            : `${rows.length} tournament${rows.length === 1 ? '' : 's'} in your league.`}
        </Text>
      </View>

      <Link href="/organiser/tournaments/new" asChild>
        <Pressable style={styles.ctaPrimary}>
          <Text style={styles.ctaPrimaryText}>+ New tournament</Text>
        </Pressable>
      </Link>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>♔</Text>
          <Text style={styles.emptyTitle}>No tournaments yet</Text>
          <Text style={styles.emptyBody}>
            Create one to start adding teams, generating fixtures, and scoring matches.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((t) => {
            const tint = STATUS_TINT[t.status] ?? STATUS_TINT.draft;
            const dateRange = formatDateRange(t.start_date, t.end_date);
            return (
              <Link key={t.id} href={`/organiser/tournaments/${t.id}` as never} asChild>
                <Pressable style={styles.row}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTopLine}>
                      <Text style={styles.rowName} numberOfLines={1}>{t.name}</Text>
                      <View style={[styles.statusPill, { backgroundColor: tint.bg }]}>
                        <Text style={[styles.statusPillText, { color: tint.fg }]}>{tint.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>
                      {FORMAT_LABEL[t.format] ?? t.format}
                      {dateRange ? ` · ${dateRange}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowArrow}>→</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },

  header: { gap: 4 },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },

  list: { gap: theme.spacing.sm },

  row: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rowMain: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  rowName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700', flex: 1 },
  rowMeta: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowArrow: { color: theme.colors.primary, fontSize: 16, fontWeight: '900' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  empty: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyGlyph: { color: theme.colors.primary + '66', fontSize: 36, fontWeight: '300' },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800', marginTop: 4 },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },
});
