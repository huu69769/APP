import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { isValidLocalDate, parseLocalDate } from '@/lib/date';
import { colors } from '@/theme/colors';

/**
 * 当天详情页。M2 起在这里添加班次，M4 起添加日程和笔记。
 */
export default function DayScreen() {
  const { t } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();

  if (!date || !isValidLocalDate(date)) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{t('day.invalidDate')}</Text>
      </View>
    );
  }

  const d = parseLocalDate(date);
  const weekdays = t('day.weekdays', { returnObjects: true }) as string[];
  const title = t('day.title', { month: d.month() + 1, day: d.date(), weekday: weekdays[d.day()] });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <Text style={styles.empty}>{t('day.empty')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  empty: { color: colors.textMuted },
});
