import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { useFollow, type FollowTargetType } from '../lib/use-follow';

interface Props {
  targetType: FollowTargetType;
  targetId: string | null;
  /** Optional label tacked onto the button text. Omit for the bare verb. */
  label?: string;
  /** Visual size — "compact" fits inline next to a heading, "full" stands alone. */
  size?: 'compact' | 'full';
}

// One-tap follow / unfollow. If the user isn't signed in, taps push to /signup
// instead of attempting the insert (which would fail RLS anyway).
export function FollowButton({ targetType, targetId, label, size = 'compact' }: Props) {
  const router = useRouter();
  const { following, loaded, busy, toggle, signedIn } = useFollow(targetType, targetId);

  function handlePress() {
    if (!signedIn) {
      router.push('/(auth)/signup?role=user');
      return;
    }
    toggle();
  }

  if (!loaded || !targetId) return null;

  const suffix = label ? ` ${label}` : '';
  const labelText = following ? `Following${suffix}` : `Follow${suffix}`;

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={[
        size === 'full' ? styles.full : styles.compact,
        following && styles.followingState,
        busy && { opacity: 0.6 },
      ]}
    >
      {following ? (
        <View style={styles.dotRow}>
          <View style={styles.dot} />
          <Text style={[styles.text, styles.textActive]}>{labelText}</Text>
        </View>
      ) : (
        <Text style={styles.text}>+ {labelText}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  full: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  followingState: { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary },
  text: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  textActive: { color: theme.colors.primary },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
});
