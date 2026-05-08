import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '../../src/theme';

// Bottom-tab shell for the fan / general user side of the app.
// Each tab routes to a sibling file in this group:
//   feed.tsx        — what's live + upcoming for me
//   live.tsx        — every match live across the platform
//   tournaments.tsx — directory of tournaments
//   profile.tsx     — signed-in identity, sign out, etc.
//
// Public match + tournament detail pages live OUTSIDE this group, at
// /match/[id] and /tournament/[tenantSlug]/[slug], so anonymous visitors
// can deep-link into a scoreboard without the tab bar shell.
export default function FanTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabGlyph color={color}>{'⌂'}</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color }) => <TabGlyph color={color}>{'●'}</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Tournaments',
          tabBarIcon: ({ color }) => <TabGlyph color={color}>{'♔'}</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabGlyph color={color}>{'★'}</TabGlyph>,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({ children, color }: { children: string; color: string }) {
  return (
    <Text style={{ color, fontSize: 18, fontWeight: '900', lineHeight: 22 }}>{children}</Text>
  );
}
