import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // After auth.signInWithPassword resolves, look up the profile to decide
  // where to land:
  //   - no profile yet (race with handle_new_user trigger)  → setup
  //   - profile.tenant_id == null                            → setup
  //   - tenant_id set                                        → /organiser
  //
  // Mirrors apps/web/src/lib/auth.ts dashboardPathForRole logic.
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .maybeSingle();

    setBusy(false);
    if (!profile?.tenant_id) {
      router.replace('/setup');
    } else {
      router.replace('/organiser');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>WELCOME BACK</Text>
        <Text style={styles.title}>Sign in</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable style={styles.cta} onPress={onSignIn} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.linkPrefix}>New to Kabaddiadda?</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.linkText}>Create account</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 32,
    gap: theme.spacing.md,
  },
  kicker: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.h2,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: theme.spacing.xl,
  },
  field: { gap: 6 },
  label: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.font.body,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: theme.font.body },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.lg,
  },
  linkPrefix: { color: theme.colors.textMuted, fontSize: theme.font.small },
  linkText: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '700' },
});
