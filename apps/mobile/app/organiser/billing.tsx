import { Stack, useRouter } from 'expo-router';
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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';

interface BillingState {
  plan: 'free' | 'pro' | 'enterprise';
  status: string;
  tournamentsCount: number;
}

export default function OrganiserBillingScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const tenantId = user.tenantId;

    // Fetch tenant plan details
    const [tenantRes, tournamentsRes] = await Promise.all([
      supabase
        .from('tenants')
        .select('tenant_plan, tenant_plan_status')
        .eq('id', tenantId)
        .maybeSingle(),
      supabase
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ]);

    const tenantData = tenantRes.data;
    setBilling({
      plan: (tenantData?.tenant_plan as BillingState['plan']) ?? 'free',
      status: tenantData?.tenant_plan_status ?? 'active',
      tournamentsCount: tournamentsRes.count ?? 0,
    });
    setLoaded(true);
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (sessionLoading || !user || !user.tenantId || !loaded || !billing) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Billing' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const isFree = billing.plan === 'free';
  const isPro = billing.plan === 'pro';
  const isEnt = billing.plan === 'enterprise';

  const planTitle = isFree ? 'Free Tier' : isPro ? 'Pro Member' : 'Enterprise';
  const planColor = isFree ? '#a1a1aa' : isPro ? theme.colors.primary : '#f1c40f';
  const planBgGradients = (isFree
    ? ['#27272a', '#18181b']
    : isPro
    ? ['#ff5c1a', '#b33600']
    : ['#f1c40f', '#f39c12']) as [string, string];

  const tournamentLimit = isFree ? 3 : isPro ? 15 : 999;
  const tourneyPercent = Math.min((billing.tournamentsCount / tournamentLimit) * 100, 100);

  return (
    <View style={{ flex: 1, backgroundColor: '#05070a' }}>
      {/* Stadium Night Glow Backdrop */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['#0d1527', '#06080e', '#030407']}
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.45, 1]}
        />
        <LinearGradient
          colors={[theme.colors.primary + '10', 'transparent']}
          style={styles.radialGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <Stack.Screen options={{ title: 'Billing' }} />

      <ScrollView
        contentContainerStyle={styles.wrap}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>ORGANISER SUBSCRIPTION</Text>
          <Text style={styles.title}>League Plan</Text>
          <Text style={styles.subtitle}>
            Review limits, active tournament quotas, and subscription details.
          </Text>
        </View>

        {/* GLOWING TIER CARD */}
        <View style={styles.planCardContainer}>
          <LinearGradient
            colors={planBgGradients}
            style={styles.planCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.planCardHeader}>
              <Text style={styles.planBadge}>{planTitle.toUpperCase()}</Text>
              <View style={styles.statusDotRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{billing.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.planCardBody}>
              <Text style={styles.planMainTitle}>Kabaddiadda League Scorer</Text>
              <Text style={styles.planSub}>
                {isFree ? 'Essential tools for local tournaments.' : isPro ? 'Broadcaster premium suite enabled.' : 'Custom limits for professional federations.'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* USAGE METERS */}
        <Text style={styles.sectionTitle}>Quota usage</Text>
        <View style={styles.metersCard}>
          {/* TOURNAMENTS METER */}
          <View style={styles.meterItem}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>TOURNAMENTS CREATED</Text>
              <Text style={styles.meterValue}>
                {billing.tournamentsCount} / {isEnt ? '∞' : tournamentLimit}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${tourneyPercent}%`, backgroundColor: planColor }]} />
            </View>
          </View>

          {/* ACTIVE MATCHES METER */}
          <View style={styles.meterItem}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>ACTIVE MATCH CONSOLE</Text>
              <Text style={styles.meterValue}>UNLIMITED</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#10b981' }]} />
            </View>
          </View>

          {/* OBS OVERLAYS */}
          <View style={styles.meterItem}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>OBS BROADCAST TEMPLATES</Text>
              <Text style={styles.meterValue}>{isFree ? '1 STANDARD' : 'ALL PREMIUM'}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: isFree ? '33%' : '100%', backgroundColor: '#00a8ff' }]} />
            </View>
          </View>
        </View>

        {/* WEB UPGRADE INFO CARD */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Need to upgrade or change billing?</Text>
          <Text style={styles.infoBody}>
            To manage card details, check receipts, or purchase plan upgrades, please visit your organiser console from a desktop browser at **kabaddiadda.com/organiser/billing**.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  radialGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070a' },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  header: { gap: 4 },
  kicker: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  planCardContainer: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  planCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 1,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planCardBody: {
    gap: 4,
  },
  planMainTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  planSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: theme.font.small,
    lineHeight: 18,
  },

  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900', marginTop: theme.spacing.sm },
  metersCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  meterItem: {
    gap: 6,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  meterValue: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#0a0d14',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  infoCard: {
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 4,
    marginTop: theme.spacing.sm,
  },
  infoTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  infoBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
});
