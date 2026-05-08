import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { FORMAT_LABEL, formatDateRange } from '../lib/format';
import type { TournamentRow } from '../lib/types';

const STATUS_TINT: Record<string, { bg: string; fg: string; label?: string }> = {
  live: { bg: theme.colors.danger + '22', fg: theme.colors.danger, label: '● LIVE' },
  scheduled: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'SCHEDULED' },
  upcoming: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'UPCOMING' },
  completed: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'COMPLETED' },
  registration: { bg: theme.colors.success + '22', fg: theme.colors.success, label: 'OPEN' },
};

export function TournamentCard({ tournament }: { tournament: TournamentRow }) {
  const tenantSlug = tournament.tenant?.slug;
  const href = tenantSlug ? `/tournament/${tenantSlug}/${tournament.slug}` : '/';
  const status = STATUS_TINT[tournament.status] ?? STATUS_TINT.scheduled;
  const dateRange = formatDateRange(tournament.start_date, tournament.end_date);

  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.card}>
        {tournament.cover_image ? (
          <Image source={{ uri: tournament.cover_image }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.placeholderGlyph}>♔</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.tenant} numberOfLines={1}>
              {tournament.tenant?.name ?? 'Organiser'}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.fg }]}>{status.label ?? tournament.status.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {tournament.name}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{FORMAT_LABEL[tournament.format] ?? tournament.format}</Text>
            {dateRange && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaText}>{dateRange}</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
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
  cover: { width: '100%', height: 120 },
  coverPlaceholder: {
    backgroundColor: theme.colors.primary + '11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGlyph: { fontSize: 48, color: theme.colors.primary + '66' },
  body: { padding: theme.spacing.md, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenant: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.textMuted },
});
