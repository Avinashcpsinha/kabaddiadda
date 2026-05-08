import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { teamCreateSchema } from '@kabaddiadda/shared';
import { supabase } from '../../../../../src/lib/supabase';
import { useSession } from '../../../../../src/lib/use-session';
import { theme } from '../../../../../src/theme';

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  primary_color: string | null;
}

// Tournament-scoped team list + register-a-team form. Mirrors the web
// /organiser/tournaments/[id]/teams page: list on top, add form below.
// Tap a row to open the team's roster screen at /teams/[teamId].
export default function OrganiserTeamsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { user, loading: sessionLoading } = useSession();

  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [maxTeams, setMaxTeams] = useState<number | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [city, setCity] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [busy, setBusy] = useState(false);

  // Auth + tenant gate
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!tournamentId || !user?.tenantId) return;

    const [tRes, teamsRes] = await Promise.all([
      supabase
        .from('tournaments')
        .select('name, max_teams')
        .eq('id', tournamentId)
        .eq('tenant_id', user.tenantId)
        .maybeSingle(),
      supabase
        .from('teams')
        .select('id, name, short_name, city, primary_color')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false }),
    ]);

    setTournamentName(tRes.data?.name ?? null);
    setMaxTeams(tRes.data?.max_teams ?? null);
    setTeams((teamsRes.data ?? []) as TeamRow[]);

    // Player counts per team — separate head/exact queries since Supabase
    // doesn't natively count related rows on a list select.
    const countMap = new Map<string, number>();
    if ((teamsRes.data ?? []).length > 0) {
      await Promise.all(
        (teamsRes.data ?? []).map(async (t) => {
          const { count } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', t.id);
          countMap.set(t.id, count ?? 0);
        }),
      );
    }
    setCounts(countMap);
    setLoaded(true);
  }, [tournamentId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onCreate() {
    if (!tournamentId || !user?.tenantId) return;
    const parsed = teamCreateSchema.safeParse({
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      city: city.trim() || undefined,
      primaryColor: primaryColor.trim() || undefined,
    });
    if (!parsed.success) {
      Alert.alert('Check your details', parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);
    const { error } = await supabase.from('teams').insert({
      tenant_id: user.tenantId,
      tournament_id: tournamentId,
      name: parsed.data.name,
      short_name: parsed.data.shortName,
      city: parsed.data.city,
      primary_color: parsed.data.primaryColor,
    });
    setBusy(false);

    if (error) {
      Alert.alert('Could not register team', error.message);
      return;
    }

    setName('');
    setShortName('');
    setCity('');
    setPrimaryColor('');
    await load();
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Teams' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Teams' }} />
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View>
          <Text style={styles.kicker}>{(tournamentName ?? 'TOURNAMENT').toUpperCase()}</Text>
          <Text style={styles.title}>Teams</Text>
          <Text style={styles.subtitle}>
            {teams.length} registered{maxTeams ? ` of ${maxTeams}` : ''}
          </Text>
        </View>

        {/* TEAM LIST */}
        {teams.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>♔</Text>
            <Text style={styles.emptyTitle}>No teams yet</Text>
            <Text style={styles.emptyBody}>Register your first team using the form below.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {teams.map((t) => {
              const playerCount = counts.get(t.id) ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/organiser/tournaments/${tournamentId}/teams/${t.id}` as never}
                  asChild
                >
                  <Pressable style={styles.row}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: t.primary_color ?? theme.colors.primary },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {t.short_name ?? t.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {playerCount} player{playerCount === 1 ? '' : 's'}
                        {t.city ? ` · ${t.city}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowArrow}>→</Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}

        {/* REGISTER FORM */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Register a team</Text>

          <Field label="Team name">
            <TextInput
              style={styles.input}
              placeholder="Bengal Warriors"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Short code" helper="Up to 8 chars">
                <TextInput
                  style={styles.input}
                  placeholder="BEN"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={8}
                  value={shortName}
                  onChangeText={setShortName}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <TextInput
                  style={styles.input}
                  placeholder="Kolkata"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="words"
                  value={city}
                  onChangeText={setCity}
                />
              </Field>
            </View>
          </View>

          <Field label="Primary colour" helper="Hex like #ff5c1a — optional, used in the scoreboard">
            <TextInput
              style={styles.input}
              placeholder="#ff5c1a"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={primaryColor}
              onChangeText={setPrimaryColor}
            />
          </Field>

          <Pressable style={styles.cta} onPress={onCreate} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? 'Registering…' : 'Register team'}</Text>
          </Pressable>
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 4 },

  list: { gap: theme.spacing.sm },
  row: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  badge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  rowMeta: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },

  empty: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyGlyph: { color: theme.colors.primary + '66', fontSize: 36, fontWeight: '300' },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800', marginTop: 4 },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.font.small, textAlign: 'center', lineHeight: 18 },

  formCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  formTitle: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800' },

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
  helper: { color: theme.colors.textMuted, fontSize: 11 },

  row2: { flexDirection: 'row', gap: theme.spacing.sm },

  cta: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
