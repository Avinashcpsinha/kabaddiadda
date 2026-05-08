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
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';
import { LiveMatchCard } from '../../src/components/live-match-card';
import { formatDateTime } from '../../src/lib/format';
import type { LiveMatchRow, UpcomingMatchRow } from '../../src/lib/types';

// Fan feed = the signed-in fan's home. Three sections:
//   1. Hero stat strip — live now / following / upcoming counts
//   2. Live now list (taps into /match/[id])
//   3. Upcoming fixtures (next 6, scheduled in the future)
//
// Mirrors apps/web/src/app/feed/page.tsx, same query shapes.
export default function FanFeedScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState<LiveMatchRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatchRow[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [liveRes, upcomingRes, followsRes] = await Promise.all([
      supabase
        .from('matches')
        .select(
          `id, home_score, away_score, current_half, clock_seconds, scheduled_at, round,
           home_team:home_team_id(name, short_name, primary_color),
           away_team:away_team_id(name, short_name, primary_color),
           tournament:tournament_id(name),
           tenant:tenant_id(name)`,
        )
        .eq('status', 'live')
        .order('updated_at', { ascending: false })
        .limit(8),
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
        .limit(6),
      user
        ? supabase
            .from('follows')
            .select('target_id', { count: 'exact', head: true })
            .eq('user_id', user.id)
        : Promise.resolve({ count: 0 } as { count: number }),
    ]);

    setLive((liveRes.data ?? []) as unknown as LiveMatchRow[]);
    setUpcoming((upcomingRes.data ?? []) as unknown as UpcomingMatchRow[]);
    setFollowingCount(followsRes.count ?? 0);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (sessionLoading) return;
    load();
  }, [sessionLoading, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (sessionLoading || !loaded) {
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
      {/* HERO greeting + stat strip */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[theme.colors.primary + '22', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.kicker}>FAN ZONE</Text>
        <Text style={styles.greeting}>
          Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.greetingSub}>
          {live.length > 0
            ? `${live.length} ${live.length === 1 ? 'match is' : 'matches are'} live right now.`
            : 'Nothing live right now — check back soon.'}
        </Text>

        <View style={styles.statRow}>
          <Stat value={String(live.length)} label="Live" />
          <View style={styles.statDivider} />
          <Stat value={user ? String(followingCount) : '—'} label="Following" />
          <View style={styles.statDivider} />
          <Stat value={String(upcoming.length)} label="Upcoming" />
        </View>
      </View>

      {/* If we don't have a session, push to /(auth)/signup for follow/upcoming gating */}
      {!user && (
        <Pressable style={styles.signInPrompt} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signInTitle}>Sign in to follow teams</Text>
          <Text style={styles.signInBody}>
            Get push notifications when your teams play, save favourites, and unlock personalised stats.
          </Text>
          <View style={styles.signInBtn}>
            <Text style={styles.signInBtnText}>Create free account →</Text>
          </View>
        </Pressable>
      )}

      {/* LIVE NOW */}
      <SectionHeader title="Live now" trailingHref="/(fan)/live" trailingLabel="See all" />
      {live.length === 0 ? (
        <EmptyBlock title="Nothing live" body="No matches on the mat right now. Pull to refresh or check upcoming below." />
      ) : (
        <View style={styles.list}>
          {live.slice(0, 4).map((m) => (
            <LiveMatchCard key={m.id} match={m} />
          ))}
        </View>
      )}

      {/* UPCOMING */}
      <SectionHeader title="Upcoming" />
      {upcoming.length === 0 ? (
        <EmptyBlock title="Nothing scheduled" body="No matches scheduled in the near future." />
      ) : (
        <View style={styles.upcomingList}>
          {upcoming.map((m) => (
            <UpcomingRow key={m.id} match={m} />
          ))}
        </View>
      )}

      <Text style={styles.footer}>kabaddiadda · pull down to refresh</Text>
    </ScrollView>
  );
}

function SectionHeader({
  title,
  trailingHref,
  trailingLabel,
}: {
  title: string;
  trailingHref?: string;
  trailingLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {trailingHref && trailingLabel && (
        <Link href={trailingHref as never} asChild>
          <Pressable>
            <Text style={styles.sectionLink}>{trailingLabel} →</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UpcomingRow({ match }: { match: UpcomingMatchRow }) {
  const home = match.home_team;
  const away = match.away_team;
  return (
    <View style={styles.upcomingRow}>
      <View style={styles.upcomingDateBlock}>
        <Text style={styles.upcomingDate}>{formatDateTime(match.scheduled_at)}</Text>
        {match.round && <Text style={styles.upcomingRound}>{match.round}</Text>}
      </View>
      <Text style={styles.upcomingMatchup} numberOfLines={1}>
        <Text style={styles.upcomingTeam}>{home?.name ?? 'TBD'}</Text>
        <Text style={styles.upcomingVs}>  vs  </Text>
        <Text style={styles.upcomingTeam}>{away?.name ?? 'TBD'}</Text>
      </Text>
      <Text style={styles.upcomingTournament} numberOfLines={1}>
        {match.tournament?.name ?? match.tenant?.name ?? '—'}
      </Text>
    </View>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
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
    gap: 4,
    overflow: 'hidden',
  },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  greeting: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  greetingSub: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18, marginBottom: theme.spacing.md },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: theme.colors.border },

  signInPrompt: {
    backgroundColor: theme.colors.primary + '11',
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 6,
  },
  signInTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800' },
  signInBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
  signInBtn: { marginTop: theme.spacing.sm },
  signInBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: theme.font.small },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: theme.spacing.md },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800' },
  sectionLink: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '700' },

  list: { gap: theme.spacing.sm },

  upcomingList: { gap: theme.spacing.sm },
  upcomingRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  upcomingDateBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upcomingDate: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  upcomingRound: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  upcomingMatchup: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700', marginTop: 2 },
  upcomingTeam: { color: theme.colors.text, fontWeight: '700' },
  upcomingVs: { color: theme.colors.textMuted, fontWeight: '500' },
  upcomingTournament: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },

  empty: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },

  footer: { color: theme.colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: theme.spacing.lg, letterSpacing: 1 },
});
