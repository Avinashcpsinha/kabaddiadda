import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/use-session';
import { theme } from '../../src/theme';

interface FollowedTournament {
  id: string;
  name: string;
  slug: string;
  tenant: { slug: string } | null;
}
interface FollowedTeam {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}
interface FollowedPlayer {
  id: string;
  full_name: string;
  jersey_number: number | null;
}

// Profile tab — identity, role, and a sign-out switch. Anonymous users get
// a join CTA instead. Organisers see a "Switch to organiser console" link
// because the bottom-tab fan shell doesn't expose /organiser otherwise.
export default function FanProfileScreen() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [followedTournaments, setFollowedTournaments] = useState<FollowedTournament[]>([]);
  const [followedTeams, setFollowedTeams] = useState<FollowedTeam[]>([]);
  const [followedPlayers, setFollowedPlayers] = useState<FollowedPlayer[]>([]);
  const [followsLoaded, setFollowsLoaded] = useState(false);

  const loadFollows = useCallback(async () => {
    if (!user) {
      setFollowsLoaded(true);
      return;
    }

    const { data: rows } = await supabase
      .from('follows')
      .select('target_type, target_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const tournamentIds: string[] = [];
    const teamIds: string[] = [];
    const playerIds: string[] = [];
    for (const r of rows ?? []) {
      if (r.target_type === 'tournament') tournamentIds.push(r.target_id);
      else if (r.target_type === 'team') teamIds.push(r.target_id);
      else if (r.target_type === 'player') playerIds.push(r.target_id);
    }

    const [tournamentsRes, teamsRes, playersRes] = await Promise.all([
      tournamentIds.length > 0
        ? supabase
            .from('tournaments')
            .select('id, name, slug, tenant:tenant_id(slug)')
            .in('id', tournamentIds)
        : Promise.resolve({ data: [] as FollowedTournament[] }),
      teamIds.length > 0
        ? supabase
            .from('teams')
            .select('id, name, short_name, primary_color')
            .in('id', teamIds)
        : Promise.resolve({ data: [] as FollowedTeam[] }),
      playerIds.length > 0
        ? supabase
            .from('players')
            .select('id, full_name, jersey_number')
            .in('id', playerIds)
        : Promise.resolve({ data: [] as FollowedPlayer[] }),
    ]);

    setFollowedTournaments((tournamentsRes.data ?? []) as unknown as FollowedTournament[]);
    setFollowedTeams((teamsRes.data ?? []) as unknown as FollowedTeam[]);
    setFollowedPlayers((playersRes.data ?? []) as unknown as FollowedPlayer[]);
    setFollowsLoaded(true);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    loadFollows();
  }, [loading, loadFollows]);

  async function onSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/');
  }

  if (loading) {
    return <View style={styles.center} />;
  }

  if (!user) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.kicker}>PROFILE</Text>
        <Text style={styles.title}>Join Kabaddiadda</Text>
        <Text style={styles.subtitle}>
          Sign in to follow teams, save favourite tournaments, and get push notifications when your
          team plays.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.primaryBtnText}>Create free account</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.ghostBtnText}>I already have an account</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const initial = user.fullName?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.kicker}>PROFILE</Text>
      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{user.fullName ?? 'Member'}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Organisers can pop into their console from here. The fan tabs intentionally
          stay simple; the organiser side has its own deeper navigation. */}
      {user.role === 'organiser' && (
        <Pressable
          style={styles.menuRow}
          onPress={() => router.push(user.tenantId ? '/organiser' : '/setup')}
        >
          <Text style={styles.menuRowTitle}>
            {user.tenantId ? 'Organiser console' : 'Finish league setup'}
          </Text>
          <Text style={styles.menuRowBody}>
            {user.tenantId
              ? 'Manage tournaments, fixtures, and live scoring.'
              : 'Create your league to start hosting tournaments.'}
          </Text>
          <Text style={styles.menuRowArrow}>→</Text>
        </Pressable>
      )}

      {user.role === 'superadmin' && (
        <Pressable style={styles.menuRow} onPress={() => router.push('/organiser')}>
          <Text style={styles.menuRowTitle}>Admin console</Text>
          <Text style={styles.menuRowBody}>Tenant + platform-wide controls.</Text>
          <Text style={styles.menuRowArrow}>→</Text>
        </Pressable>
      )}

      {/* FOLLOWING LIST — populated from the follows table. */}
      <Text style={styles.followKicker}>FOLLOWING</Text>
      {!followsLoaded ? (
        <View style={styles.staticCard}>
          <Text style={styles.cardBody}>Loading…</Text>
        </View>
      ) : followedTournaments.length === 0 && followedTeams.length === 0 && followedPlayers.length === 0 ? (
        <View style={styles.staticCard}>
          <Text style={styles.cardTitle}>Not following anything yet</Text>
          <Text style={styles.cardBody}>
            Tap the Follow button on any tournament, team, or player to see them here.
          </Text>
        </View>
      ) : (
        <View style={styles.followGroups}>
          {followedTournaments.length > 0 && (
            <View style={styles.followGroup}>
              <Text style={styles.followGroupTitle}>Tournaments · {followedTournaments.length}</Text>
              {followedTournaments.map((t) => {
                const href = t.tenant?.slug
                  ? (`/tournament/${t.tenant.slug}/${t.slug}` as never)
                  : null;
                const inner = (
                  <View style={styles.followItem}>
                    <Text style={styles.followItemGlyph}>♔</Text>
                    <Text style={styles.followItemName} numberOfLines={1}>{t.name}</Text>
                    {href && <Text style={styles.followItemArrow}>→</Text>}
                  </View>
                );
                return href ? (
                  <Link key={t.id} href={href} asChild>
                    <Pressable>{inner}</Pressable>
                  </Link>
                ) : (
                  <View key={t.id}>{inner}</View>
                );
              })}
            </View>
          )}
          {followedTeams.length > 0 && (
            <View style={styles.followGroup}>
              <Text style={styles.followGroupTitle}>Teams · {followedTeams.length}</Text>
              {followedTeams.map((t) => (
                <View key={t.id} style={styles.followItem}>
                  <View style={[styles.followTeamBadge, { backgroundColor: t.primary_color ?? theme.colors.primary }]}>
                    <Text style={styles.followTeamBadgeText}>{t.short_name ?? t.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.followItemName} numberOfLines={1}>{t.name}</Text>
                </View>
              ))}
            </View>
          )}
          {followedPlayers.length > 0 && (
            <View style={styles.followGroup}>
              <Text style={styles.followGroupTitle}>Players · {followedPlayers.length}</Text>
              {followedPlayers.map((p) => (
                <View key={p.id} style={styles.followItem}>
                  <Text style={styles.followItemGlyph}>★</Text>
                  <Text style={styles.followItemName} numberOfLines={1}>
                    {p.full_name}{p.jersey_number != null ? ` · #${p.jersey_number}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <Pressable style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + 24, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  kicker: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.body, lineHeight: 22, marginBottom: theme.spacing.lg },

  identityCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  identityText: { flex: 1, gap: 2 },
  name: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '800' },
  email: { color: theme.colors.textMuted, fontSize: theme.font.small },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    marginTop: 4,
  },
  roleText: { color: theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  menuRow: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 4,
    position: 'relative',
  },
  menuRowTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  menuRowBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18 },
  menuRowArrow: { position: 'absolute', right: theme.spacing.lg, top: theme.spacing.lg, color: theme.colors.primary, fontSize: 18, fontWeight: '900' },

  staticCard: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 4,
  },
  cardTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '800' },
  cardBody: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 18 },

  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: theme.font.body, fontWeight: '800' },
  ghostBtn: {
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghostBtnText: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },

  followKicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: theme.spacing.md },
  followGroups: { gap: theme.spacing.md },
  followGroup: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  followGroupTitle: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '800', marginBottom: 4 },
  followItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '55',
  },
  followItemGlyph: { color: theme.colors.primary, fontSize: 16, fontWeight: '900', width: 24, textAlign: 'center' },
  followItemName: { flex: 1, color: theme.colors.text, fontSize: theme.font.small, fontWeight: '700' },
  followItemArrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },
  followTeamBadge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  followTeamBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  signOutBtn: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  signOutText: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: '700' },
});
