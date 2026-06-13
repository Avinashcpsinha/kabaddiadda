import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSession } from '../src/lib/use-session';
import { theme } from '../src/theme';

// Background photos sourced from Unsplash (free license, no attribution
// required for use). Swap any of these URLs for your own brand artwork
// when you have it — the layout is photo-agnostic, it just expects a
// portrait-ish image at any resolution.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80&auto=format&fit=crop';
const ACTION_IMAGE_1 =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80&auto=format&fit=crop';
const ACTION_IMAGE_2 =
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80&auto=format&fit=crop';

const { width: SCREEN_W } = Dimensions.get('window');

// Marketing landing — full-bleed cinematic hero with stadium photo +
// gradient overlay, then the value prop, feature highlights, CTAs, and a
// scoring console preview link. Auth-aware: signed-in users skip past
// it to /organiser (or /setup if they haven't created a tenant yet).
export default function HomeScreen() {
  const router = useRouter();
  const { loading, user } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // Role-aware redirect:
    //   user        → fan tab navigator (/feed)
    //   organiser   → /organiser if their tenant is set up, /setup otherwise
    //   superadmin  → /organiser (platform admin console isn't built yet)
    if (user.role === 'user') router.replace('/(fan)/feed');
    else if (user.role === 'superadmin') router.replace('/organiser');
    else if (user.tenantId) router.replace('/organiser');
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
      {/* HERO — full-bleed photo + gradient + headline */}
      <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero} resizeMode="cover">
        <LinearGradient
          colors={[theme.colors.bg + 'cc', theme.colors.bg + '88', theme.colors.bg]}
          style={styles.heroOverlay}
          locations={[0, 0.55, 1]}
        />
        <LinearGradient
          colors={[theme.colors.primary + '00', theme.colors.primary + '33']}
          style={styles.heroAccent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.heroContent}>
          <View style={styles.logoBlock}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.wordmark}>KABADDIADDA</Text>
            <View style={styles.liveDot}>
              <View style={styles.liveDotInner} />
              <Text style={styles.liveDotText}>LIVE PLATFORM</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Welcome to <Text style={styles.heroTitleAccent}>Kabaddiadda</Text>.
          </Text>
          <Text style={styles.heroSub}>
            Start your tournament today. Score live matches, broadcast to YouTube, and let fans follow
            every raid in real time.
          </Text>

          <View style={styles.statRow}>
            <Stat value="120s" label="raid clock" />
            <View style={styles.statDivider} />
            <Stat value="7v7" label="on the mat" />
            <View style={styles.statDivider} />
            <Stat value="∞" label="tournaments" />
          </View>
        </View>
      </ImageBackground>

      {/* CTAs — pulled up so they sit just under the hero photo */}
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
        <Link href="/(fan)/live" asChild>
          <Pressable hitSlop={8} style={styles.ctaTertiary}>
            <Text style={styles.ctaTertiaryText}>Browse live matches without an account →</Text>
          </Pressable>
        </Link>
      </View>

      {/* FEATURE STRIP */}
      <Text style={styles.sectionKicker}>WHAT YOU GET</Text>
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
          title="From your phone"
          body="Manage rosters, lock lineups, end matches — all from this app."
        />
      </View>

      {/* SHOWCASE — duo of action photos */}
      <View style={styles.showcase}>
        <Image source={{ uri: ACTION_IMAGE_1 }} style={styles.showcaseImg} />
        <Image source={{ uri: ACTION_IMAGE_2 }} style={styles.showcaseImg} />
      </View>

      {/* PREVIEW CARD */}
      <View style={styles.previewCard}>
        <LinearGradient
          colors={[theme.colors.primary + '22', theme.colors.primary + '00']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  scrollWrap: { paddingBottom: 48 },

  // HERO
  hero: {
    width: SCREEN_W,
    minHeight: 580,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.bg,
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroAccent: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 32,
    paddingBottom: theme.spacing.xl,
  },
  logoBlock: { alignItems: 'flex-start', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  logoBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '900',
    letterSpacing: 4,
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
  },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success },
  liveDotText: { color: theme.colors.success, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  heroTitle: {
    color: theme.colors.text,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  heroTitleAccent: { color: theme.colors.primary },
  heroSub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
    marginTop: theme.spacing.md,
  },

  // Hero stat row
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.bgElevated + 'cc',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '900' },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.colors.border },

  // CTAs
  ctaBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
  ctaTertiary: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  ctaTertiaryText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '700' },

  // Section header
  sectionKicker: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl + 8,
    paddingBottom: theme.spacing.sm,
  },

  // Feature strip
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
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

  // Showcase image strip
  showcase: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  showcaseImg: {
    flex: 1,
    height: 140,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

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
    overflow: 'hidden',
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
