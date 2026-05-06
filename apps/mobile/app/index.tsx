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

// Marketing landing — the very first thing a visitor sees. Auth-aware:
// if a session is already cached on this device we skip past it
// straight to /organiser (or /setup if their tenant isn't created yet).
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollWrap}
      showsVerticalScrollIndicator={false}
    >
      {/* Top decorative band */}
      <View style={styles.glow} />

      {/* LOGO + WORDMARK */}
      <View style={styles.logoBlock}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>K</Text>
        </View>
        <Text style={styles.wordmark}>KABADDIADDA</Text>
        <View style={styles.liveDot}>
          <View style={styles.liveDotInner} />
          <Text style={styles.liveDotText}>LIVE PLATFORM</Text>
        </View>
      </View>

      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Welcome to Kabaddiadda.</Text>
        <Text style={styles.heroSub}>
          Start your tournament today. Score live matches, broadcast to YouTube, and let fans follow
          every raid in real time.
        </Text>
      </View>

      {/* FEATURE STRIP */}
      <View style={styles.featureGrid}>
        <Feature
          icon="⚡"
          title="Live scoring"
          body="Pitch-side console for raids, tackles, bonuses, cards. Realtime to fans."
        />
        <Feature
          icon="📺"
          title="Broadcast overlay"
          body="A clean live strip you drop into OBS. Looks like a TV broadcast."
        />
        <Feature
          icon="🏆"
          title="Tournaments"
          body="League, knockout, group + knockout. Auto round-robin in one tap."
        />
        <Feature
          icon="📲"
          title="Run from anywhere"
          body="Manage rosters, lock lineups, end matches — all from your phone."
        />
      </View>

      {/* CTAs */}
      <View style={styles.ctaBlock}>
        <Link href="/(auth)/signup" asChild>
          <Pressable style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Create organiser account</Text>
            <Text style={styles.ctaPrimaryHint}>Free · 2 minutes · no card needed</Text>
          </Pressable>
        </Link>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.ctaGhost}>
            <Text style={styles.ctaGhostText}>I already have an account</Text>
          </Pressable>
        </Link>
      </View>

      {/* PREVIEW CARD */}
      <View style={styles.previewCard}>
        <Text style={styles.previewKicker}>WANT TO SEE FIRST?</Text>
        <Text style={styles.previewTitle}>Try the live scoring console</Text>
        <Text style={styles.previewBody}>
          No sign-up needed. Plays out a sample match with dummy team rosters so you can feel the
          flow before you commit.
        </Text>
        <Link href="/scoring" asChild>
          <Pressable style={styles.previewBtn}>
            <Text style={styles.previewBtnText}>Open preview</Text>
            <Text style={styles.previewBtnArrow}>→</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.footer}>kabaddiadda.com · made for the sport</Text>
    </ScrollView>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  scrollWrap: { paddingBottom: 48 },

  // Subtle orange glow band at the top — gives the screen warmth without
  // needing an image asset.
  glow: {
    position: 'absolute',
    top: 0,
    left: -80,
    right: -80,
    height: 360,
    backgroundColor: theme.colors.primary,
    opacity: 0.08,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
  },

  // Logo block
  logoBlock: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl + 24,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoBadgeText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  wordmark: {
    color: theme.colors.text,
    fontSize: theme.font.h3,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: theme.spacing.xs,
  },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.success + '22',
    borderWidth: 1,
    borderColor: theme.colors.success + '55',
    marginTop: 4,
  },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success },
  liveDotText: { color: theme.colors.success, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  // Hero
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    alignItems: 'center',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
  },
  heroSub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },

  // Feature strip
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  feature: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 4,
  },
  featureIcon: { fontSize: 22, marginBottom: 4 },
  featureTitle: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
  featureBody: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },

  // CTAs
  ctaBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaPrimaryText: { color: '#fff', fontWeight: '800', fontSize: theme.font.body },
  ctaPrimaryHint: { color: '#ffffffaa', fontSize: 11, marginTop: 4 },
  ctaGhost: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ctaGhostText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body },

  // Preview card
  previewCard: {
    marginTop: theme.spacing.xl,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 6,
  },
  previewKicker: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  previewTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800', marginTop: 2 },
  previewBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 20,
    marginVertical: theme.spacing.sm,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xs,
  },
  previewBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small },
  previewBtnArrow: { color: theme.colors.primary, fontWeight: '800', fontSize: theme.font.body },

  footer: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: theme.spacing.xl + 8,
    letterSpacing: 1,
  },
});
