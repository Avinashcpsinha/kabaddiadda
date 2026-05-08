import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { playerCreateSchema } from '@kabaddiadda/shared';
import { supabase } from '../../../../../src/lib/supabase';
import { useSession } from '../../../../../src/lib/use-session';
import { theme } from '../../../../../src/theme';

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  primary_color: string | null;
}

interface Player {
  id: string;
  full_name: string;
  jersey_number: number | null;
  role: string;
  height_cm: number | null;
  weight_kg: number | null;
  is_captain: boolean;
  photo_url: string | null;
}

type Role = 'raider' | 'all_rounder' | 'defender_corner' | 'defender_cover';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'raider', label: 'Raider' },
  { value: 'all_rounder', label: 'All-rounder' },
  { value: 'defender_corner', label: 'D · Corner' },
  { value: 'defender_cover', label: 'D · Cover' },
];

const ROLE_TINT: Record<string, { bg: string; fg: string; label: string }> = {
  raider: { bg: '#ef444422', fg: '#ef4444', label: 'Raider' },
  all_rounder: { bg: '#f5970022', fg: '#f59700', label: 'All-rounder' },
  defender_corner: { bg: '#0ea5e922', fg: '#0ea5e9', label: 'D · Corner' },
  defender_cover: { bg: '#3b82f622', fg: '#3b82f6', label: 'D · Cover' },
};

// Team detail + roster manager. Mirrors the web teams/[teamId] page:
// header, roster table, add-player form. Person dedupe via the people
// table — if a phone number already exists, link to that row instead of
// inserting a duplicate human.
export default function OrganiserTeamDetailScreen() {
  const router = useRouter();
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const tId = Array.isArray(teamId) ? teamId[0] : teamId;
  const { user, loading: sessionLoading } = useSession();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [fullName, setFullName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [role, setRole] = useState<Role>('all_rounder');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [mobile, setMobile] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auth gate
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!tId || !user?.tenantId) return;

    const [teamRes, playersRes] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, short_name, city, primary_color')
        .eq('id', tId)
        .eq('tenant_id', user.tenantId)
        .maybeSingle(),
      supabase
        .from('players')
        .select('id, full_name, jersey_number, role, height_cm, weight_kg, is_captain, photo_url')
        .eq('team_id', tId)
        .order('jersey_number', { ascending: true, nullsFirst: false }),
    ]);

    if (!teamRes.data) {
      setNotFound(true);
      setLoaded(true);
      return;
    }
    setTeam(teamRes.data as Team);
    setPlayers((playersRes.data ?? []) as Player[]);
    setLoaded(true);
  }, [tId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function parseInt0(v: string): number | undefined {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  // Find an existing `people` row by mobile, or insert one. Mirrors the
  // findOrCreatePerson helper in the web action.
  async function findOrCreatePerson(input: {
    mobile: string;
    fullName: string;
    pan?: string;
    aadhaar?: string;
  }): Promise<string | null> {
    const { data: existing } = await supabase
      .from('people')
      .select('id, pan, aadhaar')
      .eq('mobile', input.mobile)
      .maybeSingle();

    if (existing) {
      const patch: Record<string, string> = {};
      if (input.pan && !existing.pan) patch.pan = input.pan;
      if (input.aadhaar && !existing.aadhaar) patch.aadhaar = input.aadhaar;
      if (Object.keys(patch).length > 0) {
        await supabase.from('people').update(patch).eq('id', existing.id);
      }
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from('people')
      .insert({
        mobile: input.mobile,
        full_name: input.fullName,
        pan: input.pan,
        aadhaar: input.aadhaar,
      })
      .select('id')
      .single();

    if (error) return null;
    return created.id;
  }

  async function onCreatePlayer() {
    if (!tId || !user?.tenantId) return;

    const parsed = playerCreateSchema.safeParse({
      fullName: fullName.trim(),
      jerseyNumber: parseInt0(jerseyNumber),
      role,
      heightCm: parseInt0(heightCm),
      weightKg: parseInt0(weightKg),
      isCaptain,
      mobile: mobile.trim() || undefined,
    });
    if (!parsed.success) {
      Alert.alert('Check your details', parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setBusy(true);

    let personId: string | null = null;
    if (parsed.data.mobile) {
      personId = await findOrCreatePerson({
        mobile: parsed.data.mobile,
        fullName: parsed.data.fullName,
      });
    }

    const { error } = await supabase.from('players').insert({
      tenant_id: user.tenantId,
      team_id: tId,
      person_id: personId,
      full_name: parsed.data.fullName,
      jersey_number: parsed.data.jerseyNumber,
      role: parsed.data.role,
      height_cm: parsed.data.heightCm,
      weight_kg: parsed.data.weightKg,
      is_captain: parsed.data.isCaptain,
    });

    if (error) {
      setBusy(false);
      if (error.code === '23505') {
        Alert.alert('Duplicate', 'This person is already on this team.');
      } else if (error.code === '23514') {
        Alert.alert('Validation', 'A field failed format validation.');
      } else {
        Alert.alert('Could not add player', error.message);
      }
      return;
    }

    // If new player is captain, demote others.
    if (parsed.data.isCaptain) {
      await supabase
        .from('players')
        .update({ is_captain: false })
        .eq('team_id', tId)
        .neq('full_name', parsed.data.fullName);
    }

    setBusy(false);
    setFullName('');
    setJerseyNumber('');
    setRole('all_rounder');
    setHeightCm('');
    setWeightKg('');
    setMobile('');
    setIsCaptain(false);
    await load();
  }

  async function onDeletePlayer(playerId: string, playerName: string) {
    Alert.alert('Remove player?', `Remove ${playerName} from this team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('players').delete().eq('id', playerId);
          if (error) {
            Alert.alert('Could not remove', error.message);
            return;
          }
          await load();
        },
      },
    ]);
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Team' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (notFound || !team) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.notFoundTitle}>Team not found in your league.</Text>
      </View>
    );
  }

  const captainCount = players.filter((p) => p.is_captain).length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: team.name }} />
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* TEAM HEADER */}
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: team.primary_color ?? theme.colors.primary }]}>
            <Text style={styles.badgeText}>{team.short_name ?? team.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {team.city ? `${team.city} · ` : ''}
              {players.length} player{players.length === 1 ? '' : 's'}
              {captainCount > 0 ? ' · captain assigned' : ''}
            </Text>
          </View>
        </View>

        {/* ROSTER */}
        <Text style={styles.sectionKicker}>ROSTER</Text>
        {players.length === 0 ? (
          <Text style={styles.empty}>No players on the roster yet — add one below.</Text>
        ) : (
          <View style={styles.list}>
            {players.map((p) => {
              const tint = ROLE_TINT[p.role] ?? ROLE_TINT.all_rounder;
              return (
                <View key={p.id} style={styles.playerRow}>
                  <View style={styles.jerseyChip}>
                    <Text style={styles.jerseyChipText}>
                      {p.jersey_number != null ? `#${p.jersey_number}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.playerMain}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.full_name}
                      {p.is_captain ? ' · ©' : ''}
                    </Text>
                    <View style={[styles.rolePill, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.rolePillText, { color: tint.fg }]}>{tint.label}</Text>
                    </View>
                    {(p.height_cm || p.weight_kg) && (
                      <Text style={styles.playerMeta}>
                        {p.height_cm ? `${p.height_cm}cm` : ''}
                        {p.height_cm && p.weight_kg ? ' · ' : ''}
                        {p.weight_kg ? `${p.weight_kg}kg` : ''}
                      </Text>
                    )}
                  </View>
                  <Pressable hitSlop={10} onPress={() => onDeletePlayer(p.id, p.full_name)}>
                    <Text style={styles.deleteBtn}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* ADD PLAYER */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add player</Text>

          <Field label="Full name">
            <TextInput
              style={styles.input}
              placeholder="Pawan Sehrawat"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Jersey #">
                <TextInput
                  style={styles.input}
                  placeholder="7"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  value={jerseyNumber}
                  onChangeText={setJerseyNumber}
                />
              </Field>
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Role">
                <View style={styles.roleGrid}>
                  {ROLE_OPTIONS.map((r) => {
                    const active = r.value === role;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => setRole(r.value)}
                        style={[styles.rolePillBtn, active && styles.rolePillBtnActive]}
                      >
                        <Text style={[styles.rolePillBtnText, active && styles.rolePillBtnTextActive]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Height (cm)">
                <TextInput
                  style={styles.input}
                  placeholder="180"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  value={heightCm}
                  onChangeText={setHeightCm}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Weight (kg)">
                <TextInput
                  style={styles.input}
                  placeholder="80"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
              </Field>
            </View>
          </View>

          <Field label="Mobile" helper="Used to dedupe players across teams. Optional but recommended.">
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              value={mobile}
              onChangeText={setMobile}
            />
          </Field>

          <View style={styles.captainRow}>
            <Switch
              value={isCaptain}
              onValueChange={setIsCaptain}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.captainLabel}>Make captain</Text>
              <Text style={styles.captainHint}>
                Demotes any existing captain on this team.
              </Text>
            </View>
          </View>

          <Pressable style={styles.cta} onPress={onCreatePlayer} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? 'Adding…' : 'Add player'}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  notFoundTitle: { color: theme.colors.textMuted, fontSize: theme.font.body },

  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  badge: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900' },
  headerMeta: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },

  sectionKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },

  list: { gap: theme.spacing.xs },
  playerRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  jerseyChip: {
    width: 44,
    paddingVertical: 6,
    backgroundColor: theme.colors.bg,
    borderRadius: 6,
    alignItems: 'center',
  },
  jerseyChipText: { color: theme.colors.text, fontSize: 11, fontWeight: '900' },
  playerMain: { flex: 1, gap: 2 },
  playerName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radius.pill, marginTop: 2 },
  rolePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  playerMeta: { color: theme.colors.textMuted, fontSize: 10 },
  deleteBtn: { color: theme.colors.danger, fontSize: 22, fontWeight: '900', paddingHorizontal: 4 },

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

  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  rolePillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rolePillBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  rolePillBtnText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  rolePillBtnTextActive: { color: '#fff', fontWeight: '800' },

  captainRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  captainLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  captainHint: { color: theme.colors.textMuted, fontSize: 11 },

  cta: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  ctaText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
