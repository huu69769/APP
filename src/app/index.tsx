import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/MonthCalendar';
import { useData } from '@/data/DataProvider';
import { addMonths, currentMonth, today as getToday, type LocalDate } from '@/lib/date';
import { colors } from '@/theme/colors';

/**
 * 首页 = 统计栏（M3 加入）+ 月历
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { settings } = useData();
  const [month, setMonth] = useState(currentMonth());
  const today = getToday();
  const [year, monthNumber] = month.split('-').map(Number);

  const openDay = (date: LocalDate) => {
    router.push({ pathname: '/day/[date]', params: { date } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, -1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('calendar.monthTitle', { year, month: monthNumber })}</Text>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => setMonth(currentMonth())}
          style={styles.todayButton}
          accessibilityRole="button">
          <Text style={styles.todayText}>{t('calendar.today')}</Text>
        </Pressable>
      </View>
      <MonthCalendar
        month={month}
        weekStart={settings.weekStart}
        today={today}
        onPressDay={openDay}
        onSwipe={(delta) => setMonth((m) => addMonths(m, delta))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  navButton: { paddingHorizontal: 12, paddingVertical: 4 },
  navText: { fontSize: 24, color: colors.text },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  spacer: { flex: 1 },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: 8,
  },
  todayText: { color: colors.primary, fontSize: 14 },
});
