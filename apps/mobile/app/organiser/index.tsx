import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';

interface TenantLite {
  name: string;
  slug: string;
}

// Phase-1 stub. Confirms session + tenant resolution are wired correctly,
// shows the organiser their identity, and exposes Sign out so we can re-test
// the full sign-up → setup → dashboard loop without uninstalling Expo Go.
//
// Phase 2 fills in: today's matches · live now · upcoming · quick links.
export default function OrganiserDashboardScreen() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [tenant, setTenant] = useState<TenantLite | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Auth gate. While loading we render a spinner; once resolved, kick to
  // the appropriate route. Two short-circuits below just send the user
  // back where they belong rather than showing a broken dashboard.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!user.tenantId) {
      router.replace('/setup');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.tenantId) return;
    let mounted = true;
    supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', user.tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setTenant(data);
        setTenantLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.tenantId]);

  async function onSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/(auth)/login');
  }

  if (loading || !user || !user.tenantId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.kicker}>ORGANISER · DASHBOARD</Text>
      <Text style={styles.title}>
        Welcome{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
      </Text>
      <Text style={styles.subtitle}>You're signed in. The full dashboard arrives in Phase 2.</Text>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>YOUR LEAGUE</Text>
        {tenantLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.md }} />
        ) : tenant ? (
          <>
            <Text style={styles.cardTitle}>{tenant.name}</Text>
            <Text style={styles.cardBody}>kabaddiadda.com/t/{tenant.slug}</Text>
          </>
        ) : (
          <Text style={styles.cardBody}>League data not loaded.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>NEXT</Text>
        <Text style={styles.cardTitle}>Phase 2: real dashboard</Text>
        <Text style={styles.cardBody}>
          Today's matches, live ones, upcoming fixtures, and quick links to manage tournaments / teams /
          players. Once you confirm Phase 1 works on your phone we'll wire it.
        </Text>
      </View>

      <Pressable style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 24,
    gap: theme.spacing.md,
  },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h1, fontWeight: '800', marginTop: 4 },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 6,
  },
  cardKicker: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  cardTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800', marginTop: 4 },
  cardBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },
  signOutBtn: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  signOutText: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
});
