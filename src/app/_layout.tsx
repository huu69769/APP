import '@/i18n';

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ReminderSync } from '@/components/ReminderSync';
import { ToastProvider } from '@/components/Toast';
import { DataProvider, useData } from '@/data/DataProvider';
import { ThemeProvider, useColors, useIsDark } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider fallback={({ error }) => <LoadingScreen error={error} />}>
          <ThemedApp />
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** 按设置里的「外观」（浅色 / 深色 / 跟随系统）换配色 */
function ThemedApp() {
  const { settings } = useData();
  return (
    <ThemeProvider mode={settings.theme}>
      <Screens />
    </ThemeProvider>
  );
}

function Screens() {
  const colors = useColors();
  const dark = useIsDark();
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.background,
          text: colors.text,
          border: colors.border,
        },
      }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ToastProvider>
        <ReminderSync />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.background },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ToastProvider>
    </NavigationThemeProvider>
  );
}
