import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { tournamentCreateSchema } from '@kabaddiadda/shared';
import { supabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/lib/use-session';
import { theme } from '../../../src/theme';

type Format = 'league' | 'knockout' | 'group_knockout' | 'double_elimination';

const FORMAT_OPTIONS: { value: Format; label: string; sub: string }[] = [
  { value: 'league', label: 'League', sub: 'Round-robin — every team plays every other team' },
  { value: 'knockout', label: 'Knockout', sub: 'Single elimination — lose once and you’re out' },
  { value: 'group_knockout', label: 'Group + KO', sub: 'Group stage feeds into knockout bracket' },
  { value: 'double_elimination', label: 'Double Elim.', sub: 'Two losses required to be eliminated' },
];

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

// Mirrors apps/web/src/app/organiser/tournaments/new/page.tsx + actions.ts.
// Inserts a draft tournament and pushes the organiser into the detail page.
export default function NewTournamentScreen() {
  const router = useRouter();
  const { user } = useSession();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<Format>('league');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxTeams, setMaxTeams] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  function parseInt0(v: string): number | undefined {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  async function onCreate() {
    if (!user?.tenantId) {
      Alert.alert('League not set up', 'Finish your league setup before creating tournaments.');
      return;
    }

    const parsed = tournamentCreateSchema.safeParse({
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim() || undefined,
      format,
      startDate: startDate.trim() || undefined,
      endDate: endDate.trim() || undefined,
      maxTeams: parseInt0(maxTeams),
      entryFee: parseInt0(entryFee),
      prizePool: parseInt0(prizePool),
    });
    if (!parsed.success) {
      Alert.alert('Check your details', parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        tenant_id: user.tenantId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        format: parsed.data.format,
        status: 'draft',
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
        max_teams: parsed.data.maxTeams,
        entry_fee: parsed.data.entryFee,
        prize_pool: parsed.data.prizePool,
      })
      .select('id')
      .single();
    setBusy(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Slug taken', 'A tournament with that slug already exists in your league.');
      } else {
        Alert.alert('Create failed', error.message);
      }
      return;
    }

    router.replace(`/organiser/tournaments/${data.id}` as never);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'New tournament' }} />
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>NEW TOURNAMENT</Text>
        <Text style={styles.title}>Create a tournament</Text>
        <Text style={styles.subtitle}>
          You can change all of this later. Status starts as Draft — publish when ready.
        </Text>

        <Field label="Tournament name">
          <TextInput
            style={styles.input}
            placeholder="Bengal Premier Kabaddi 2026"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Public slug" helper="Becomes /t/your-league/<slug>. Lowercase + hyphens only.">
          <TextInput
            style={styles.input}
            placeholder="bengal-premier-2026"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={slug}
            onChangeText={(v) => {
              setSlug(v);
              setSlugTouched(true);
            }}
          />
        </Field>

        <Field label="Description" helper="Optional. Shown on the public tournament page.">
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Tell fans and teams what this tournament is about."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </Field>

        <Field label="Format">
          <View style={styles.formatGrid}>
            {FORMAT_OPTIONS.map((opt) => {
              const active = opt.value === format;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setFormat(opt.value)}
                  style={[styles.formatOption, active && styles.formatOptionActive]}
                >
                  <Text style={[styles.formatLabel, active && styles.formatLabelActive]}>{opt.label}</Text>
                  <Text style={[styles.formatSub, active && styles.formatSubActive]}>{opt.sub}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label="Start date" helper="YYYY-MM-DD">
              <TextInput
                style={styles.input}
                placeholder="2026-06-15"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={startDate}
                onChangeText={setStartDate}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="End date" helper="YYYY-MM-DD">
              <TextInput
                style={styles.input}
                placeholder="2026-07-01"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={endDate}
                onChangeText={setEndDate}
              />
            </Field>
          </View>
        </View>

        <View style={styles.row3}>
          <View style={{ flex: 1 }}>
            <Field label="Max teams">
              <TextInput
                style={styles.input}
                placeholder="12"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={maxTeams}
                onChangeText={setMaxTeams}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Entry fee (₹)">
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={entryFee}
                onChangeText={setEntryFee}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Prize pool (₹)">
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={prizePool}
                onChangeText={setPrizePool}
              />
            </Field>
          </View>
        </View>

        <Pressable style={styles.cta} onPress={onCreate} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Creating…' : 'Create tournament →'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  wrap: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl + 24,
  },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, lineHeight: 22, marginBottom: theme.spacing.sm },

  field: { gap: 6 },
  label: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.body,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  helper: { color: theme.colors.textMuted, fontSize: 11 },

  row2: { flexDirection: 'row', gap: theme.spacing.sm },
  row3: { flexDirection: 'row', gap: theme.spacing.sm },

  formatGrid: { gap: theme.spacing.xs },
  formatOption: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  formatOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' },
  formatLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800' },
  formatLabelActive: { color: theme.colors.primary },
  formatSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  formatSubActive: { color: theme.colors.primary + 'cc' },

  cta: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  ctaText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
