import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
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
import { tenantCreateSchema } from '@kabaddiadda/shared';
import { supabase } from '../src/lib/supabase';
import { theme } from '../src/theme';

// Simple, dependency-free slugifier — same shape as web's slugify(): lowercase,
// dashes for spaces, drop everything outside [a-z0-9-], collapse repeats.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

// Tenant setup — runs once after the very first sign-in for an organiser.
// Mirrors apps/web/src/app/setup/page.tsx + actions.ts:
//   1. Insert into tenants (name, slug, owner_id, contact_email, contact_phone)
//   2. UPDATE profiles set tenant_id = <new tenant id>
//   3. Route to /organiser
//
// We don't redirect anyone away from this screen — the routing into it is
// done by login.tsx (and later landing screen) after detecting that the
// signed-in user has profile.tenant_id IS NULL.
export default function SetupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-derive the slug from the name until the user manually edits it.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function onCreate() {
    const parsed = tenantCreateSchema.safeParse({
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
    });
    if (!parsed.success) {
      Alert.alert('Check your details', parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      Alert.alert('Not signed in', 'Sign in again and retry.');
      router.replace('/(auth)/login');
      return;
    }

    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        owner_id: user.id,
        status: 'active',
        contact_email: parsed.data.contactEmail ?? user.email,
        contact_phone: parsed.data.contactPhone,
      })
      .select('id')
      .single();

    if (tenantErr) {
      setBusy(false);
      if (tenantErr.code === '23505') {
        Alert.alert('Slug taken', 'That URL slug is already in use — try another.');
      } else {
        Alert.alert('Could not create league', tenantErr.message);
      }
      return;
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ tenant_id: tenant.id })
      .eq('id', user.id);

    setBusy(false);
    if (profileErr) {
      Alert.alert('Could not link profile', profileErr.message);
      return;
    }

    router.replace('/organiser');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>ONE LAST STEP</Text>
        <Text style={styles.title}>Set up your league</Text>
        <Text style={styles.subtitle}>
          This becomes your public identity on Kabaddiadda. Fans browsing live matches will see this
          name on every fixture and player you publish.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>League / organiser name</Text>
          <TextInput
            style={styles.input}
            placeholder="Bengal Premier Kabaddi"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Public URL slug</Text>
          <View style={styles.slugWrap}>
            <Text style={styles.slugPrefix}>kabaddiadda.com/t/</Text>
            <TextInput
              style={styles.slugInput}
              placeholder="bengal-premier"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={slug}
              onChangeText={(v) => {
                setSlug(v);
                setSlugTouched(true);
              }}
            />
          </View>
          <Text style={styles.helper}>Lowercase letters, numbers, and hyphens. You can change this later.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Contact email (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="hello@yourleague.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={contactEmail}
            onChangeText={setContactEmail}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Contact phone (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="+91…"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />
        </View>

        <Pressable style={styles.cta} onPress={onCreate} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Creating league…' : 'Create league'}</Text>
        </Pressable>
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
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '800', marginTop: 4 },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
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
  slugWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  slugPrefix: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg,
  },
  slugInput: {
    color: theme.colors.text,
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.font.body,
  },
  helper: { color: theme.colors.textMuted, fontSize: 11 },
  cta: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: theme.font.body },
});
