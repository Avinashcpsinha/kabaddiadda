import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  branding: { primaryColor?: string; tagline?: string; heroImageUrl?: string } | null;
}

// League settings — name, contact, branding. Slug + status stay read-only;
// the web mirrors this for the same reason (changing slug breaks the public
// subdomain; status is set by superadmin).
export default function OrganiserSettingsScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [tagline, setTagline] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    const { data } = await supabase
      .from('tenants')
      .select('id, slug, name, status, custom_domain, logo_url, contact_email, contact_phone, branding')
      .eq('id', user.tenantId)
      .maybeSingle();
    if (!data) return;
    const t = data as Tenant;
    setTenant(t);
    setName(t.name);
    setCustomDomain(t.custom_domain ?? '');
    setLogoUrl(t.logo_url ?? '');
    setPrimaryColor(t.branding?.primaryColor ?? '');
    setTagline(t.branding?.tagline ?? '');
    setHeroImageUrl(t.branding?.heroImageUrl ?? '');
    setContactEmail(t.contact_email ?? '');
    setContactPhone(t.contact_phone ?? '');
    setLoaded(true);
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!tenant) return;

    if (!name.trim()) {
      Alert.alert('League name required', 'Pick a name to display on your public pages.');
      return;
    }
    if (primaryColor.trim() && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim())) {
      Alert.alert('Bad colour', 'Primary colour must be a 6-digit hex like #ff5c1a.');
      return;
    }

    // Compose the branding JSON column only with fields the user actually filled in.
    const branding: Record<string, string> = {};
    if (primaryColor.trim()) branding.primaryColor = primaryColor.trim();
    if (tagline.trim()) branding.tagline = tagline.trim();
    if (heroImageUrl.trim()) branding.heroImageUrl = heroImageUrl.trim();

    setBusy(true);
    const { error } = await supabase
      .from('tenants')
      .update({
        name: name.trim(),
        custom_domain: customDomain.trim() || null,
        logo_url: logoUrl.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        branding: Object.keys(branding).length > 0 ? branding : null,
      })
      .eq('id', tenant.id);
    setBusy(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    Alert.alert('Saved', 'Settings updated.');
    await load();
  }

  if (sessionLoading || !user || !user.tenantId || !loaded || !tenant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Settings' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.kicker}>LEAGUE</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Branding, contact info, and your league's public address.
          </Text>
        </View>

        {/* DETAILS */}
        <Section title="League details">
          <Field label="League name *">
            <TextInput
              style={styles.input}
              placeholder="Bengal Premier Kabaddi"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Slug" helper="Read-only — changing breaks the subdomain.">
                <TextInput
                  style={[styles.input, styles.inputReadOnly]}
                  value={tenant.slug}
                  editable={false}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Status" helper="Managed by Superadmin.">
                <TextInput
                  style={[styles.input, styles.inputReadOnly]}
                  value={tenant.status.toUpperCase()}
                  editable={false}
                />
              </Field>
            </View>
          </View>
        </Section>

        {/* PUBLIC ADDRESS */}
        <Section title="Public address">
          <Field label="Subdomain" helper="Always available, free.">
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={`${tenant.slug}.kabaddiadda.com`}
              editable={false}
            />
          </Field>
          <Field label="Custom domain" helper="Pro / Enterprise. Leave blank if you only use the subdomain.">
            <TextInput
              style={styles.input}
              placeholder="yourleague.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={customDomain}
              onChangeText={setCustomDomain}
            />
          </Field>
        </Section>

        {/* BRANDING */}
        <Section title="Branding">
          <Field label="Logo URL" helper="Square PNG/SVG, ~256×256.">
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={logoUrl}
              onChangeText={setLogoUrl}
            />
          </Field>
          <Field label="Primary colour" helper="6-digit hex, e.g. #f97316.">
            <View style={styles.colorRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="#f97316"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={primaryColor}
                onChangeText={setPrimaryColor}
              />
              {primaryColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim()) && (
                <View style={[styles.colorSwatch, { backgroundColor: primaryColor.trim() }]} />
              )}
            </View>
          </Field>
          <Field label="Tagline" helper="Shown under your league name on public pages.">
            <TextInput
              style={styles.input}
              placeholder="The premier kabaddi league of West Bengal"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={120}
              value={tagline}
              onChangeText={setTagline}
            />
          </Field>
          <Field label="Hero banner image URL" helper="Optional. Wide ~1600×400 image for your league page.">
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={heroImageUrl}
              onChangeText={setHeroImageUrl}
            />
          </Field>
        </Section>

        {/* CONTACT */}
        <Section title="Contact">
          <Field label="Email">
            <TextInput
              style={styles.input}
              placeholder="hello@yourleague.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={contactEmail}
              onChangeText={setContactEmail}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />
          </Field>
        </Section>

        <Pressable style={styles.cta} onPress={onSave} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 4 },

  section: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },

  field: { gap: 6 },
  label: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.body,
  },
  inputReadOnly: { opacity: 0.6 },
  helper: { color: theme.colors.textMuted, fontSize: 11 },

  row2: { flexDirection: 'row', gap: theme.spacing.sm },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },

  cta: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  ctaText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
