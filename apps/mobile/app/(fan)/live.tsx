import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';
import { LiveMatchCard } from '../../src/components/live-match-card';
import { formatDateTime } from '../../src/lib/format';
import type { LiveMatchRow, UpcomingMatchRow } from '../../src/lib/types';

// "Live" tab — every match currently live across the platform, plus the next
// 12 scheduled fixtures. Mirrors apps/web/src/app/(marketing)/live/page.tsx.
export default function FanLiveScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState<LiveMatchRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatchRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [liveRes, upcomingRes] = await Promise.all([
      supabase
        .from('matches')
        .select(
          `id, home_score, away_score, current_half, clock_seconds, scheduled_at, round,
           home_team:home_team_id(name, short_name, primary_color),
           away_team:away_team_id(name, short_name, primary_color),
           tournament:tournament_id(name, slug),
           tenant:tenant_id(name, slug)`,
        )
        .eq('status', 'live')
        .order('updated_at', { ascending: false }),
      supabase
        .from('matches')
        .select(
          `id, scheduled_at, round,
           home_team:home_team_id(name, short_name),
           away_team:away_team_id(name, short_name),
           tournament:tournament_id(name),
           tenant:tenant_id(name, slug)`,
        )
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(12),
    ]);

    setLive((liveRes.data ?? []) as unknown as LiveMatchRow[]);
    setUpcoming((upcomingRes.data ?? []) as unknown as UpcomingMatchRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: any UPDATE on a row in `matches` (score, status change) refreshes
  // the live list. Cheap because we only hold ~10 rows.
  useEffect(() => {
    const channel = supabase
      .channel('public-fan-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!loaded) {
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
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE NOW</Text>
        </View>
        <Text style={styles.title}>
          {live.length === 0
            ? 'Nothing live right now'
            : `${live.length} ${live.length === 1 ? 'match' : 'matches'} on the mat`}
        </Text>
        <Text style={styles.subtitle}>
          Tap any card for the public scoreboard — no sign-up needed.
        </Text>
      </View>

      {live.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>○</Text>
          <Text style={styles.emptyTitle}>Quiet on the mat</Text>
          <Text style={styles.emptyBody}>
            Check back when an organiser opens a match, or browse upcoming fixtures below.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {live.map((m) => (
            <LiveMatchCard key={m.id} match={m} />
          ))}
        </View>
      )}

      <Text style={styles.upcomingHeader}>UPCOMING</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.upcomingEmpty}>No matches scheduled in the near future.</Text>
      ) : (
        <View style={styles.upcomingList}>
          {upcoming.map((m) => (
            <UpcomingItem key={m.id} match={m} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function UpcomingItem({ match }: { match: UpcomingMatchRow }) {
  return (
    <View style={styles.upcomingItem}>
      <Text style={styles.upcomingTime}>{formatDateTime(match.scheduled_at)}</Text>
      <Text style={styles.upcomingMatchup} numberOfLines={1}>
        {match.home_team?.name ?? 'TBD'} vs {match.away_team?.name ?? 'TBD'}
      </Text>
      <Text style={styles.upcomingMeta} numberOfLines={1}>
        {match.tournament?.name ?? match.tenant?.name ?? '—'}
        {match.round ? ` · ${match.round}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + 24, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { gap: 6 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.danger + '22',
    borderWidth: 1,
    borderColor: theme.colors.danger + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    marginBottom: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger },
  liveBadgeText: { color: theme.colors.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  list: { gap: theme.spacing.sm, marginTop: theme.spacing.md },

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
  emptyGlyph: { color: theme.colors.textMuted, fontSize: 36, fontWeight: '300', marginBottom: 4 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },

  upcomingHeader: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.lg },
  upcomingList: { gap: theme.spacing.sm },
  upcomingItem: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
  },
  upcomingTime: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  upcomingMatchup: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700', marginTop: 2 },
  upcomingMeta: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  upcomingEmpty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },
});
