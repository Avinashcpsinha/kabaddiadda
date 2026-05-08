import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../src/lib/supabase';
import { theme } from '../../../src/theme';
import { LiveMatchCard } from '../../../src/components/live-match-card';
import { FollowButton } from '../../../src/components/follow-button';
import { FORMAT_LABEL, formatDateRange, formatDateTime } from '../../../src/lib/format';
import type { LiveMatchRow } from '../../../src/lib/types';

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

interface TournamentDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  max_teams: number | null;
  prize_pool: number | null;
  cover_image: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  primary_color: string | null;
}

interface FixtureMatch {
  id: string;
  scheduled_at: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
}

// Public tournament page — anyone can view a non-draft tournament. Mirrors
// apps/web/src/app/t/[tenant]/[tournament]/page.tsx queries.
export default function TournamentDetailScreen() {
  const router = useRouter();
  const { tenantSlug, slug } = useLocalSearchParams<{ tenantSlug: string; slug: string }>();
  const tSlug = Array.isArray(tenantSlug) ? tenantSlug[0] : tenantSlug;
  const trSlug = Array.isArray(slug) ? slug[0] : slug;

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<FixtureMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tSlug || !trSlug) return;

    async function load() {
      setLoading(true);
      const { data: ten } = await supabase
        .from('tenants')
        .select('id, slug, name, logo_url')
        .eq('slug', tSlug)
        .eq('status', 'active')
        .maybeSingle();

      if (!ten) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTenant(ten as TenantRow);

      const { data: tour } = await supabase
        .from('tournaments')
        .select(
          'id, slug, name, description, format, status, start_date, end_date, max_teams, prize_pool, cover_image',
        )
        .eq('tenant_id', ten.id)
        .eq('slug', trSlug)
        .neq('status', 'draft')
        .maybeSingle();

      if (!tour) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTournament(tour as TournamentDetail);

      const [teamsRes, matchesRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, short_name, city, primary_color')
          .eq('tournament_id', tour.id)
          .order('name'),
        supabase
          .from('matches')
          .select(
            `id, scheduled_at, status, round, home_score, away_score, current_half, clock_seconds,
             home_team:home_team_id(id, name, short_name, primary_color),
             away_team:away_team_id(id, name, short_name, primary_color)`,
          )
          .eq('tournament_id', tour.id)
          .order('scheduled_at', { ascending: false }),
      ]);

      setTeams((teamsRes.data ?? []) as TeamRow[]);
      setMatches((matchesRes.data ?? []) as unknown as FixtureMatch[]);
      setLoading(false);
    }

    load();
  }, [tSlug, trSlug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Loading…' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (notFound || !tournament || !tenant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.notFoundTitle}>Tournament not found</Text>
        <Text style={styles.notFoundBody}>
          The link may be wrong, or the tournament hasn't been published yet.
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const completed = matches.filter((m) => m.status === 'completed').slice(0, 10);

  // Adapt live matches into the LiveMatchCard's expected shape (it expects
  // tournament + tenant). We carry the tenant + tournament from the page itself.
  const liveCardRows: LiveMatchRow[] = liveMatches.map((m) => ({
    id: m.id,
    home_score: m.home_score,
    away_score: m.away_score,
    current_half: m.current_half,
    clock_seconds: m.clock_seconds,
    scheduled_at: m.scheduled_at,
    round: m.round,
    home_team: m.home_team,
    away_team: m.away_team,
    tournament: { name: tournament.name, slug: tournament.slug },
    tenant: { name: tenant.name, slug: tenant.slug, logo_url: tenant.logo_url },
  }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: tournament.name }} />

      {/* Hero */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[theme.colors.primary + '22', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroTenant}>{tenant.name}</Text>
        <Text style={styles.heroName}>{tournament.name}</Text>
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaItem}>{FORMAT_LABEL[tournament.format] ?? tournament.format}</Text>
          {formatDateRange(tournament.start_date, tournament.end_date) && (
            <>
              <View style={styles.heroDot} />
              <Text style={styles.heroMetaItem}>{formatDateRange(tournament.start_date, tournament.end_date)}</Text>
            </>
          )}
          <View style={styles.heroDot} />
          <Text style={styles.heroMetaItem}>{tournament.status.toUpperCase()}</Text>
        </View>
        {tournament.description && (
          <Text style={styles.heroDescription}>{tournament.description}</Text>
        )}

        <View style={styles.followRow}>
          <FollowButton targetType="tournament" targetId={tournament.id} label="this tournament" />
        </View>
      </View>

      {/* Live now */}
      {liveCardRows.length > 0 && (
        <>
          <Text style={styles.sectionKicker}>● LIVE NOW</Text>
          <View style={styles.list}>
            {liveCardRows.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </View>
        </>
      )}

      {/* Upcoming */}
      <Text style={styles.sectionKicker}>UPCOMING</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.empty}>No matches scheduled.</Text>
      ) : (
        <View style={styles.list}>
          {upcoming.map((m) => (
            <FixtureRow key={m.id} match={m} variant="upcoming" />
          ))}
        </View>
      )}

      {/* Recent results */}
      {completed.length > 0 && (
        <>
          <Text style={styles.sectionKicker}>RECENT RESULTS</Text>
          <View style={styles.list}>
            {completed.map((m) => (
              <FixtureRow key={m.id} match={m} variant="completed" />
            ))}
          </View>
        </>
      )}

      {/* Teams */}
      <Text style={styles.sectionKicker}>TEAMS · {teams.length}</Text>
      {teams.length === 0 ? (
        <Text style={styles.empty}>No teams have registered yet.</Text>
      ) : (
        <View style={styles.teamGrid}>
          {teams.map((t) => (
            <View key={t.id} style={styles.teamCard}>
              <View
                style={[
                  styles.teamCardBadge,
                  { backgroundColor: t.primary_color ?? theme.colors.primary },
                ]}
              >
                <Text style={styles.teamCardBadgeText}>{t.short_name ?? t.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.teamCardText}>
                <Text style={styles.teamCardName} numberOfLines={1}>
                  {t.name}
                </Text>
                {t.city && <Text style={styles.teamCardCity}>{t.city}</Text>}
              </View>
              <FollowButton targetType="team" targetId={t.id} />
            </View>
          ))}
        </View>
      )}

      {/* Footer details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Tournament details</Text>
        <DetailRow label="Hosted by" value={tenant.name} />
        <DetailRow label="Format" value={FORMAT_LABEL[tournament.format] ?? tournament.format} />
        {formatDateRange(tournament.start_date, tournament.end_date) && (
          <DetailRow label="Dates" value={formatDateRange(tournament.start_date, tournament.end_date)!} />
        )}
        {tournament.max_teams && (
          <DetailRow label="Capacity" value={`${teams.length} / ${tournament.max_teams} teams`} />
        )}
        {tournament.prize_pool && (
          <DetailRow label="Prize pool" value={`₹${tournament.prize_pool.toLocaleString('en-IN')}`} />
        )}
      </View>
    </ScrollView>
  );
}

function FixtureRow({
  match,
  variant,
}: {
  match: FixtureMatch;
  variant: 'upcoming' | 'completed';
}) {
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;

  return (
    <Link href={`/match/${match.id}` as never} asChild>
      <Pressable style={styles.fixtureRow}>
        <View style={styles.fixtureSide}>
          <View
            style={[
              styles.fixtureBadge,
              { backgroundColor: match.home_team?.primary_color ?? theme.colors.primary },
            ]}
          >
            <Text style={styles.fixtureBadgeText}>{match.home_team?.short_name ?? '??'}</Text>
          </View>
          <Text
            style={[styles.fixtureTeamName, variant === 'completed' && homeWon && styles.fixtureTeamNameWin]}
            numberOfLines={1}
          >
            {match.home_team?.name ?? 'TBD'}
          </Text>
        </View>

        <View style={styles.fixtureCenter}>
          {variant === 'completed' ? (
            <>
              <Text style={styles.fixtureScore}>
                <Text style={homeWon ? styles.fixtureScoreWin : styles.fixtureScoreDim}>{match.home_score}</Text>
                <Text style={styles.fixtureScoreSep}>  ·  </Text>
                <Text style={awayWon ? styles.fixtureScoreWin : styles.fixtureScoreDim}>{match.away_score}</Text>
              </Text>
              <Text style={styles.fixtureFt}>FT</Text>
            </>
          ) : (
            <>
              <Text style={styles.fixtureDate}>
                {new Date(match.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
              <Text style={styles.fixtureTime}>
                {new Date(match.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </>
          )}
        </View>

        <View style={[styles.fixtureSide, { justifyContent: 'flex-end' }]}>
          <Text
            style={[styles.fixtureTeamName, { textAlign: 'right' }, variant === 'completed' && awayWon && styles.fixtureTeamNameWin]}
            numberOfLines={1}
          >
            {match.away_team?.name ?? 'TBD'}
          </Text>
          <View
            style={[
              styles.fixtureBadge,
              { backgroundColor: match.away_team?.primary_color ?? '#0ea5e9' },
            ]}
          >
            <Text style={styles.fixtureBadgeText}>{match.away_team?.short_name ?? '??'}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  notFoundTitle: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900' },
  notFoundBody: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', marginTop: 8 },
  backBtn: { marginTop: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md },
  backBtnText: { color: '#fff', fontWeight: '800' },

  hero: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    gap: 6,
  },
  heroTenant: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroName: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 2 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm },
  heroMetaItem: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.textMuted },
  heroDescription: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20, marginTop: theme.spacing.md },
  followRow: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.md },

  sectionKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.md },

  list: { gap: theme.spacing.sm },

  fixtureRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fixtureSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  fixtureBadge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  fixtureBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  fixtureTeamName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600', flexShrink: 1 },
  fixtureTeamNameWin: { fontWeight: '800' },
  fixtureCenter: { alignItems: 'center', minWidth: 70, gap: 1 },
  fixtureDate: { color: theme.colors.primary, fontSize: 11, fontWeight: '800' },
  fixtureTime: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' },
  fixtureScore: { fontSize: 16, fontWeight: '900' },
  fixtureScoreWin: { color: theme.colors.text },
  fixtureScoreDim: { color: theme.colors.textMuted },
  fixtureScoreSep: { color: theme.colors.textMuted },
  fixtureFt: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },

  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  teamCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCardBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  teamCardBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  teamCardText: { flex: 1, gap: 2 },
  teamCardName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  teamCardCity: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

  detailsCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  detailsTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm, paddingVertical: 4 },
  detailLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  detailValue: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
});
