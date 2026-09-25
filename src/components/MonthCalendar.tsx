import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { buildMonthGrid, orderedWeekdays, type CalendarDay, type WeekStart } from '@/lib/calendar';
import type { BadgeKind, DayLabel } from '@/lib/dayLabel';
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
  /** 按件计酬的任务（截止日）：只画边框，和班次区分开 */
  task?: boolean;
}

interface Props {
  month: YearMonth;
  weekStart: WeekStart;
  today: LocalDate;
  bars?: Map<LocalDate, DayBar[]>;
  /** 日程（颜色）和笔记（灰色）显示成小圆点 */
  dots?: Map<LocalDate, string[]>;
  /** 节假日小标、农历小字 */
  labels?: Map<LocalDate, DayLabel>;
  /** 批量排班时选中的日期；传入时格子显示选中状态 */
  selected?: Set<LocalDate>;
  onPressDay: (date: LocalDate) => void;
  /** 长按某一天（用来开始批量排班） */
  onLongPressDay?: (date: LocalDate) => void;
  onSwipe: (delta: 1 | -1) => void;
}

/**
 * 月历：6 行 × 7 列。左右滑动切换月份。
 * 班次、项目显示成色块；日程和笔记显示成小圆点。M5 起还会显示农历和节假日。
 */
export function MonthCalendar({
  month,
  weekStart,
  today,
  bars,
  dots,
  labels,
  selected,
  onPressDay,
  onLongPressDay,
  onSwipe,
}: Props) {
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
                dots={dots?.get(day.date) ?? []}
                label={labels?.get(day.date)}
                selected={selected?.has(day.date)}
                onPress={onPressDay}
                onLongPress={onLongPressDay}
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
  dots,
  label,
  selected,
  onPress,
  onLongPress,
}: {
  day: CalendarDay;
  bars: DayBar[];
  dots: string[];
  label?: DayLabel;
  selected?: boolean;
  onPress: (date: LocalDate) => void;
  onLongPress?: (date: LocalDate) => void;
}) {
  const { t } = useTranslation();
  const [, month] = day.date.split('-').map(Number);
  const shown = bars.slice(0, MAX_BARS);
  const hidden = bars.length - shown.length;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cell,
        pressed && styles.cellPressed,
        selected && styles.cellSelected,
      ]}
      onPress={() => onPress(day.date)}
      onLongPress={onLongPress ? () => onLongPress(day.date) : undefined}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={t('calendar.dayLabel', { month, day: day.day })}>
      <View style={[styles.dayNumberWrap, day.isToday && styles.todayWrap]}>
        <Text
          style={[
            styles.dayNumber,
            label?.workday ? null : weekdayColor(day.weekday),
            label?.off && styles.holidayNumber,
            !day.inMonth && styles.outOfMonth,
            day.isToday && styles.todayText,
          ]}>
          {day.day}
        </Text>
      </View>
      {label?.badges.length ? (
        <View style={[styles.badges, !day.inMonth && styles.barsOutOfMonth]}>
          {label.badges.map((b) => (
            <Text key={b} style={[styles.badge, { backgroundColor: BADGE_COLORS[b] }]}>
              {t(`holiday.${b}`)}
            </Text>
          ))}
        </View>
      ) : null}
      {label?.text ? (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            label.tone === 'CN' && { color: colors.holidayCN },
            label.tone === 'JP' && { color: colors.holidayJP },
            label.tone === 'lunarSpecial' && { color: colors.lunarSpecial },
            !day.inMonth && styles.barsOutOfMonth,
          ]}>
          {label.text}
        </Text>
      ) : null}
      <View style={[styles.dots, !day.inMonth && styles.barsOutOfMonth]}>
        {dots.slice(0, 4).map((c, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: c }]} />
        ))}
      </View>
      <View style={[styles.bars, !day.inMonth && styles.barsOutOfMonth]}>
        {shown.map((bar) => (
          <View
            key={bar.id}
            style={[
              styles.bar,
              bar.task
                ? [styles.barTask, { borderColor: bar.color }]
                : { backgroundColor: bar.color },
              bar.pending && styles.barPending,
            ]}>
            <Text style={[styles.barText, bar.task && { color: bar.color }]} numberOfLines={1}>
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

const BADGE_COLORS: Record<BadgeKind, string> = {
  cnOff: colors.holidayCN,
  cnWork: colors.holidayWork,
  jpOff: colors.holidayJP,
};

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
  holidayNumber: { color: colors.holidayCN },
  badges: { position: 'absolute', top: 2, right: 2, flexDirection: 'row', gap: 1 },
  badge: {
    fontSize: 8,
    lineHeight: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    paddingHorizontal: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  label: { fontSize: 9, lineHeight: 11, color: colors.textMuted, maxWidth: '100%' },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  bars: { alignSelf: 'stretch', gap: 2, marginTop: 1, paddingHorizontal: 2 },
  barsOutOfMonth: { opacity: 0.4 },
  bar: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  barPending: { opacity: 0.45 },
  barTask: { borderWidth: 1, paddingVertical: 0, backgroundColor: colors.background },
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
