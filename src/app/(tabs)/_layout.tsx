import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** 底部标签栏：日历 / 统计 / 工作 / 纪念日 / 设置 */
export default function TabsLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  const icon =
    (name: IconName, focusedName: IconName) =>
    ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
      <Ionicons name={focused ? focusedName : name} color={color} size={size} />
    );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.calendar'),
          headerShown: false,
          tabBarIcon: icon('calendar-outline', 'calendar'),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: icon('stats-chart-outline', 'stats-chart'),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: t('tabs.jobs'), tabBarIcon: icon('briefcase-outline', 'briefcase') }}
      />
      <Tabs.Screen
        name="anniversaries"
        options={{ title: t('tabs.anniversaries'), tabBarIcon: icon('gift-outline', 'gift') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
