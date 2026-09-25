import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DayItem } from '@/data/dayItems';
import type { LocalDate } from '@/lib/date';
import { parseLocalDate } from '@/lib/date';
import type { HolidayMark } from '@/lib/holidays';
import type { LunarInfo } from '@/lib/lunar';
import { colors } from '@/theme/colors';

/**
 * 首页下方：选中那一天的安排（班次、日程、项目）。
 * 点一条进入编辑；「详情 ›」进入当天页面（笔记、一键添加等）。
 * 和月历在同一个滚动页面里，往上滑就能看到。
 */
export function DayPanel({
  date,
  items,
  lunar,
  marks,
  onOpenDetails,
  onPressItem,
}: {
  date: LocalDate;
  items: DayItem[] | undefined;
  lunar: LunarInfo | null;
  marks: HolidayMark[];
  onOpenDetails: () => void;
  onPressItem: (item: DayItem) => void;
}) {
  const { t } = useTranslation();
  const d = parseLocalDate(date);
  const weekdays = t('day.weekdays', { returnObjects: true }) as string[];
  const title = t('day.title', { month: d.month() + 1, day: d.date(), weekday: weekdays[d.day()] });
  // 农历、节气 / 传统节日、节假日名（去掉重复，比如「中秋节」同时是农历节日和法定假日）
  const extra = [
    ...new Set(
      [
        lunar?.date,
        lunar?.special,
        ...marks.filter((m) => m.off).map((m) => m.name),
        marks.some((m) => !m.off) ? t('holiday.work') : null,
      ].filter((x): x is string => !!x)
    ),
  ].join(' · ');

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Pressable onPress={onOpenDetails} style={styles.headerMain} accessibilityRole="button">
          <Text style={styles.title}>{title}</Text>
          {extra ? (
            <Text style={styles.extra} numberOfLines={1}>
              {extra}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={onOpenDetails} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.details}>{t('home.details')}</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {items && items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('home.empty')}</Text>
            <Text style={styles.emptyHint}>{t('home.emptyHint')}</Text>
          </View>
        )}
        {items?.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onPressItem(item)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.slot}>
              {typeof item.slot === 'string' ? (
                <Text style={styles.slotText}>
                  {t(
                    item.slot === 'allDay'
                      ? 'home.slotAllDay'
                      : item.slot === 'pending'
                        ? 'home.slotPending'
                        : 'home.slotDdl'
                  )}
                </Text>
              ) : (
                <>
                  <Text style={styles.slotText}>{item.slot.start}</Text>
                  {item.slot.end && (
                    <Text style={styles.slotText}>
                      {item.slot.overnight ? '+1 ' : ''}
                      {item.slot.end}
                    </Text>
                  )}
                </>
              )}
            </View>
            <View
              style={[
                styles.bar,
                item.kind === 'task'
                  ? { borderColor: item.color, borderWidth: 2 }
                  : { backgroundColor: item.color },
                item.slot === 'pending' && styles.barPending,
              ]}
            />
            <View style={styles.body}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.kind === 'task' ? (item.done ? '✓ ' : '⏰ ') : ''}
                {item.title}
                {item.reminder ? ' 🔔' : ''}
              </Text>
              {item.subtitle ? (
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerMain: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  extra: { fontSize: 12, color: colors.textMuted },
  details: { fontSize: 14, color: colors.primary },
  list: { paddingBottom: 96 },
  empty: { padding: 16, gap: 4 },
  emptyText: { fontSize: 14, color: colors.textMuted },
  emptyHint: { fontSize: 12, color: colors.textFaint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  slot: { width: 44, alignItems: 'center' },
  slotText: { fontSize: 12, color: colors.textMuted },
  bar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  barPending: { opacity: 0.45 },
  body: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, color: colors.text },
  itemSubtitle: { fontSize: 12, color: colors.textMuted },
  chevron: { fontSize: 18, color: colors.textFaint },
});
