import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/theme';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>KABADDIADDA</Text>
        <Text style={styles.title}>The home of Kabaddi.</Text>
        <Text style={styles.subtitle}>
          Live scores, fixtures, players, and tournaments — all in one app.
        </Text>
      </View>

      <View style={styles.liveCard}>
        <View style={styles.liveHeader}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE · Q3 · 4:02</Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>Bengal Warriors</Text>
            <Text style={styles.score}>34</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.teamName}>Patna Pirates</Text>
            <Text style={[styles.score, { color: theme.colors.primary }]}>28</Text>
          </View>
        </View>
        <View style={styles.eventBox}>
          <Text style={styles.eventTitle}>Pawan Sehrawat</Text>
          <Text style={styles.eventBody}>3-point Super Raid · just now</Text>
        </View>
      </View>

      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>Sign in</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  hero: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xl },
  kicker: {
    color: theme.colors.primary,
    fontSize: theme.font.small,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.h1,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  liveCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
  },
  liveHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger },
  liveText: { color: theme.colors.danger, fontSize: theme.font.small, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', marginTop: theme.spacing.lg },
  teamName: { color: theme.colors.textMuted, fontSize: theme.font.small },
  score: { color: theme.colors.text, fontSize: 48, fontWeight: '800', marginTop: 4 },
  eventBox: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eventTitle: { color: theme.colors.text, fontWeight: '700' },
  eventBody: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
  cta: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: theme.font.body },
});
