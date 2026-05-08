import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        {/* The fan tab navigator owns its own header; suppress the parent
            Stack's header so we don't render two stacked title bars. */}
        <Stack.Screen name="(fan)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
