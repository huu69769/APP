import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyText, Field, FormScreen, ListRow, Section, Segmented } from '@/components/form';
import { useData } from '@/data/DataProvider';
import { jobPayType } from '@/data/types';
import { useMonthStats, useYearIncome } from '@/data/useStats';
import { addMonths, currentMonth, type YearMonth } from '@/lib/date';
import { formatMoneyMulti } from '@/lib/money';
import type { DateRange } from '@/lib/period';
import { formatHours } from '@/lib/time';
import { colors } from '@/theme/colors';

/**
 * 统计详情：切换统计周期和工钱显示方式、按兼职统计、空闲时间、年度累计收入。
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<YearMonth>(
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth()
  );
  const { settings, updateSettings } = useData();
  const currency = settings.defaultCurrency;
  const { data } = useMonthStats(month);
  const year = Number(month.slice(0, 4));
  const { data: yearData } = useYearIncome(year);
  const stats = data?.stats;

  const hours = (m: number) => t('stats.hoursValue', { hours: formatHours(m) });
  const range = (r: DateRange) => t('stats.range', { from: r.from, to: r.to });
  const [y, m] = month.split('-').map(Number);

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('stats.title') }} />

      <View style={styles.monthNav}>
        <NavButton
          label="‹"
          a11y={t('calendar.prevMonth')}
          onPress={() => setMonth((x) => addMonths(x, -1))}
        />
        <Text style={styles.monthTitle}>{t('calendar.monthTitle', { year: y, month: m })}</Text>
        <NavButton
          label="›"
          a11y={t('calendar.nextMonth')}
          onPress={() => setMonth((x) => addMonths(x, 1))}
        />
      </View>

      <Section>
        <Field label={t('stats.periodMode')}>
          <Segmented
            options={[
              { value: 'calendarMonth', label: t('stats.calendarMonth') },
              { value: 'payPeriod', label: t('stats.payPeriod') },
            ]}
            value={settings.statsPeriod}
            onChange={(v) => updateSettings({ statsPeriod: v })}
          />
        </Field>
        <Field label={t('stats.wageDisplay')}>
          <Segmented
            options={[
              { value: 'total', label: t('stats.wageTotal') },
              { value: 'split', label: t('stats.wageSplit') },
            ]}
            value={settings.wageDisplay}
            onChange={(v) => updateSettings({ wageDisplay: v })}
          />
        </Field>
        {settings.statsPeriod === 'payPeriod' && <EmptyText>{t('stats.payNote')}</EmptyText>}
      </Section>

      {stats && (
        <>
          <Section>
            <View style={styles.summary}>
              <Big label={t('stats.hours')} value={hours(stats.totalMinutes)} />
              <Big
                label={t('stats.freeDays')}
                value={t('stats.freeDaysValue', { count: stats.freeDays })}
              />
              <Big label={t('stats.freeHours')} value={hours(stats.freeMinutes)} />
            </View>
            <View style={styles.wageBlock}>
              <Text style={styles.label}>{t('stats.wage')}</Text>
              {settings.wageDisplay === 'split' ? (
                <>
                  <Text style={styles.wage}>
                    {t('stats.completed')} {formatMoneyMulti(stats.wage.completed, currency)}
                  </Text>
                  <Text style={[styles.wage, styles.muted]}>
                    {t('stats.expected')} {formatMoneyMulti(stats.wage.expected, currency)}
                  </Text>
                </>
              ) : (
                <Text style={styles.wage}>{formatMoneyMulti(stats.wage.total, currency)}</Text>
              )}
            </View>
            {stats.pending > 0 && (
              <EmptyText>{t('stats.pendingNote', { count: stats.pending })}</EmptyText>
            )}
          </Section>

          <Section title={t('stats.byJob')}>
            {stats.jobs.every((j) => j.days === 0 && j.tasksDone + j.tasksOpen === 0) && (
              <EmptyText>{t('stats.noShifts')}</EmptyText>
            )}
            {stats.jobs
              .filter(
                (j) =>
                  j.days > 0 ||
                  j.tasksDone + j.tasksOpen > 0 ||
                  !data?.jobsById.get(j.jobId)?.deletedAt
              )
              .map((j) => {
                const job = data?.jobsById.get(j.jobId);
                if (job && jobPayType(job) === 'piece') {
                  return (
                    <ListRow
                      key={j.jobId}
                      color={job.color}
                      title={job.name}
                      subtitle={[
                        t('stats.tasksSummary', { done: j.tasksDone, open: j.tasksOpen }),
                        settings.statsPeriod === 'payPeriod' ? range(j.range) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      right={formatMoneyMulti(j.wage, job.currency)}
                    />
                  );
                }
                return (
                  <ListRow
                    key={j.jobId}
                    color={job?.color ?? colors.textMuted}
                    title={job?.name ?? ''}
                    subtitle={[
                      hours(j.minutes),
                      t('stats.attendance', { count: j.days }),
                      j.pending > 0 ? t('stats.pendingShort', { count: j.pending }) : null,
                      settings.statsPeriod === 'payPeriod' ? range(j.range) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={formatMoneyMulti(j.wage, job?.currency ?? currency)}
                  />
                );
              })}
          </Section>

          <Section title={t('stats.freeTime')}>
            <ListRow
              title={t('stats.freeDays')}
              right={t('stats.freeDaysValue', { count: stats.freeDays })}
            />
            <ListRow title={t('stats.freeHours')} right={hours(stats.freeMinutes)} />
            <EmptyText>
              {t('stats.freeRange', { from: stats.freeRange.from, to: stats.freeRange.to })}
            </EmptyText>
            <EmptyText>{t('stats.freeNote')}</EmptyText>
          </Section>
        </>
      )}

      {yearData && (
        <Section title={t('stats.year', { year })}>
          <ListRow
            title={t('stats.yearTotal')}
            right={formatMoneyMulti(yearData.total, currency)}
          />
          <View style={styles.divider} />
          {yearData.months.map((row) => (
            <Pressable
              key={row.month}
              onPress={() => setMonth(row.month)}
              accessibilityRole="button">
              <View style={[styles.monthRow, row.month === month && styles.monthRowActive]}>
                <Text style={styles.monthLabel}>
                  {t('stats.monthLabel', { month: Number(row.month.slice(5, 7)) })}
                </Text>
                <Text
                  style={[styles.monthValue, Object.keys(row.wage).length === 0 && styles.muted]}>
                  {formatMoneyMulti(row.wage, currency)}
                </Text>
              </View>
            </Pressable>
          ))}
        </Section>
      )}
    </FormScreen>
  );
}

function NavButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.navButton}
      accessibilityRole="button"
      accessibilityLabel={a11y}>
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.big}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navButton: { paddingHorizontal: 12, paddingVertical: 4 },
  navText: { fontSize: 24, color: colors.text },
  monthTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  summary: { flexDirection: 'row', gap: 8 },
  big: { flex: 1, gap: 4 },
  bigValue: { fontSize: 18, fontWeight: '600', color: colors.text },
  label: { fontSize: 12, color: colors.textMuted },
  wageBlock: { gap: 4 },
  wage: { fontSize: 20, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  monthRowActive: { backgroundColor: colors.surface },
  monthLabel: { fontSize: 15, color: colors.text },
  monthValue: { fontSize: 15, color: colors.text },
});
