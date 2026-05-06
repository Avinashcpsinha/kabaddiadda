import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSession } from '../src/lib/use-session';
import { theme } from '../src/theme';

// Landing screen — splash + entry points. If a session is already
// stored on this device, route to the right next screen automatically:
//   • signed-in & has tenant     → /organiser dashboard
//   • signed-in & no tenant yet  → /setup
//   • not signed in              → render the sign-in / sign-up CTAs
export default function HomeScreen() {
  const router = useRouter();
  const { loading, user } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.tenantId) router.replace('/organiser');
    else router.replace('/setup');
  }, [loading, user, router]);

  if (loading || user) {
    // user is non-null here only briefly while the redirect is queued —
    // the spinner avoids flashing the marketing copy at someone who's
    // already signed in.
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>KABADDIADDA</Text>
        <Text style={styles.title}>Run your league from your pocket.</Text>
        <Text style={styles.subtitle}>
          Set up tournaments, manage teams, score live matches, and broadcast — all from your phone.
        </Text>
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewKicker}>PREVIEW</Text>
        <Text style={styles.previewTitle}>Live scoring console</Text>
        <Text style={styles.previewBody}>
          Tap below to play with the scoring UI. No sign-in needed — uses dummy team rosters so you
          can try the flow before you hook up your league.
        </Text>
        <Link href="/scoring" asChild>
          <Pressable style={styles.previewBtn}>
            <Text style={styles.previewBtnText}>Open scoring console</Text>
          </Pressable>
        </Link>
      </View>

      <Link href="/(auth)/signup" asChild>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>Create organiser account</Text>
        </Pressable>
      </Link>
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.ctaGhost}>
          <Text style={styles.ctaGhostText}>I already have an account</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xl },
  kicker: {
    color: theme.colors.primary,
    fontSize: theme.font.small,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
  },
  title: { color: theme.colors.text, fontSize: theme.font.h1, fontWeight: '800', lineHeight: 38 },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  previewCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    gap: 6,
  },
  previewKicker: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  previewTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800', marginTop: 4 },
  previewBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 20,
    marginVertical: theme.spacing.sm,
  },
  previewBtn: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  previewBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small },
  cta: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: theme.font.body },
  ctaGhost: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ctaGhostText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body },
});
