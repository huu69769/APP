import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { buildMonthGrid, orderedWeekdays, type CalendarDay, type WeekStart } from '@/lib/calendar';
import type { LocalDate, YearMonth } from '@/lib/date';
import { colors } from '@/theme/colors';

const SWIPE_DISTANCE = 50;
const MAX_BARS = 3;

/** 格子里显示的一条班次色块 */
export interface DayBar {
  id: string;
  color: string;
  label: string;
  /** 时间待定：颜色浅一些，前面加「?」 */
  pending?: boolean;
}

interface Props {
  month: YearMonth;
  weekStart: WeekStart;
  today: LocalDate;
  bars?: Map<LocalDate, DayBar[]>;
  /** 批量排班时选中的日期；传入时格子显示选中状态 */
  selected?: Set<LocalDate>;
  onPressDay: (date: LocalDate) => void;
  onSwipe: (delta: 1 | -1) => void;
}

/**
 * 月历：6 行 × 7 列。左右滑动切换月份。
 * 每个班次用兼职的颜色显示成一条色块。M5 起还会显示农历和节假日。
 */
export function MonthCalendar({ month, weekStart, today, bars, selected, onPressDay, onSwipe }: Props) {
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
              <DayCell
                key={day.date}
                day={day}
                bars={bars?.get(day.date) ?? []}
                selected={selected?.has(day.date)}
                onPress={onPressDay}
              />
            ))}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

function DayCell({
  day,
  bars,
  selected,
  onPress,
}: {
  day: CalendarDay;
  bars: DayBar[];
  selected?: boolean;
  onPress: (date: LocalDate) => void;
}) {
  const { t } = useTranslation();
  const [, month] = day.date.split('-').map(Number);
  const shown = bars.slice(0, MAX_BARS);
  const hidden = bars.length - shown.length;

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed, selected && styles.cellSelected]}
      onPress={() => onPress(day.date)}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
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
      <View style={[styles.bars, !day.inMonth && styles.barsOutOfMonth]}>
        {shown.map((bar) => (
          <View key={bar.id} style={[styles.bar, { backgroundColor: bar.color }, bar.pending && styles.barPending]}>
            <Text style={styles.barText} numberOfLines={1}>
              {bar.pending ? `? ${bar.label}` : bar.label}
            </Text>
          </View>
        ))}
        {hidden > 0 && <Text style={styles.more}>{t('calendar.more', { count: hidden })}</Text>}
      </View>
      {selected && <View style={styles.check} />}
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
  cell: { flex: 1, alignItems: 'center', paddingTop: 4, minHeight: 56, overflow: 'hidden' },
  cellPressed: { backgroundColor: colors.surface },
  cellSelected: { backgroundColor: '#DCEBFD' },
  dayNumberWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWrap: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 13, color: colors.text },
  todayText: { color: colors.onPrimary, fontWeight: '600' },
  outOfMonth: { color: colors.textFaint },
  sunday: { color: colors.sunday },
  saturday: { color: colors.saturday },
  bars: { alignSelf: 'stretch', gap: 2, marginTop: 2, paddingHorizontal: 2 },
  barsOutOfMonth: { opacity: 0.4 },
  bar: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  barPending: { opacity: 0.45 },
  barText: { fontSize: 10, color: '#FFFFFF', fontWeight: '600' },
  more: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  check: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
