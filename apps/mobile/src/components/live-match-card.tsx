import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { formatClock } from '../lib/format';
import type { LiveMatchRow } from '../lib/types';

// Fan-side compact live match card — used on the feed, live tab, and tournament detail.
// Tap target deep-links into /match/[id], the public scoreboard.
export function LiveMatchCard({ match }: { match: LiveMatchRow }) {
  const home = match.home_team;
  const away = match.away_team;
  const homeColor = home?.primary_color ?? theme.colors.primary;
  const awayColor = away?.primary_color ?? '#0ea5e9';

  return (
    <Link href={`/match/${match.id}`} asChild>
      <Pressable style={styles.card}>
        {/* Split-color top accent — quick visual ID of which two teams are playing */}
        <View style={styles.accentRow}>
          <View style={[styles.accent, { backgroundColor: homeColor }]} />
          <View style={[styles.accent, { backgroundColor: awayColor }]} />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.tournament} numberOfLines={1}>
              {match.tournament?.name ?? match.tenant?.name ?? '—'}
            </Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <TeamRow team={home} score={match.home_score} accent={homeColor} />
          <TeamRow team={away} score={match.away_score} accent={awayColor} />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Q{match.current_half} · {formatClock(match.clock_seconds)}
            </Text>
            <Text style={styles.footerArrow}>→</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function TeamRow({
  team,
  score,
  accent,
}: {
  team: { name: string; short_name: string | null } | null;
  score: number;
  accent: string;
}) {
  return (
    <View style={styles.teamRow}>
      <View style={[styles.shortBadge, { backgroundColor: accent }]}>
        <Text style={styles.shortBadgeText}>{team?.short_name ?? '??'}</Text>
      </View>
      <Text style={styles.teamName} numberOfLines={1}>
        {team?.name ?? 'TBD'}
      </Text>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  accentRow: { flexDirection: 'row', height: 3 },
  accent: { flex: 1 },
  body: { padding: theme.spacing.md, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tournament: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.danger + '22',
    borderWidth: 1,
    borderColor: theme.colors.danger + '55',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger },
  liveBadgeText: { color: theme.colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shortBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  teamName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600', flex: 1 },
  score: { color: theme.colors.text, fontSize: 22, fontWeight: '900', minWidth: 36, textAlign: 'right' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  footerArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },
});
