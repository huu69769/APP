import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Currency } from '@/data/types';
import type { WageDisplay } from '@/data/settings';
import type { YearMonth } from '@/lib/date';
import { formatMoneyMulti } from '@/lib/money';
import type { PeriodMode } from '@/lib/period';
import type { PeriodStats } from '@/lib/stats';
import { formatHours } from '@/lib/time';
import { colors } from '@/theme/colors';

/**
 * 首页上方的统计栏：打工时长、工钱、空闲天数、空闲时间。点击进入统计详情。
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
  const { t } = useTranslation();
  const monthNumber = Number(month.slice(5, 7));
  const hours = (m: number) => t('stats.hoursValue', { hours: formatHours(m) });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('stats.open')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
      <Text style={styles.period}>
        {t(mode === 'payPeriod' ? 'stats.barPayPeriod' : 'stats.barCalendarMonth', { month: monthNumber })} ›
      </Text>
      <View style={styles.cells}>
        <Cell label={t('stats.hours')} value={stats ? hours(stats.totalMinutes) : '–'} />
        <View style={[styles.cell, styles.wageCell]}>
          <Text style={styles.label}>{t('stats.wage')}</Text>
          {!stats ? (
            <Text style={styles.value}>–</Text>
          ) : wageDisplay === 'split' ? (
            <>
              <Text style={styles.small} numberOfLines={2}>
                {t('stats.completed')} {formatMoneyMulti(stats.wage.completed, currency)}
              </Text>
              <Text style={[styles.small, styles.muted]} numberOfLines={2}>
                {t('stats.expected')} {formatMoneyMulti(stats.wage.expected, currency)}
              </Text>
            </>
          ) : (
            <Text style={styles.value} numberOfLines={2} adjustsFontSizeToFit>
              {formatMoneyMulti(stats.wage.total, currency)}
            </Text>
          )}
        </View>
        <Cell
          label={t('stats.freeDays')}
          value={stats ? t('stats.freeDaysValue', { count: stats.freeDays }) : '–'}
        />
        <Cell label={t('stats.freeHours')} value={stats ? hours(stats.freeMinutes) : '–'} />
      </View>
    </Pressable>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  period: { fontSize: 12, color: colors.textMuted },
  cells: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, gap: 2 },
  wageCell: { flex: 1.6 },
  label: { fontSize: 11, color: colors.textMuted },
  value: { fontSize: 15, fontWeight: '600', color: colors.text },
  small: { fontSize: 12, fontWeight: '600', color: colors.text },
  muted: { color: colors.textMuted },
});
