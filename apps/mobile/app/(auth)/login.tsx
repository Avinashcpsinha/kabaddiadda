import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';

const DEV_ACCOUNTS = {
  fan: {
    email: 'fan@kabaddiadda.dev',
    password: 'KabaddiFan-Demo!',
    title: 'Fan',
    desc: 'Browse, follow teams',
    color: '#00a8ff',
  },
  organiser: {
    email: 'organiser@kabaddiadda.dev',
    password: 'KabaddiOrg-Demo!',
    title: 'Organiser',
    desc: 'Run a tournament',
    color: theme.colors.primary,
  },
  superadmin: {
    email: 'admin@kabaddiadda.dev',
    password: 'KabaddiAdmin-Demo!',
    title: 'Superadmin',
    desc: 'Platform-wide admin',
    color: '#f1c40f',
  },
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [devBusy, setDevBusy] = useState<'fan' | 'organiser' | 'superadmin' | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(true);
  const router = useRouter();

  async function handleProfileRouting(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'user') {
      router.replace('/(fan)/feed');
    } else if (profile?.role === 'superadmin') {
      router.replace('/organiser');
    } else if (profile?.tenant_id) {
      router.replace('/organiser');
    } else {
      router.replace('/setup');
    }
  }

  async function onSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      Alert.alert('Sign in failed', error.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setBusy(false);
      Alert.alert('Sign in failed', 'No user returned from sign in.');
      return;
    }

    await handleProfileRouting(userId);
    setBusy(false);
  }

  async function onDevLogin(role: 'fan' | 'organiser' | 'superadmin') {
    const account = DEV_ACCOUNTS[role];
    setDevBusy(role);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      setDevBusy(null);
      Alert.alert(
        'Dev Account Offline',
        `Could not quick-login as ${account.title}.\n\nPlease ensure this account is provisioned by clicking "Dev quick login" once on the Webapp login console.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await handleProfileRouting(userId);
    }
    setDevBusy(null);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#05070a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Stadium Night Glow Backdrop */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['#0d1527', '#06080e', '#030407']}
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.45, 1]}
        />
        <LinearGradient
          colors={[theme.colors.primary + '18', 'transparent']}
          style={styles.radialGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND BANNERS */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.kicker}>KABADDIADDA · ACCESS</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to manage matches, tournaments, and scoring.</Text>
        </View>

        {/* INPUT FIELDS */}
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={[styles.input, passFocused && styles.inputFocused]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              busy && styles.ctaDisabled,
            ]}
            onPress={onSignIn}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.linkRow}>
          <Text style={styles.linkPrefix}>New to Kabaddiadda?</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.linkText}>Create account</Text>
            </Pressable>
          </Link>
        </View>

        {/* DEV QUICK LOGIN PANEL (DEV-ONLY) */}
        {__DEV__ && (
          <View style={styles.devContainer}>
            <Pressable
              style={styles.devHeader}
              onPress={() => setShowDevPanel(!showDevPanel)}
            >
              <Text style={styles.devTitle}>🛠️ DEV QUICK LOGIN</Text>
              <Text style={styles.devToggleText}>{showDevPanel ? 'Hide ▲' : 'Show ▼'}</Text>
            </Pressable>

            {showDevPanel && (
              <View style={styles.devGrid}>
                {Object.keys(DEV_ACCOUNTS).map((key) => {
                  const role = key as 'fan' | 'organiser' | 'superadmin';
                  const account = DEV_ACCOUNTS[role];
                  const isBusy = devBusy === role;

                  return (
                    <Pressable
                      key={role}
                      style={({ pressed }) => [
                        styles.devCard,
                        { borderColor: account.color + '44' },
                        pressed && styles.devCardPressed,
                      ]}
                      onPress={() => onDevLogin(role)}
                      disabled={devBusy !== null}
                    >
                      <View style={[styles.devRoleBadge, { backgroundColor: account.color + '22' }]}>
                        {isBusy ? (
                          <ActivityIndicator color={account.color} size="small" />
                        ) : (
                          <Text style={[styles.devRoleLetter, { color: account.color }]}>
                            {account.title[0]}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.devCardTitle}>{account.title}</Text>
                      <Text style={styles.devCardDesc} numberOfLines={1}>{account.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  radialGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 44,
    paddingBottom: theme.spacing.xxl + 32,
    gap: theme.spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  logoBadge: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    position: 'relative',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  kicker: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#111622',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  field: { gap: 6 },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  input: {
    color: theme.colors.text,
    backgroundColor: '#0a0d14',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: theme.font.body,
    height: 52,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: theme.font.body,
    letterSpacing: 1,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  linkPrefix: { color: theme.colors.textMuted, fontSize: theme.font.small },
  linkText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },

  /* Dev panel */
  devContainer: {
    backgroundColor: 'rgba(255, 92, 26, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 26, 0.12)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  devTitle: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  devToggleText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  devGrid: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  devCard: {
    flex: 1,
    backgroundColor: '#0a0d14',
    borderWidth: 1.2,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  devCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  devRoleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  devRoleLetter: {
    fontSize: 15,
    fontWeight: '900',
  },
  devCardTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  devCardDesc: {
    color: theme.colors.textMuted,
    fontSize: 8,
    textAlign: 'center',
  },
});
