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
import { theme } from '../../src/theme';
import { TournamentCard } from '../../src/components/tournament-card';
import type { TournamentRow } from '../../src/lib/types';

type StatusFilter = 'all' | 'live' | 'upcoming' | 'completed';
const FILTER_OPTIONS: StatusFilter[] = ['all', 'live', 'upcoming', 'completed'];

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

// Tournaments tab — same data as apps/web/src/app/(marketing)/tournaments/page.tsx,
// status filters baked into the same row of pills.
export default function FanTournamentsScreen() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (which: StatusFilter) => {
    let q = supabase
      .from('tournaments')
      .select(
        'id, slug, name, format, status, start_date, end_date, cover_image, tenant:tenant_id(slug, name, logo_url)',
      )
      .neq('status', 'draft')
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(60);

    if (which !== 'all') {
      // 'upcoming' on the web maps to status=scheduled, the others map 1:1.
      q = q.eq('status', which === 'upcoming' ? 'scheduled' : which);
    }

    const { data } = await q;
    setTournaments((data ?? []) as unknown as TournamentRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    setLoaded(false);
    load(filter);
  }, [filter, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>TOURNAMENTS</Text>
        <Text style={styles.title}>Every league on Kabaddiadda</Text>
        <Text style={styles.subtitle}>
          Browse leagues, knockouts, and championships. Tap any card for fixtures, teams, and live scoring.
        </Text>
      </View>

      <View style={styles.filters}>
        {FILTER_OPTIONS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{FILTER_LABEL[f]}</Text>
            </Pressable>
          );
        })}
      </View>

      {!loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : tournaments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>♔</Text>
          <Text style={styles.emptyTitle}>No tournaments match</Text>
          <Text style={styles.emptyBody}>
            Try a different filter, or check back when more leagues publish their schedule.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + 24, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { gap: 4 },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.md },
  filterPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgElevated,
  },
  filterPillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  filterTextActive: { color: '#fff', fontWeight: '800' },

  loading: { paddingVertical: theme.spacing.xxl, alignItems: 'center' },

  list: { gap: theme.spacing.md },

  empty: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
  },
  emptyGlyph: { color: theme.colors.primary + '66', fontSize: 36, fontWeight: '300', marginBottom: 4 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },
});
