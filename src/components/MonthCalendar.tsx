import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { buildMonthGrid, orderedWeekdays, type CalendarDay, type WeekStart } from '@/lib/calendar';
import type { LocalDate, YearMonth } from '@/lib/date';
import { colors } from '@/theme/colors';

const SWIPE_DISTANCE = 50;

interface Props {
  month: YearMonth;
  weekStart: WeekStart;
  today: LocalDate;
  onPressDay: (date: LocalDate) => void;
  onSwipe: (delta: 1 | -1) => void;
}

/**
 * 月历：6 行 × 7 列。左右滑动切换月份。
 * M2 以后会在每个格子里显示班次色块、日程圆点、农历和节假日。
 */
export function MonthCalendar({ month, weekStart, today, onPressDay, onSwipe }: Props) {
  const { t } = useTranslation();
  const weekdayNames = t('calendar.weekdaysShort', { returnObjects: true }) as string[];
  const weeks = buildMonthGrid(month, weekStart, today);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_DISTANCE) onSwipe(1);
      else if (e.translationX >= SWIPE_DISTANCE) onSwipe(-1);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.container}>
        <View style={styles.weekHeader}>
          {orderedWeekdays(weekStart).map((wd) => (
            <Text key={wd} style={[styles.weekHeaderText, weekdayColor(wd)]}>
              {weekdayNames[wd]}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0].date} style={styles.week}>
            {week.map((day) => (
              <DayCell key={day.date} day={day} onPress={onPressDay} />
            ))}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

function DayCell({ day, onPress }: { day: CalendarDay; onPress: (date: LocalDate) => void }) {
  const { t } = useTranslation();
  const [, month] = day.date.split('-').map(Number);
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() => onPress(day.date)}
      accessibilityRole="button"
      accessibilityLabel={t('calendar.dayLabel', { month, day: day.day })}>
      <View style={[styles.dayNumberWrap, day.isToday && styles.todayWrap]}>
        <Text
          style={[
            styles.dayNumber,
            weekdayColor(day.weekday),
            !day.inMonth && styles.outOfMonth,
            day.isToday && styles.todayText,
          ]}>
          {day.day}
        </Text>
      </View>
    </Pressable>
  );
}

function weekdayColor(weekday: number) {
  if (weekday === 0) return styles.sunday;
  if (weekday === 6) return styles.saturday;
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  weekHeaderText: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textMuted },
  week: {
    flex: 1,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cell: { flex: 1, alignItems: 'center', paddingTop: 4, minHeight: 56 },
  cellPressed: { backgroundColor: colors.surface },
  dayNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWrap: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 14, color: colors.text },
  todayText: { color: colors.onPrimary, fontWeight: '600' },
  outOfMonth: { color: colors.textFaint },
  sunday: { color: colors.sunday },
  saturday: { color: colors.saturday },
});
