import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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
import { signupSchema } from '@kabaddiadda/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { theme } from '../../src/theme';

type Role = 'user' | 'organiser';

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

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

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
      <View style={{ flex: 1, backgroundColor: '#05070a' }}>
        {/* Stadium backdrop */}
        <View style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={['#0d1527', '#06080e', '#030407']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={styles.sentWrap}>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>✓</Text>
          </View>
          <Text style={styles.kicker}>ALMOST THERE</Text>
          <Text style={styles.sentTitle}>Check your email</Text>
          <Text style={styles.sentBody}>
            We've sent a confirmation link to <Text style={styles.bodyStrong}>{email}</Text>. Tap it to
            activate your account, then sign in.
          </Text>
          <Pressable style={styles.sentCta} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.sentCtaText}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const headline =
    role === 'organiser' ? 'Create league' : 'Join as a fan';
  const subtitle =
    role === 'organiser'
      ? "You'll set up your league name and public URL on the next step."
      : 'Follow teams, save tournaments, and get real-time score updates.';
  const kicker = role === 'organiser' ? 'ORGANISER · SIGN UP' : 'FAN ZONE · SIGN UP';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#05070a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Stadium backdrop */}
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
          <Text style={styles.kickerText}>{kicker}</Text>
          <Text style={styles.title}>{headline}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* ROLE SELECTOR CARDS */}
        <View style={styles.roleToggle}>
          <RolePill
            label="I'm a fan"
            sub="Watch & follow"
            active={role === 'user'}
            onPress={() => setRole('user')}
            color="#00a8ff"
          />
          <RolePill
            label="I'm an organiser"
            sub="Run tournaments"
            active={role === 'organiser'}
            onPress={() => setRole('organiser')}
            color={theme.colors.primary}
          />
        </View>

        {/* REGISTRATION CARD */}
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder="Avinash Sinha"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              autoComplete="name"
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

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
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
            />
            <Text style={styles.helper}>At least 8 characters.</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              busy && styles.ctaDisabled,
            ]}
            onPress={onSignUp}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaText}>Create account</Text>
            )}
          </Pressable>
        </View>

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
  color,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.rolePill,
        active && { borderColor: color, backgroundColor: color + '11' },
      ]}
    >
      <View style={styles.rolePillHeader}>
        <Text style={[styles.rolePillLabel, active && { color }]}>{label}</Text>
        <View
          style={[
            styles.roleRadio,
            active && { borderColor: color, backgroundColor: color },
          ]}
        >
          {active && <View style={styles.roleRadioInner} />}
        </View>
      </View>
      <Text style={styles.rolePillSub}>{sub}</Text>
    </Pressable>
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
    marginBottom: theme.spacing.xs,
  },
  logoBadge: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  kickerText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small + 1,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
    marginTop: 4,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  rolePill: {
    flex: 1,
    backgroundColor: '#111622',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 4,
  },
  rolePillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rolePillLabel: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  roleRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRadioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#05070a',
  },
  rolePillSub: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
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
  },
  helper: {
    color: theme.colors.textMuted,
    fontSize: 10,
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

  /* Sent State styles */
  sentWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  successBadgeText: {
    color: theme.colors.success,
    fontSize: 42,
    fontWeight: 'bold',
  },
  kicker: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sentTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  sentBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  bodyStrong: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  sentCta: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    marginTop: theme.spacing.lg,
    width: '100%',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
  },
  sentCtaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: theme.font.body,
    letterSpacing: 1,
  },
});
