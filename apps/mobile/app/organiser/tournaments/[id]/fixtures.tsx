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
import { supabase } from '../../../../src/lib/supabase';
import { useSession } from '../../../../src/lib/use-session';
import { theme } from '../../../../src/theme';
import { formatDateTime } from '../../../../src/lib/format';

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface Match {
  id: string;
  scheduled_at: string;
  status: string;
  round: string | null;
  home_score: number;
  away_score: number;
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null } | null;
}

const STATUS_TINT: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: theme.colors.danger + '22', fg: theme.colors.danger, label: '● LIVE' },
  completed: { bg: theme.colors.success + '22', fg: theme.colors.success, label: 'DONE' },
  scheduled: { bg: theme.colors.primary + '22', fg: theme.colors.primary, label: 'SCHED' },
  half_time: { bg: theme.colors.primary + '22', fg: theme.colors.primary, label: 'HALF' },
  abandoned: { bg: theme.colors.border, fg: theme.colors.textMuted, label: 'OFF' },
};

// Tournament fixtures. Lists every match, supports adding one match
// manually + auto-generating a round-robin. Tap a fixture to open the
// scoring console for that match. Mirrors the web fixtures page +
// autoGenerateRoundRobinAction.
export default function OrganiserFixturesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const { user, loading: sessionLoading } = useSession();

  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [tournamentStart, setTournamentStart] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Manual create form
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [round, setRound] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!tournamentId || !user?.tenantId) return;

    const [tRes, teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('tournaments')
        .select('name, start_date')
        .eq('id', tournamentId)
        .eq('tenant_id', user.tenantId)
        .maybeSingle(),
      supabase
        .from('teams')
        .select('id, name, short_name, primary_color')
        .eq('tournament_id', tournamentId)
        .order('name'),
      supabase
        .from('matches')
        .select(
          `id, scheduled_at, status, round, home_score, away_score,
           home_team:home_team_id(id, name, short_name, primary_color),
           away_team:away_team_id(id, name, short_name, primary_color)`,
        )
        .eq('tournament_id', tournamentId)
        .order('scheduled_at'),
    ]);

    setTournamentName(tRes.data?.name ?? null);
    setTournamentStart(tRes.data?.start_date ?? null);
    setTeams((teamsRes.data ?? []) as Team[]);
    setMatches((matchesRes.data ?? []) as unknown as Match[]);
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

  async function onCreateMatch() {
    if (!tournamentId || !user?.tenantId) return;
    if (!homeTeamId || !awayTeamId) {
      Alert.alert('Pick both teams', 'Choose a home team and an away team.');
      return;
    }
    if (homeTeamId === awayTeamId) {
      Alert.alert('Invalid', 'A team cannot play itself.');
      return;
    }
    if (!scheduledAt.trim()) {
      Alert.alert('Pick a time', 'Enter a date + time for the match.');
      return;
    }

    const when = new Date(scheduledAt.trim());
    if (Number.isNaN(when.getTime())) {
      Alert.alert('Invalid date', 'Use a format like 2026-06-15 18:30.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.from('matches').insert({
      tenant_id: user.tenantId,
      tournament_id: tournamentId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      scheduled_at: when.toISOString(),
      round: round.trim() || null,
      status: 'scheduled',
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not create match', error.message);
      return;
    }

    setHomeTeamId(null);
    setAwayTeamId(null);
    setScheduledAt('');
    setRound('');
    await load();
  }

  async function onAutoGenerate() {
    if (!tournamentId || !user?.tenantId) return;
    if (teams.length < 2) {
      Alert.alert('Need more teams', 'Register at least 2 teams before generating fixtures.');
      return;
    }
    if (matches.length > 0) {
      Alert.alert('Fixtures exist', 'Auto-generate refuses to run if any fixtures already exist. Delete them first or add manually.');
      return;
    }

    Alert.alert(
      'Auto-generate round-robin?',
      `Create every team-vs-team pairing for ${teams.length} teams (${(teams.length * (teams.length - 1)) / 2} matches), one per day starting on the tournament start date.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGenerating(true);
            const start = new Date(tournamentStart ?? new Date().toISOString());
            const inserts: Array<Record<string, unknown>> = [];
            let matchIndex = 0;
            for (let i = 0; i < teams.length; i++) {
              for (let j = i + 1; j < teams.length; j++) {
                const home = teams[i];
                const away = teams[j];
                if (!home || !away) continue;
                const when = new Date(start.getTime() + matchIndex * 24 * 60 * 60 * 1000);
                inserts.push({
                  tenant_id: user.tenantId!,
                  tournament_id: tournamentId,
                  home_team_id: home.id,
                  away_team_id: away.id,
                  scheduled_at: when.toISOString(),
                  round: `Round ${matchIndex + 1}`,
                  status: 'scheduled',
                });
                matchIndex++;
              }
            }

            const { error } = await supabase.from('matches').insert(inserts);
            setGenerating(false);
            if (error) {
              Alert.alert('Could not generate', error.message);
              return;
            }
            await load();
          },
        },
      ],
    );
  }

  async function onDeleteMatch(matchId: string, status: string) {
    if (status !== 'scheduled') {
      Alert.alert('Locked', 'Only scheduled fixtures can be deleted. Live or completed matches cannot be removed without losing event history.');
      return;
    }
    Alert.alert('Delete match?', 'Remove this fixture from the schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('matches').delete().eq('id', matchId);
          if (error) {
            Alert.alert('Could not delete', error.message);
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
        <Stack.Screen options={{ title: 'Fixtures' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Fixtures' }} />
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View>
          <Text style={styles.kicker}>{(tournamentName ?? 'TOURNAMENT').toUpperCase()}</Text>
          <Text style={styles.title}>Fixtures</Text>
          <Text style={styles.subtitle}>
            {matches.length} match{matches.length === 1 ? '' : 'es'} · {teams.length} team{teams.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* AUTO-GENERATE */}
        <Pressable
          style={[styles.autoBtn, (matches.length > 0 || teams.length < 2) && styles.autoBtnDisabled]}
          onPress={onAutoGenerate}
          disabled={generating || matches.length > 0 || teams.length < 2}
        >
          <Text style={styles.autoBtnText}>
            {generating ? 'Generating…' : '⚡ Auto-generate round-robin'}
          </Text>
          <Text style={styles.autoBtnHint}>
            {teams.length < 2
              ? 'Need ≥2 teams'
              : matches.length > 0
                ? 'Already have fixtures'
                : `${(teams.length * (teams.length - 1)) / 2} matches will be created`}
          </Text>
        </Pressable>

        {/* MATCH LIST */}
        {matches.length === 0 ? (
          <Text style={styles.empty}>No fixtures yet. Use the form below or auto-generate above.</Text>
        ) : (
          <View style={styles.list}>
            {matches.map((m) => {
              const tint = STATUS_TINT[m.status] ?? STATUS_TINT.scheduled;
              const home = m.home_team;
              const away = m.away_team;
              return (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    <Text style={styles.matchRound}>{m.round ?? 'Match'}</Text>
                    <Text style={styles.matchTime}>{formatDateTime(m.scheduled_at)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.statusPillText, { color: tint.fg }]}>{tint.label}</Text>
                    </View>
                  </View>

                  <View style={styles.matchBody}>
                    <View style={styles.matchSide}>
                      <View style={[styles.matchTeamBadge, { backgroundColor: home?.primary_color ?? theme.colors.primary }]}>
                        <Text style={styles.matchTeamBadgeText}>{home?.short_name ?? '??'}</Text>
                      </View>
                      <Text style={styles.matchTeamName} numberOfLines={1}>{home?.name ?? 'TBD'}</Text>
                    </View>

                    <View style={styles.matchScore}>
                      <Text style={styles.matchScoreText}>
                        {m.home_score} · {m.away_score}
                      </Text>
                    </View>

                    <View style={[styles.matchSide, { justifyContent: 'flex-end' }]}>
                      <Text style={[styles.matchTeamName, { textAlign: 'right' }]} numberOfLines={1}>{away?.name ?? 'TBD'}</Text>
                      <View style={[styles.matchTeamBadge, { backgroundColor: away?.primary_color ?? '#0ea5e9' }]}>
                        <Text style={styles.matchTeamBadgeText}>{away?.short_name ?? '??'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.matchFooter}>
                    {m.status !== 'completed' && (
                      <Link href={`/organiser/scoring/${m.id}` as never} asChild>
                        <Pressable style={styles.matchActionPrimary}>
                          <Text style={styles.matchActionPrimaryText}>
                            {m.status === 'live' ? 'Continue scoring →' : 'Open scoring →'}
                          </Text>
                        </Pressable>
                      </Link>
                    )}
                    <Link href={`/match/${m.id}` as never} asChild>
                      <Pressable style={styles.matchActionGhost}>
                        <Text style={styles.matchActionGhostText}>Public page</Text>
                      </Pressable>
                    </Link>
                    {m.status === 'scheduled' && (
                      <Pressable
                        style={styles.matchActionGhost}
                        onPress={() => onDeleteMatch(m.id, m.status)}
                      >
                        <Text style={[styles.matchActionGhostText, { color: theme.colors.danger }]}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* MANUAL ADD */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add a match</Text>

          <Field label="Home team">
            <TeamPicker teams={teams} selected={homeTeamId} onPick={setHomeTeamId} />
          </Field>
          <Field label="Away team">
            <TeamPicker teams={teams} selected={awayTeamId} onPick={setAwayTeamId} />
          </Field>

          <Field label="Date & time" helper="Format: 2026-06-15 18:30 (24h)">
            <TextInput
              style={styles.input}
              placeholder="2026-06-15 18:30"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={scheduledAt}
              onChangeText={setScheduledAt}
            />
          </Field>

          <Field label="Round / label" helper="Optional. e.g. 'Quarter-final 1' or 'Round 3'">
            <TextInput
              style={styles.input}
              placeholder="Quarter-final 1"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              value={round}
              onChangeText={setRound}
            />
          </Field>

          <Pressable style={styles.cta} onPress={onCreateMatch} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? 'Adding…' : 'Add match'}</Text>
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

function TeamPicker({
  teams,
  selected,
  onPick,
}: {
  teams: Team[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  if (teams.length === 0) {
    return <Text style={styles.helperWarn}>No teams registered yet — add some first.</Text>;
  }
  return (
    <View style={styles.teamPicker}>
      {teams.map((t) => {
        const active = t.id === selected;
        return (
          <Pressable
            key={t.id}
            onPress={() => onPick(active ? null : t.id)}
            style={[styles.teamChip, active && styles.teamChipActive]}
          >
            <View style={[styles.teamChipBadge, { backgroundColor: t.primary_color ?? theme.colors.primary }]}>
              <Text style={styles.teamChipBadgeText}>{t.short_name ?? t.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={[styles.teamChipText, active && styles.teamChipTextActive]} numberOfLines={1}>
              {t.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 4 },

  autoBtn: {
    backgroundColor: theme.colors.primary + '11',
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 4,
  },
  autoBtnDisabled: { opacity: 0.5 },
  autoBtnText: { color: theme.colors.primary, fontSize: theme.font.body, fontWeight: '800' },
  autoBtnHint: { color: theme.colors.textMuted, fontSize: 11 },

  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },

  list: { gap: theme.spacing.sm },
  matchCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  matchRound: { color: theme.colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  matchTime: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radius.pill },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  matchBody: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  matchSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchTeamBadge: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  matchTeamBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  matchTeamName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700', flex: 1 },
  matchScore: { paddingHorizontal: theme.spacing.sm },
  matchScoreText: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },

  matchFooter: { flexDirection: 'row', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, flexWrap: 'wrap' },
  matchActionPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.md },
  matchActionPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  matchActionGhost: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  matchActionGhostText: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },

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
  helperWarn: { color: theme.colors.danger, fontSize: 11, fontStyle: 'italic' },

  teamPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: '100%',
  },
  teamChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' },
  teamChipBadge: { width: 22, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  teamChipBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  teamChipText: { color: theme.colors.text, fontSize: 11, fontWeight: '700', maxWidth: 120 },
  teamChipTextActive: { color: theme.colors.primary, fontWeight: '800' },

  cta: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  ctaText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
