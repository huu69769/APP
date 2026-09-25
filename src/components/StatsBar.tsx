import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { WageDisplay } from '@/data/settings';
import type { Currency } from '@/data/types';
import type { YearMonth } from '@/lib/date';
import { formatMoneyMulti } from '@/lib/money';
import type { PeriodMode } from '@/lib/period';
import type { PeriodStats } from '@/lib/stats';
import { formatHours } from '@/lib/time';
import { makeStyles } from '@/theme';

/**
 * 首页的统计栏（一行）：打工时长 · 工钱 · 空闲天数。点击进入统计详情（那里有空闲时间等完整数据）。
 */
export function StatsBar({
  month,
  mode,
  wageDisplay,
  currency,
  stats,
  onPress,
}: {
  month: YearMonth;
  mode: PeriodMode;
  wageDisplay: WageDisplay;
  currency: Currency;
  stats: PeriodStats | undefined;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  const monthNumber = Number(month.slice(5, 7));
  const period = t(mode === 'payPeriod' ? 'stats.barPayPeriod' : 'stats.barCalendarMonth', {
    month: monthNumber,
  });

  let summary = '–';
  if (stats) {
    const wage =
      wageDisplay === 'split'
        ? t('stats.compactSplit', {
            done: formatMoneyMulti(stats.wage.completed, currency),
            expected: formatMoneyMulti(stats.wage.expected, currency),
          })
        : formatMoneyMulti(stats.wage.total, currency);
    summary =
      t('stats.compact', {
        hours: t('stats.hoursValue', { hours: formatHours(stats.totalMinutes) }),
        wage,
        days: stats.freeDays,
      }) + (stats.pending > 0 ? t('stats.compactPending', { count: stats.pending }) : '');
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('stats.open')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
      <Text style={styles.period}>{period}</Text>
      <Text style={styles.summary} numberOfLines={2}>
        {summary}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/** 周视图用的统计栏：这一周的打工时长和工钱 */
export function WeekStatsBar({
  totals,
  currency,
  onPress,
}: {
  totals: { minutes: number; wage: Partial<Record<Currency, number>>; pending: number };
  currency: Currency;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  const summary =
    t('stats.weekCompact', {
      hours: t('stats.hoursValue', { hours: formatHours(totals.minutes) }),
      wage: formatMoneyMulti(totals.wage, currency),
    }) + (totals.pending > 0 ? t('stats.compactPending', { count: totals.pending }) : '');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('stats.open')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
      <Text style={styles.period}>{t('stats.barWeek')}</Text>
      <Text style={styles.summary} numberOfLines={2}>
        {summary}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  period: { fontSize: 12, color: colors.textMuted },
  summary: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  chevron: { fontSize: 16, color: colors.textMuted },
}));
