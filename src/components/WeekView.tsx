import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { LocalDate } from '@/lib/date';
import type { DayLabel } from '@/lib/dayLabel';
import { minutesToTime } from '@/lib/time';
import { layoutWeek, visibleHours } from '@/lib/week';
import { colors } from '@/theme/colors';

/** 画成时间块的班次、日程 */
export interface WeekBlock {
  /** "shift:<id>" / "event:<id>" */
  key: string;
  kind: 'shift' | 'event';
  date: LocalDate;
  startTime: string;
  endTime: string | null;
  color: string;
  title: string;
}

/** 顶部「全天」一行里的小条：时间待定的班次、全天日程、项目 DDL、纪念日 */
export interface WeekChip {
  key: string;
  color: string;
  title: string;
  /** 时间待定：颜色浅一些 */
  pending?: boolean;
  /** 只画边框（项目、纪念日） */
  outline?: boolean;
}

/** 每小时的高度：要显示的时间段很长（比如有夜班）时矮一些 */
const hourHeight = (hours: number) => (hours > 16 ? 32 : 44);
const GUTTER = 34;
const MAX_CHIPS = 2;
const SWIPE_DISTANCE = 50;

/**
 * 周视图：7 列，从上到下是时间。班次是实心色块，日程是带色边的浅色块。
 * 过夜的班次在午夜切开，后半段画在第二天。点空白处选中那一天，点色块打开编辑。
 */
export function WeekView({
  dates,
  today,
  focused,
  labels,
  blocks,
  chips,
  onPressDay,
  onPressItem,
  onSwipe,
}: {
  dates: LocalDate[];
  today: LocalDate;
  focused: LocalDate;
  labels?: Map<LocalDate, DayLabel>;
  blocks: WeekBlock[];
  chips: Map<LocalDate, WeekChip[]>;
  onPressDay: (date: LocalDate) => void;
  onPressItem: (key: string) => void;
  onSwipe: (delta: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const weekdayNames = t('calendar.weekdaysShort', { returnObjects: true }) as string[];
  const segments = layoutWeek(blocks, dates);
  const { from, to } = visibleHours(segments);
  const HOUR_HEIGHT = hourHeight(to - from);
  const byKey = new Map(blocks.map((b) => [b.key, b]));
  const hasChips = dates.some((d) => (chips.get(d)?.length ?? 0) > 0);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_DISTANCE) onSwipe(1);
      else if (e.translationX >= SWIPE_DISTANCE) onSwipe(-1);
    });

  return (
    <GestureDetector gesture={swipe} touchAction="pan-y">
      <View style={styles.container}>
        {/* 星期 + 日期 */}
        <View style={styles.headerRow}>
          <View style={styles.gutter} />
          {dates.map((date) => {
            const wd = new Date(`${date}T00:00:00`).getDay();
            const label = labels?.get(date);
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                onPress={() => onPressDay(date)}
                accessibilityRole="button"
                accessibilityLabel={date}
                style={[styles.dayHeader, date === focused && styles.dayHeaderFocused]}>
                <Text style={[styles.weekday, weekdayColor(wd)]}>{weekdayNames[wd]}</Text>
                <View style={[styles.dateWrap, isToday && styles.todayWrap]}>
                  <Text
                    style={[
                      styles.dateText,
                      label?.off ? styles.holiday : !label?.workday && weekdayColor(wd),
                      isToday && styles.todayText,
                    ]}>
                    {Number(date.slice(8, 10))}
                  </Text>
                </View>
                {label?.text ? (
                  <Text numberOfLines={1} style={styles.lunar}>
                    {label.text}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* 全天：时间待定的班次、全天日程、项目、纪念日 */}
        {hasChips && (
          <View style={styles.chipRow}>
            <View style={styles.gutter}>
              <Text style={styles.gutterText}>{t('home.slotAllDay')}</Text>
            </View>
            {dates.map((date) => {
              const list = chips.get(date) ?? [];
              return (
                <View key={date} style={styles.chipCol}>
                  {list.slice(0, MAX_CHIPS).map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => onPressItem(c.key)}
                      accessibilityRole="button"
                      accessibilityLabel={c.title}
                      style={[
                        styles.chip,
                        c.outline
                          ? {
                              borderColor: c.color,
                              borderWidth: 1,
                              backgroundColor: colors.background,
                            }
                          : { backgroundColor: c.color },
                        c.pending && styles.pending,
                      ]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.chipText, c.outline && { color: colors.text }]}>
                        {c.title}
                      </Text>
                    </Pressable>
                  ))}
                  {list.length > MAX_CHIPS && (
                    <Pressable onPress={() => onPressDay(date)} accessibilityRole="button">
                      <Text style={styles.more}>+{list.length - MAX_CHIPS}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 时间轴 */}
        <View style={[styles.grid, { height: (to - from) * HOUR_HEIGHT }]}>
          {Array.from({ length: to - from }, (_, i) => (
            <View key={i} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]}>
              <Text style={styles.hourText}>{from + i}</Text>
            </View>
          ))}
          <View style={styles.gutter} />
          {dates.map((date, day) => (
            <Pressable
              key={date}
              onPress={() => onPressDay(date)}
              accessibilityLabel={date}
              style={[styles.dayCol, date === focused && styles.dayColFocused]}>
              {segments
                .filter((s) => s.day === day)
                .map((s) => {
                  const b = byKey.get(s.key)!;
                  const top = ((s.start - from * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(((s.end - s.start) / 60) * HOUR_HEIGHT, 14);
                  const isShift = b.kind === 'shift';
                  return (
                    <Pressable
                      key={`${s.key}:${s.continued}`}
                      onPress={() => onPressItem(s.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${b.title} ${minutesToTime(s.start)}`}
                      style={[
                        styles.block,
                        {
                          top,
                          height,
                          left: `${(s.lane / s.lanes) * 100}%`,
                          width: `${100 / s.lanes}%`,
                        },
                        isShift
                          ? { backgroundColor: b.color }
                          : { backgroundColor: colors.surface, borderLeftColor: b.color },
                        !isShift && styles.eventBlock,
                        s.continued && styles.continued,
                      ]}>
                      <Text
                        numberOfLines={height >= 40 ? 3 : 1}
                        style={[styles.blockTitle, !isShift && styles.eventText]}>
                        {b.title}
                      </Text>
                      {height >= 30 && (
                        <Text
                          numberOfLines={1}
                          style={[styles.blockTime, !isShift && styles.eventTime]}>
                          {s.continued ? '…' : ''}
                          {minutesToTime(s.start)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
            </Pressable>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

function weekdayColor(weekday: number) {
  if (weekday === 0) return styles.sunday;
  if (weekday === 6) return styles.saturday;
  return null;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gutter: { width: GUTTER, alignItems: 'center', justifyContent: 'center' },
  gutterText: { fontSize: 9, color: colors.textMuted },
  dayHeader: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 6 },
  dayHeaderFocused: { backgroundColor: colors.selectedBg },
  weekday: { fontSize: 11, color: colors.textMuted },
  dateWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWrap: { backgroundColor: colors.primary },
  dateText: { fontSize: 15, color: colors.text },
  todayText: { color: colors.onPrimary, fontWeight: '600' },
  holiday: { color: colors.holidayCN },
  lunar: { fontSize: 9, color: colors.textMuted, maxWidth: '100%' },
  sunday: { color: colors.sunday },
  saturday: { color: colors.saturday },
  chipRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipCol: { flex: 1, gap: 2, paddingHorizontal: 1 },
  chip: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  chipText: { fontSize: 9, color: colors.onColor, fontWeight: '600' },
  pending: { opacity: 0.45 },
  more: { fontSize: 9, color: colors.textMuted, textAlign: 'center' },
  grid: { flexDirection: 'row' },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  hourText: { width: GUTTER, textAlign: 'center', fontSize: 10, color: colors.textMuted },
  dayCol: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayColFocused: { backgroundColor: colors.infoBg },
  block: {
    position: 'absolute',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.background,
  },
  eventBlock: { borderLeftWidth: 3 },
  continued: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  blockTitle: { fontSize: 10, color: colors.onColor, fontWeight: '600' },
  blockTime: { fontSize: 9, color: colors.onColor },
  eventText: { color: colors.text },
  eventTime: { color: colors.textMuted },
});
