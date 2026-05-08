import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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

type Role = 'user' | 'organiser';

// Sign-up. Two flavours selectable via the role toggle:
//   user      — fans / general users; no league setup needed
//   organiser — league owners; routed through /setup after first sign-in
//
// Flow stays the same on the Supabase side — we send role in user metadata,
// the handle_new_user trigger creates the matching profile row, then a
// confirmation email goes out.
//
// Optional ?role= query (from deep link or marketing CTA) preselects the toggle.
export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole: Role = params.role === 'user' ? 'user' : 'organiser';
  const [role, setRole] = useState<Role>(initialRole);
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
      role,
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

  const headline =
    role === 'organiser' ? 'Create your league account' : 'Join Kabaddiadda as a fan';
  const subtitle =
    role === 'organiser'
      ? "You'll set up your league name and public URL on the next step."
      : 'Follow teams, save tournaments, and get push notifications when your team plays.';
  const kicker = role === 'organiser' ? 'ORGANISER · KABADDIADDA' : 'FAN ZONE · KABADDIADDA';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Role toggle — pill switcher between fan + organiser */}
        <View style={styles.roleToggle}>
          <RolePill
            label="I'm a fan"
            sub="Watch & follow"
            active={role === 'user'}
            onPress={() => setRole('user')}
          />
          <RolePill
            label="I'm an organiser"
            sub="Run tournaments"
            active={role === 'organiser'}
            onPress={() => setRole('organiser')}
          />
        </View>

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

function RolePill({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rolePill, active && styles.rolePillActive]}
    >
      <Text style={[styles.rolePillLabel, active && styles.rolePillLabelActive]}>{label}</Text>
      <Text style={[styles.rolePillSub, active && styles.rolePillSubActive]}>{sub}</Text>
    </Pressable>
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
    marginBottom: theme.spacing.md,
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

  roleToggle: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  rolePill: {
    flex: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
    alignItems: 'flex-start',
  },
  rolePillActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' },
  rolePillLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
  rolePillLabelActive: { color: theme.colors.primary },
  rolePillSub: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  rolePillSubActive: { color: theme.colors.primary + 'cc' },
});
