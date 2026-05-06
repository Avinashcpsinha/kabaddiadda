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
import { signupSchema } from '@kabaddiadda/shared';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';

// Organiser sign-up. Mirrors the web flow:
//   1. supabase.auth.signUp with role=organiser in user metadata
//   2. handle_new_user trigger creates the profile row server-side
//   3. Supabase emails the user a confirmation link
//   4. After they click the link they can sign in → land on /setup → tenant
//
// We hardcode role to 'organiser' here because mobile is organiser-first.
// A separate fan sign-up flow can use the same supabase call with
// role: 'user' when we add the consumer side of the app.
export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSignUp() {
    const parsed = signupSchema.safeParse({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role: 'organiser',
    });
    if (!parsed.success) {
      Alert.alert('Check your details', parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          role: parsed.data.role,
        },
      },
    });
    setBusy(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        <Text style={styles.kicker}>Almost there</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We've sent a confirmation link to <Text style={styles.bodyStrong}>{email}</Text>. Tap it to
          activate your account, then come back and sign in.
        </Text>
        <Pressable style={[styles.cta, { marginTop: 32 }]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.ctaText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>ORGANISER · KABADDIADDA</Text>
        <Text style={styles.title}>Create your league account</Text>
        <Text style={styles.subtitle}>
          You'll set up your league name and public URL on the next step.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Avinash Sinha"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

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
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.helper}>At least 8 characters.</Text>
        </View>

        <Pressable style={styles.cta} onPress={onSignUp} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.linkPrefix}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.linkText}>Sign in</Text>
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
    paddingTop: theme.spacing.xxl + 24,
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
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
    marginTop: theme.spacing.md,
  },
  bodyStrong: { color: theme.colors.text, fontWeight: '700' },
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
  helper: { color: theme.colors.textMuted, fontSize: 11 },
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
