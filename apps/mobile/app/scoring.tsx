import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../src/theme';

// =====================================================================
// MOCK DATA — pure UI prototype, no Supabase calls yet. Once the
// layout is approved we'll swap these constants for real data fetched
// from supabase.from('matches'/'match_player_state'/...).
// =====================================================================
const HALF_SECONDS = 20 * 60; // 20-minute halves
const RAID_SECONDS = 30;

interface Player {
  id: string;
  jersey: number;
  name: string;
  state: 'on_mat' | 'out';
}

const HOME = {
  id: 'home',
  name: 'Ahmedabad Pirates',
  short: 'AHM',
  color: '#ec4899',
};
const AWAY = {
  id: 'away',
  name: 'Bangalore Bulls',
  short: 'BAN',
  color: '#a855f7',
};

const HOME_PLAYERS: Player[] = [
  { id: 'h1', jersey: 1, name: 'Pawan Hooda', state: 'on_mat' },
  { id: 'h2', jersey: 3, name: 'Ravi Gupta', state: 'on_mat' },
  { id: 'h3', jersey: 5, name: 'Yash Singh', state: 'on_mat' },
  { id: 'h4', jersey: 7, name: 'Bharat Rana', state: 'on_mat' },
  { id: 'h5', jersey: 9, name: 'Suresh Hooda', state: 'on_mat' },
  { id: 'h6', jersey: 11, name: 'Lalit Menon', state: 'on_mat' },
  { id: 'h7', jersey: 13, name: 'Anup Rana', state: 'on_mat' },
];

const AWAY_PLAYERS: Player[] = [
  { id: 'a1', jersey: 2, name: 'Vikas Hooda', state: 'on_mat' },
  { id: 'a2', jersey: 4, name: 'Hemant Sangwan', state: 'on_mat' },
  { id: 'a3', jersey: 6, name: 'Sandeep Menon', state: 'on_mat' },
  { id: 'a4', jersey: 8, name: 'Pankaj Naik', state: 'out' },
  { id: 'a5', jersey: 10, name: 'Saurabh Sangwan', state: 'on_mat' },
  { id: 'a6', jersey: 12, name: 'Jagat Singh', state: 'on_mat' },
  { id: 'a7', jersey: 14, name: 'Surender Naik', state: 'on_mat' },
];

interface PendingAction {
  id: string;
  label: string;
  sub: string;
  tone: 'attack' | 'defend';
}

// =====================================================================
// MAIN SCREEN
// =====================================================================
export default function ScoringScreen() {
  const router = useRouter();

  // Match clock counts UP from 0; remaining = HALF_SECONDS - clock.
  const [clock, setClock] = useState(120); // pretend match is 2 min in
  const [running, setRunning] = useState(true);

  // Raid clock counts DOWN from RAID_SECONDS to 0.
  const [raidLeft, setRaidLeft] = useState(0);
  const [raidRunning, setRaidRunning] = useState(false);

  const [attackingId, setAttackingId] = useState<'home' | 'away'>('home');
  const [raiderId, setRaiderId] = useState<string | null>(null);
  const [defenderIds, setDefenderIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);

  const [homeScore, setHomeScore] = useState(11);
  const [awayScore, setAwayScore] = useState(9);

  // Match clock tick — counts up while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setClock((c) => Math.min(HALF_SECONDS, c + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Raid clock tick — counts down while running + raidRunning + raider picked.
  useEffect(() => {
    if (!running || !raidRunning || !raiderId) return;
    const id = setInterval(() => {
      setRaidLeft((r) => {
        if (r <= 1) {
          setRaidRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, raidRunning, raiderId]);

  // Auto-arm raid clock the moment a raider is picked (mirrors desktop).
  const lastRaiderRef = useRef<string | null>(null);
  useEffect(() => {
    if (raiderId && raiderId !== lastRaiderRef.current) {
      if (!raidRunning && raidLeft === 0) {
        setRaidLeft(RAID_SECONDS);
        setRaidRunning(true);
      }
    }
    lastRaiderRef.current = raiderId;
  }, [raiderId, raidLeft, raidRunning]);

  const remaining = HALF_SECONDS - clock;
  const remainingMm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const remainingSs = String(remaining % 60).padStart(2, '0');

  const attacking = attackingId === 'home' ? HOME : AWAY;
  const defending = attackingId === 'home' ? AWAY : HOME;
  const attackingPlayers = attackingId === 'home' ? HOME_PLAYERS : AWAY_PLAYERS;
  const defendingPlayers = attackingId === 'home' ? AWAY_PLAYERS : HOME_PLAYERS;

  const homeOnMat = HOME_PLAYERS.filter((p) => p.state === 'on_mat').length;
  const awayOnMat = AWAY_PLAYERS.filter((p) => p.state === 'on_mat').length;

  const touchedCount = defenderIds.length;

  // =====================================================================
  // ACTIONS — local-only for now, no DB writes.
  // =====================================================================
  function toggleDefender(id: string) {
    setDefenderIds((p) => (p.includes(id) ? p.filter((d) => d !== id) : [...p, id]));
  }
  function clearSelection() {
    setRaiderId(null);
    setDefenderIds([]);
  }
  function stage(label: string, sub: string, tone: 'attack' | 'defend') {
    setPending((p) => [...p, { id: `${Date.now()}-${Math.random()}`, label, sub, tone }]);
  }
  function getPoints() {
    // Apply each queued action to the local score.
    let attackerDelta = 0;
    let defenderDelta = 0;
    pending.forEach((p) => {
      const n = parseInt(p.sub.replace('+', ''), 10) || 0;
      if (p.tone === 'attack') attackerDelta += n;
      else defenderDelta += n;
    });
    if (attackingId === 'home') {
      setHomeScore((s) => s + attackerDelta);
      setAwayScore((s) => s + defenderDelta);
    } else {
      setAwayScore((s) => s + attackerDelta);
      setHomeScore((s) => s + defenderDelta);
    }
    setPending([]);
    setDefenderIds([]); // raid continues; raider stays
  }
  function completeRaid() {
    getPoints();
    clearSelection();
    setRaidRunning(false);
    setRaidLeft(0);
    setAttackingId((id) => (id === 'home' ? 'away' : 'home'));
  }
  function cancelPending() {
    setPending([]);
  }
  function resetRaid() {
    if (pending.length > 0) {
      Alert.alert('Cannot reset', 'Clear queued actions first.');
      return;
    }
    setRaidLeft(RAID_SECONDS);
    setRaidRunning(true);
    setDefenderIds([]);
  }

  const canTouch = !!raiderId && touchedCount > 0;
  const canBonus = !!raiderId;

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <View style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backText}>‹  Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.q}>Q1</Text>
          <Text style={styles.clockText}>
            {remainingMm}:{remainingSs}
          </Text>
          <View style={styles.liveDotWrap}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setRunning((r) => !r)}
          style={[styles.runBtn, running ? styles.runBtnPause : styles.runBtnPlay]}
        >
          <Text style={styles.runBtnText}>{running ? 'PAUSE' : 'RESUME'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: pending.length > 0 ? 160 : 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SCORE STRIP */}
        <View style={styles.scoreCard}>
          <ScoreSide
            short={HOME.short}
            name={HOME.name}
            color={HOME.color}
            score={homeScore}
            onMat={homeOnMat}
            highlight={attackingId === 'home'}
          />
          <View style={styles.scoreDivider} />
          <ScoreSide
            short={AWAY.short}
            name={AWAY.name}
            color={AWAY.color}
            score={awayScore}
            onMat={awayOnMat}
            highlight={attackingId === 'away'}
            align="right"
          />
        </View>

        {/* TEAM TOGGLE */}
        <Text style={styles.sectionHint}>Raiding team</Text>
        <View style={styles.teamToggle}>
          <TeamPill
            label={HOME.name}
            short={HOME.short}
            color={HOME.color}
            active={attackingId === 'home'}
            onMat={homeOnMat}
            total={HOME_PLAYERS.length}
            onPress={() => {
              setAttackingId('home');
              clearSelection();
            }}
          />
          <TeamPill
            label={AWAY.name}
            short={AWAY.short}
            color={AWAY.color}
            active={attackingId === 'away'}
            onMat={awayOnMat}
            total={AWAY_PLAYERS.length}
            onPress={() => {
              setAttackingId('away');
              clearSelection();
            }}
          />
        </View>

        {/* RAID TIMER + RESET */}
        <View style={styles.raidRow}>
          <View style={styles.raidLabelWrap}>
            <Text style={styles.raidLabel}>RAID</Text>
            <Text style={styles.raidTeamHint}>{attacking.name}</Text>
          </View>
          <RaidClock seconds={raidLeft} active={raidRunning && !!raiderId} />
          <Pressable
            onPress={resetRaid}
            disabled={!raiderId}
            style={[styles.resetBtn, !raiderId && styles.resetBtnDisabled]}
          >
            <Text style={styles.resetBtnText}>↺ Reset</Text>
          </Pressable>
        </View>

        {/* RAIDER PICKER */}
        <View style={[styles.pickerHeader, { borderColor: theme.colors.primary }]}>
          <Text style={[styles.pickerLabel, { color: theme.colors.primary }]}>RAIDER</Text>
          <Text style={styles.pickerHelper}>{raiderId ? '1 selected' : 'Tap one'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {attackingPlayers.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              tone="attack"
              selected={raiderId === p.id}
              onPress={() => p.state === 'on_mat' && setRaiderId(p.id)}
            />
          ))}
        </ScrollView>

        {/* DEFENDERS PICKER */}
        <View style={[styles.pickerHeader, { borderColor: '#0ea5e9' }]}>
          <Text style={[styles.pickerLabel, { color: '#0ea5e9' }]}>DEFENDERS</Text>
          <Text style={styles.pickerHelper}>{touchedCount > 0 ? `${touchedCount} tapped` : 'Tap any'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {defendingPlayers.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              tone="defend"
              selected={defenderIds.includes(p.id)}
              onPress={() => p.state === 'on_mat' && toggleDefender(p.id)}
            />
          ))}
        </ScrollView>

        {/* ACTION BUTTONS */}
        <Text style={styles.sectionHint}>Actions</Text>
        <View style={styles.actionGrid}>
          <ActionButton
            label="Touch"
            sub={`+${Math.max(touchedCount, 1)}`}
            tone="attack"
            disabled={!canTouch}
            onPress={() => stage('Touch', `+${touchedCount}`, 'attack')}
          />
          <ActionButton
            label="Bonus"
            sub="+1"
            tone="attack"
            disabled={!canBonus}
            onPress={() => stage('Bonus', '+1', 'attack')}
          />
          <ActionButton
            label="Tackle"
            sub="+1"
            tone="defend"
            disabled={!raiderId}
            onPress={() => stage('Tackle', '+1', 'defend')}
          />
          <ActionButton
            label="Empty"
            sub="0"
            tone="attack"
            disabled={!raiderId}
            onPress={() => stage('Empty', '+0', 'attack')}
          />
          <ActionButton
            label="Raider out"
            sub="+1"
            tone="defend"
            disabled={!raiderId}
            onPress={() => stage('Raider out', '+1', 'defend')}
          />
          <ActionButton
            label="More…"
            sub=""
            tone="neutral"
            onPress={() =>
              Alert.alert(
                'More actions',
                'Super, S.tackle, Self out, Defender out, Def. self, Sub, cards, Tech, Review will live in this bottom sheet. Wiring this is the next step once you sign off the layout.',
              )
            }
          />
        </View>

        {/* HELP */}
        <Text style={styles.helpText}>
          Tip: Pick a raider → defender(s) → action. Action stages to the
          queue. Tap Get Points to commit & keep raiding, Complete Raid to
          end the raid (other team raids next).
        </Text>
      </ScrollView>

      {/* STICKY QUEUE BAR */}
      {pending.length > 0 && (
        <View style={styles.queueBar}>
          <View style={styles.queueChips}>
            {pending.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.queueChip,
                  { backgroundColor: p.tone === 'attack' ? theme.colors.primaryDim : '#0ea5e933' },
                ]}
              >
                <Text style={[styles.queueChipText, { color: p.tone === 'attack' ? theme.colors.primary : '#0ea5e9' }]}>
                  {p.label} {p.sub}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.queueButtons}>
            <Pressable style={styles.cancelBtn} onPress={cancelPending}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.completeBtn} onPress={completeRaid}>
              <Text style={styles.completeBtnText}>Complete Raid</Text>
            </Pressable>
            <Pressable style={styles.getPointsBtn} onPress={getPoints}>
              <Text style={styles.getPointsBtnText}>Get Points</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// =====================================================================
// SUBCOMPONENTS
// =====================================================================
function ScoreSide({
  short,
  name,
  color,
  score,
  onMat,
  highlight,
  align = 'left',
}: {
  short: string;
  name: string;
  color: string;
  score: number;
  onMat: number;
  highlight: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <View style={[styles.scoreSide, align === 'right' && { alignItems: 'flex-end' }]}>
      <View style={[styles.scoreSideHeader, align === 'right' && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.teamBadge, { backgroundColor: color }]}>
          <Text style={styles.teamBadgeText}>{short}</Text>
        </View>
        <View style={align === 'right' ? { alignItems: 'flex-end', marginRight: 8 } : { marginLeft: 8 }}>
          <Text style={styles.teamNameSmall} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.onMatHint}>{onMat}/7 on mat</Text>
        </View>
      </View>
      <Text style={[styles.scoreBig, highlight && { color: theme.colors.primary }]}>{score}</Text>
    </View>
  );
}

function TeamPill({
  label,
  short,
  color,
  active,
  onMat,
  total,
  onPress,
}: {
  label: string;
  short: string;
  color: string;
  active: boolean;
  onMat: number;
  total: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.teamPill, active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryDim }]}
      onPress={onPress}
    >
      <View style={[styles.teamBadgeSmall, { backgroundColor: color }]}>
        <Text style={styles.teamBadgeText}>{short}</Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: 8 }}>
        <Text style={[styles.teamPillLabel, active && { color: theme.colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.teamPillSub}>
          {onMat}/{total} on mat
        </Text>
      </View>
      {active && <Text style={styles.flame}>🔥</Text>}
    </Pressable>
  );
}

function RaidClock({ seconds, active }: { seconds: number; active: boolean }) {
  const ringColor = useMemo(() => {
    if (!active && seconds === 0) return theme.colors.border;
    if (seconds > 15) return theme.colors.success;
    if (seconds > 10) return '#f59e0b';
    if (seconds > 5) return '#fb923c';
    return theme.colors.danger;
  }, [seconds, active]);

  return (
    <View style={[styles.raidClock, { borderColor: ringColor }]}>
      <Text style={[styles.raidClockText, { color: ringColor }]}>
        {String(seconds).padStart(2, '0')}
      </Text>
    </View>
  );
}

function PlayerCard({
  player,
  tone,
  selected,
  onPress,
}: {
  player: Player;
  tone: 'attack' | 'defend';
  selected: boolean;
  onPress: () => void;
}) {
  const accent = tone === 'attack' ? theme.colors.primary : '#0ea5e9';
  const dim = tone === 'attack' ? theme.colors.primaryDim : '#0ea5e933';
  const isOut = player.state === 'out';
  return (
    <Pressable
      style={[
        styles.playerCard,
        selected && { borderColor: accent, backgroundColor: dim },
        isOut && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={isOut}
    >
      <Text style={[styles.playerJersey, selected && { color: accent }]}>#{player.jersey}</Text>
      <Text style={[styles.playerName, isOut && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
        {player.name}
      </Text>
      {isOut && <Text style={styles.outBadge}>OUT</Text>}
    </Pressable>
  );
}

function ActionButton({
  label,
  sub,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  sub: string;
  tone: 'attack' | 'defend' | 'neutral';
  disabled?: boolean;
  onPress: () => void;
}) {
  const accent =
    tone === 'attack' ? theme.colors.primary : tone === 'defend' ? '#0ea5e9' : theme.colors.textMuted;
  return (
    <Pressable
      style={[
        styles.actionBtn,
        { borderColor: disabled ? theme.colors.border : accent },
        disabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionBtnLabel, { color: disabled ? theme.colors.textMuted : accent }]}>
        {label}
      </Text>
      {sub ? <Text style={styles.actionBtnSub}>{sub}</Text> : null}
    </Pressable>
  );
}

// =====================================================================
// STYLES
// =====================================================================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48, // safe-area-ish; will refine with SafeAreaView later
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    gap: theme.spacing.md,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: theme.colors.textMuted, fontSize: theme.font.body, fontWeight: '600' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  q: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700', letterSpacing: 1 },
  clockText: {
    color: theme.colors.text,
    fontSize: theme.font.h2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  liveDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: theme.colors.danger + '22',
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger },
  liveText: { color: theme.colors.danger, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  runBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.md },
  runBtnPause: { backgroundColor: theme.colors.danger + '33', borderWidth: 1, borderColor: theme.colors.danger },
  runBtnPlay: { backgroundColor: theme.colors.success + '33', borderWidth: 1, borderColor: theme.colors.success },
  runBtnText: { color: theme.colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scroll: { flex: 1 },

  // Score card
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    margin: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scoreSide: { flex: 1 },
  scoreSideHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  teamBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  teamNameSmall: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600' },
  onMatHint: { color: theme.colors.textMuted, fontSize: 10, marginTop: 1 },
  scoreBig: {
    color: theme.colors.text,
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  scoreDivider: { width: 1, height: 60, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.md },

  // Section hints
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },

  // Team toggle
  teamToggle: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  teamPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  teamPillLabel: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  teamPillSub: { color: theme.colors.textMuted, fontSize: 10, marginTop: 1 },
  flame: { fontSize: 16 },

  // Raid clock row
  raidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  raidLabelWrap: { flex: 1 },
  raidLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  raidTeamHint: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700', marginTop: 2 },
  raidClock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raidClockText: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgElevated,
  },
  resetBtnDisabled: { opacity: 0.4 },
  resetBtnText: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },

  // Picker headers
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 2,
    marginHorizontal: theme.spacing.lg,
  },
  pickerLabel: { fontSize: theme.font.body, fontWeight: '900', letterSpacing: 1 },
  pickerHelper: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },

  // Player chip row
  chipRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  playerCard: {
    width: 110,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'flex-start',
  },
  playerJersey: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '800' },
  playerName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600', marginTop: 4 },
  outBadge: {
    color: theme.colors.danger,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    backgroundColor: theme.colors.danger + '22',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },

  // Actions
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
  },
  actionBtnLabel: { fontSize: theme.font.body, fontWeight: '800' },
  actionBtnSub: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },

  helpText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    lineHeight: 16,
  },

  // Sticky queue bar
  queueBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bgElevated,
    borderTopWidth: 2,
    borderTopColor: '#f59e0b',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  queueChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  queueChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  queueChipText: { fontSize: 11, fontWeight: '800' },
  queueButtons: { flexDirection: 'row', gap: theme.spacing.sm },
  cancelBtn: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelBtnText: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
  completeBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  completeBtnText: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  getPointsBtn: {
    flex: 1.4,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  getPointsBtnText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
});
