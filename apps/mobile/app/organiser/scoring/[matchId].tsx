import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/lib/use-session';
import { theme } from '../../../src/theme';
import { formatClock } from '../../../src/lib/format';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

interface MatchRow {
  id: string;
  status: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  current_raider_id: string | null;
  current_attacking_team_id: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
}

interface PlayerLite {
  id: string;
  full_name: string;
  jersey_number: number | null;
  team_id: string;
}

interface MatchEvent {
  id: string;
  type: string;
  half: number;
  clock_seconds: number;
  points_attacker: number;
  points_defender: number;
  attacking_team_id: string | null;
  raider_id: string | null;
  defender_ids: string[] | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  raid_point: 'Touch',
  tackle_point: 'Tackle',
  bonus_point: 'Bonus',
  super_raid: 'Super raid',
  super_tackle: 'Super tackle',
  empty_raid: 'Empty raid',
  all_out: 'All out',
  time_out: 'Time out',
  technical_point: 'Technical',
  do_or_die_raid: 'Do-or-die',
};

const HALF_SECONDS = 20 * 60;

// Mobile scoring console — wired to real Supabase.
//
// Local clock: ticks every second client-side and persists every 5s back to
// matches.clock_seconds / current_half. The DB triggers
// (apply_match_event_score + trg_maintain_player_state) update score and
// player state when a match_events row is inserted.
//
// Realtime: postgres_changes subscription to matches (UPDATE) keeps the
// score / clock / status fresh if a co-scorer is also editing.
export default function MobileScoringScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const mId = Array.isArray(matchId) ? matchId[0] : matchId;
  const { user, loading: sessionLoading } = useSession();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Local raid state
  const [raiderId, setRaiderId] = useState<string | null>(null);
  const [attackingTeamId, setAttackingTeamId] = useState<string | null>(null);
  const [defenderIds, setDefenderIds] = useState<Set<string>>(new Set());
  const [busyEvent, setBusyEvent] = useState(false);

  // Local running clock — this is what the operator sees tick. Persists to
  // the DB every 5 seconds so a refresh resumes near where it left off.
  const [localClock, setLocalClock] = useState(0);
  const [running, setRunning] = useState(false);
  const lastPersistRef = useRef(0);
  const lastSyncedClockRef = useRef(0);

  // Auth gate
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/(auth)/login');
    else if (user.role === 'user') router.replace('/(fan)/feed');
    else if (!user.tenantId) router.replace('/setup');
  }, [sessionLoading, user, router]);

  const loadMatch = useCallback(async () => {
    if (!mId || !user?.tenantId) return;
    const { data } = await supabase
      .from('matches')
      .select(
        `id, status, home_score, away_score, current_half, clock_seconds, current_raider_id, current_attacking_team_id,
         home_team:home_team_id(id, name, short_name, primary_color),
         away_team:away_team_id(id, name, short_name, primary_color)`,
      )
      .eq('id', mId)
      .eq('tenant_id', user.tenantId)
      .maybeSingle();
    if (!data) return;
    setMatch(data as unknown as MatchRow);
    // Sync the local clock from DB only when the match changes by more than 1s
    // since our last write — otherwise we fight the local timer.
    const dbClock = (data as unknown as MatchRow).clock_seconds;
    if (Math.abs(dbClock - lastSyncedClockRef.current) > 1) {
      setLocalClock(dbClock);
      lastSyncedClockRef.current = dbClock;
    }
  }, [mId, user?.tenantId]);

  const loadPlayers = useCallback(async () => {
    if (!mId) return;
    // Get rosters for both teams via match.home_team_id/away_team_id.
    const { data: m } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', mId)
      .maybeSingle();
    if (!m) return;
    const { data } = await supabase
      .from('players')
      .select('id, full_name, jersey_number, team_id')
      .in('team_id', [m.home_team_id, m.away_team_id])
      .order('jersey_number', { ascending: true, nullsFirst: false });
    setPlayers((data ?? []) as PlayerLite[]);
  }, [mId]);

  const loadEvents = useCallback(async () => {
    if (!mId) return;
    const { data } = await supabase
      .from('match_events')
      .select(
        'id, type, half, clock_seconds, points_attacker, points_defender, attacking_team_id, raider_id, defender_ids, created_at',
      )
      .eq('match_id', mId)
      .order('created_at', { ascending: false })
      .limit(20);
    setEvents((data ?? []) as unknown as MatchEvent[]);
  }, [mId]);

  useEffect(() => {
    if (!mId) return;
    Promise.all([loadMatch(), loadPlayers(), loadEvents()]).then(() => setLoaded(true));
  }, [mId, loadMatch, loadPlayers, loadEvents]);

  // Realtime — keep score / state in sync if a co-scorer is also editing.
  useEffect(() => {
    if (!mId) return;
    const channel = supabase
      .channel(`scoring-${mId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${mId}` },
        () => loadMatch(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${mId}` },
        () => {
          loadEvents();
          loadMatch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mId, loadMatch, loadEvents]);

  // Local clock tick. Only ticks when running=true. Persists every 5s.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLocalClock((c) => {
        const next = Math.min(c + 1, HALF_SECONDS);
        const sinceLastPersist = next - lastPersistRef.current;
        if (sinceLastPersist >= 5) {
          lastPersistRef.current = next;
          lastSyncedClockRef.current = next;
          if (mId && match) {
            supabase
              .from('matches')
              .update({ clock_seconds: next, current_half: match.current_half })
              .eq('id', mId);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, mId, match]);

  // Helper: pick a player as the raider. The raider's team is the attacking team.
  function pickRaider(player: PlayerLite) {
    if (!match) return;
    setRaiderId(player.id);
    setAttackingTeamId(player.team_id);
    setDefenderIds(new Set());
  }

  function toggleDefender(player: PlayerLite) {
    if (!raiderId || !attackingTeamId) {
      Alert.alert('Pick raider first', 'Tap a raider before choosing defenders.');
      return;
    }
    if (player.team_id === attackingTeamId) return; // same-team players can't defend
    setDefenderIds((prev) => {
      const next = new Set(prev);
      if (next.has(player.id)) next.delete(player.id);
      else next.add(player.id);
      return next;
    });
  }

  function clearRaid() {
    setRaiderId(null);
    setAttackingTeamId(null);
    setDefenderIds(new Set());
  }

  async function startMatchIfNeeded() {
    if (!mId || !match) return;
    if (match.status === 'live') return;
    await supabase.from('matches').update({ status: 'live' }).eq('id', mId);
    setRunning(true);
  }

  // Submit a raid action. Type encodes which side gained — raid_point /
  // tackle_point / bonus_point / empty_raid. The DB trigger updates score.
  async function logEvent(
    type: 'raid_point' | 'tackle_point' | 'bonus_point' | 'empty_raid' | 'time_out',
    pointsAttacker: number,
    pointsDefender: number,
  ) {
    if (!mId || !match || !user?.tenantId) return;
    if (type !== 'time_out' && (!raiderId || !attackingTeamId)) {
      Alert.alert('Pick a raider', 'Tap a raider before logging this action.');
      return;
    }

    setBusyEvent(true);
    if (match.status === 'scheduled') {
      await startMatchIfNeeded();
    }

    const payload: Record<string, unknown> = {
      tenant_id: user.tenantId,
      match_id: mId,
      type,
      attacking_team_id: type === 'time_out' ? null : attackingTeamId,
      points_attacker: pointsAttacker,
      points_defender: pointsDefender,
      half: match.current_half,
      clock_seconds: localClock,
      raider_id: type === 'time_out' ? null : raiderId,
      defender_ids: defenderIds.size > 0 ? Array.from(defenderIds) : null,
      is_super_raid: false,
      is_super_tackle: false,
      is_all_out: false,
      created_by: user.id,
    };

    const { error } = await supabase.from('match_events').insert(payload);

    if (!error) {
      // Clear the in-progress raider on the match row so refreshes see no
      // dangling raid banner. Same as the web action's post-event update.
      await supabase
        .from('matches')
        .update({
          current_raider_id: null,
          current_attacking_team_id: null,
          clock_seconds: localClock,
          current_half: match.current_half,
        })
        .eq('id', mId);
    }

    setBusyEvent(false);
    if (error) {
      Alert.alert('Could not log event', error.message);
      return;
    }

    clearRaid();
    await Promise.all([loadEvents(), loadMatch()]);
  }

  async function toggleHalf() {
    if (!mId || !match) return;
    const next = match.current_half >= 4 ? 1 : match.current_half + 1;
    await supabase.from('matches').update({ current_half: next, clock_seconds: 0 }).eq('id', mId);
    setLocalClock(0);
    lastSyncedClockRef.current = 0;
    lastPersistRef.current = 0;
    await loadMatch();
  }

  async function endMatch() {
    if (!mId) return;
    Alert.alert('End match?', 'Mark the match as completed. Score is final.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End match',
        style: 'destructive',
        onPress: async () => {
          setRunning(false);
          await supabase.from('matches').update({ status: 'completed' }).eq('id', mId);
          await loadMatch();
        },
      },
    ]);
  }

  if (sessionLoading || !user || !user.tenantId || !loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Scoring' }} />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Match not found' }} />
        <Text style={styles.notFound}>Match not found in your league.</Text>
      </View>
    );
  }

  const home = match.home_team;
  const away = match.away_team;
  const homePlayers = players.filter((p) => p.team_id === home?.id);
  const awayPlayers = players.filter((p) => p.team_id === away?.id);

  const raiderPlayer = raiderId ? players.find((p) => p.id === raiderId) ?? null : null;
  const attackerName = attackingTeamId === home?.id ? home?.short_name : away?.short_name;
  const isLive = match.status === 'live';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: 'Live scoring' }} />

      {/* SCOREBOARD */}
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <ScoreSide team={home} score={match.home_score} />
          <View style={styles.scoreCenter}>
            <Text style={styles.halfLabel}>Q{match.current_half}</Text>
            <Text style={styles.clockText}>{formatClock(localClock)}</Text>
            <Text style={[styles.statusLine, { color: isLive ? theme.colors.danger : theme.colors.textMuted }]}>
              {isLive ? '● LIVE' : match.status.toUpperCase()}
            </Text>
          </View>
          <ScoreSide team={away} score={match.away_score} />
        </View>

        {/* CLOCK CONTROLS */}
        <View style={styles.clockControls}>
          <Pressable
            style={[styles.clockBtn, running && styles.clockBtnRed]}
            onPress={() => {
              if (!running) startMatchIfNeeded();
              setRunning((r) => !r);
            }}
          >
            <Text style={styles.clockBtnText}>{running ? '⏸ Pause' : '▶ Start'}</Text>
          </Pressable>
          <Pressable style={styles.clockBtnGhost} onPress={toggleHalf}>
            <Text style={styles.clockBtnGhostText}>Next half →</Text>
          </Pressable>
          <Pressable style={styles.clockBtnGhost} onPress={endMatch}>
            <Text style={[styles.clockBtnGhostText, { color: theme.colors.danger }]}>End match</Text>
          </Pressable>
        </View>
      </View>

      {/* RAID PANEL */}
      <View style={styles.raidPanel}>
        <Text style={styles.raidPanelTitle}>
          {raiderPlayer
            ? `Raider: ${raiderPlayer.full_name}${raiderPlayer.jersey_number != null ? ` #${raiderPlayer.jersey_number}` : ''}  →  ${attackerName ?? ''}`
            : 'Pick a raider'}
        </Text>
        {defenderIds.size > 0 && (
          <Text style={styles.raidPanelSub}>
            {defenderIds.size} defender{defenderIds.size === 1 ? '' : 's'} touched
          </Text>
        )}
        {(raiderPlayer || defenderIds.size > 0) && (
          <Pressable hitSlop={8} onPress={clearRaid}>
            <Text style={styles.clearLink}>Clear ×</Text>
          </Pressable>
        )}
      </View>

      {/* PLAYER PICKERS */}
      <View style={styles.pickersRow}>
        <PlayerColumn
          team={home}
          players={homePlayers}
          raiderId={raiderId}
          defenderIds={defenderIds}
          onPickRaider={pickRaider}
          onToggleDefender={toggleDefender}
        />
        <PlayerColumn
          team={away}
          players={awayPlayers}
          raiderId={raiderId}
          defenderIds={defenderIds}
          onPickRaider={pickRaider}
          onToggleDefender={toggleDefender}
        />
      </View>

      {/* ACTION GRID */}
      <Text style={styles.sectionKicker}>LOG ACTION</Text>
      <View style={styles.actionGrid}>
        <ActionButton
          label="Touch +1"
          sub="Raider touched defender(s)"
          color={theme.colors.success}
          disabled={busyEvent || !raiderId || defenderIds.size === 0}
          onPress={() => logEvent('raid_point', 1 + (defenderIds.size > 1 ? defenderIds.size - 1 : 0), 0)}
        />
        <ActionButton
          label="Bonus +1"
          sub="Raider crossed bonus line"
          color={theme.colors.primary}
          disabled={busyEvent || !raiderId}
          onPress={() => logEvent('bonus_point', 1, 0)}
        />
        <ActionButton
          label="Tackle +1"
          sub="Defenders stopped raider"
          color="#0ea5e9"
          disabled={busyEvent || !raiderId}
          onPress={() => logEvent('tackle_point', 0, 1)}
        />
        <ActionButton
          label="Empty raid"
          sub="No points either way"
          color={theme.colors.textMuted}
          disabled={busyEvent || !raiderId}
          onPress={() => logEvent('empty_raid', 0, 0)}
        />
        <ActionButton
          label="Time out"
          sub="Pause the clock"
          color={theme.colors.danger}
          disabled={busyEvent}
          onPress={() => {
            setRunning(false);
            logEvent('time_out', 0, 0);
          }}
        />
      </View>

      {/* RECENT EVENTS */}
      <Text style={styles.sectionKicker}>RECENT EVENTS</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>No events logged yet.</Text>
      ) : (
        <View style={styles.eventsList}>
          {events.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <Text style={styles.eventLabel}>
                {EVENT_LABEL[ev.type] ?? ev.type}
              </Text>
              <Text style={styles.eventClock}>
                Q{ev.half} · {formatClock(ev.clock_seconds)}
              </Text>
              <Text style={styles.eventPoints}>
                {ev.points_attacker > 0 ? `+${ev.points_attacker} attack` : ''}
                {ev.points_defender > 0 ? `+${ev.points_defender} defend` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ScoreSide({ team, score }: { team: TeamLite | null; score: number }) {
  return (
    <View style={styles.scoreSide}>
      <View style={[styles.scoreSideBadge, { backgroundColor: team?.primary_color ?? theme.colors.primary }]}>
        <Text style={styles.scoreSideBadgeText}>{team?.short_name ?? '??'}</Text>
      </View>
      <Text style={styles.scoreSideName} numberOfLines={1}>{team?.name ?? 'TBD'}</Text>
      <Text style={styles.scoreSideValue}>{score}</Text>
    </View>
  );
}

function PlayerColumn({
  team,
  players,
  raiderId,
  defenderIds,
  onPickRaider,
  onToggleDefender,
}: {
  team: TeamLite | null;
  players: PlayerLite[];
  raiderId: string | null;
  defenderIds: Set<string>;
  onPickRaider: (p: PlayerLite) => void;
  onToggleDefender: (p: PlayerLite) => void;
}) {
  return (
    <View style={styles.playerColumn}>
      <Text style={styles.playerColumnTitle} numberOfLines={1}>
        {team?.short_name ?? team?.name ?? '—'}
      </Text>
      <View style={styles.playerList}>
        {players.length === 0 ? (
          <Text style={styles.emptyMini}>No roster</Text>
        ) : (
          players.map((p) => {
            const isRaider = p.id === raiderId;
            const isDefender = defenderIds.has(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => (isRaider ? onPickRaider(p) : isDefender ? onToggleDefender(p) : null)}
                onLongPress={() => onToggleDefender(p)}
                style={[
                  styles.playerChip,
                  isRaider && styles.playerChipRaider,
                  isDefender && styles.playerChipDefender,
                ]}
              >
                <Text style={[styles.playerChipNumber, (isRaider || isDefender) && styles.playerChipTextActive]}>
                  {p.jersey_number != null ? `#${p.jersey_number}` : '—'}
                </Text>
                <Text
                  style={[styles.playerChipName, (isRaider || isDefender) && styles.playerChipTextActive]}
                  numberOfLines={1}
                >
                  {p.full_name.split(' ')[0]}
                </Text>
                {/* Tap to set as raider, long-press to mark as touched defender. */}
                <Pressable
                  hitSlop={6}
                  style={styles.playerChipPickWrap}
                  onPress={() => onPickRaider(p)}
                >
                  <Text style={styles.playerChipPick}>{isRaider ? '★' : '○'}</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  sub,
  color,
  disabled,
  onPress,
}: {
  label: string;
  sub: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, { borderColor: disabled ? theme.colors.border : color + '99' }, disabled && styles.actionBtnDisabled]}
    >
      <Text style={[styles.actionBtnLabel, { color: disabled ? theme.colors.textMuted : color }]}>{label}</Text>
      <Text style={styles.actionBtnSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg },
  wrap: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl + 24 },

  notFound: { color: theme.colors.textMuted, fontSize: theme.font.body },

  scoreboard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  scoreSide: { flex: 1, alignItems: 'center', gap: 4 },
  scoreSideBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scoreSideBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  scoreSideName: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', maxWidth: 110 },
  scoreSideValue: { color: theme.colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  scoreCenter: { alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing.sm },
  halfLabel: { color: theme.colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  clockText: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  statusLine: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  clockControls: { flexDirection: 'row', gap: 6, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  clockBtn: { flex: 1, backgroundColor: theme.colors.success, paddingVertical: 8, borderRadius: theme.radius.md, alignItems: 'center' },
  clockBtnRed: { backgroundColor: theme.colors.danger },
  clockBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  clockBtnGhost: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.md, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  clockBtnGhostText: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },

  raidPanel: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  raidPanelTitle: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: '800' },
  raidPanelSub: { color: theme.colors.textMuted, fontSize: 11 },
  clearLink: { color: theme.colors.danger, fontSize: 11, fontWeight: '800', marginTop: 4 },

  pickersRow: { flexDirection: 'row', gap: theme.spacing.sm },
  playerColumn: { flex: 1, gap: 6 },
  playerColumnTitle: { color: theme.colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  playerList: { gap: 4 },
  playerChip: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerChipRaider: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  playerChipDefender: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  playerChipNumber: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '900', minWidth: 22 },
  playerChipName: { color: theme.colors.text, fontSize: 11, fontWeight: '700', flex: 1 },
  playerChipTextActive: { color: '#fff', fontWeight: '800' },
  playerChipPickWrap: { paddingHorizontal: 4 },
  playerChipPick: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '900' },
  emptyMini: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  sectionKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.md },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
  },
  actionBtnDisabled: { backgroundColor: theme.colors.bgElevated, opacity: 0.5 },
  actionBtnLabel: { fontSize: theme.font.body, fontWeight: '900' },
  actionBtnSub: { color: theme.colors.textMuted, fontSize: 11 },

  empty: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: 'italic' },
  eventsList: { gap: 4 },
  eventRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  eventLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800', flex: 1 },
  eventClock: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' },
  eventPoints: { color: theme.colors.primary, fontSize: 10, fontWeight: '800' },
});
