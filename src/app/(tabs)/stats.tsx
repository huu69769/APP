import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyText, Field, FormScreen, ListRow, Section, Segmented } from '@/components/form';
import { ActionSheet } from '@/components/ActionSheet';
import { MonthTargetCard, TargetEditor, YearTargetChart } from '@/components/IncomeTarget';
import { useData } from '@/data/DataProvider';
import { isActiveJob, jobPayType, type Currency } from '@/data/types';
import { useMonthStats, useYearIncome } from '@/data/useStats';
import { addMonths, currentMonth, type YearMonth } from '@/lib/date';
import { formatMoney, formatMoneyMulti } from '@/lib/money';
import { currenciesInYear, type IncomeTarget, yearTargetSummary } from '@/lib/target';
import type { DateRange } from '@/lib/period';
import { formatHours } from '@/lib/time';
import { makeStyles, useColors } from '@/theme';

/**
 * 统计详情：切换统计周期和工钱显示方式、按兼职统计、空闲时间、年度累计收入。
 */
export default function StatsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<YearMonth>(
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth()
  );
  // 从首页统计栏点进来时带着那个月；统计是标签页，一直在后台，所以参数变了要跟着换
  useEffect(() => {
    if (params.month && /^\d{4}-\d{2}$/.test(params.month)) setMonth(params.month);
  }, [params.month]);
  const { settings, updateSettings } = useData();
  const currency = settings.defaultCurrency;
  const { data } = useMonthStats(month);
  const year = Number(month.slice(0, 4));
  const { data: yearData } = useYearIncome(year);
  const stats = data?.stats;
  const [editing, setEditing] = useState(false);
  // 年度图表显示哪个币种：默认是设置里的默认币种，可以切换
  const [chartCurrency, setChartCurrency] = useState<Currency>(settings.defaultCurrency);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const targets = settings.monthlyTargets;
  const target = targets[month];
  const prevTarget = targets[addMonths(month, -1)];
  const setTarget = (v: IncomeTarget | null) => {
    const next = { ...targets };
    if (v) next[month] = v;
    else delete next[month];
    updateSettings({ monthlyTargets: next });
  };
  const summary = yearData
    ? yearTargetSummary({
        months: yearData.months,
        targets,
        currency: chartCurrency,
        currentMonth: currentMonth(),
      })
    : null;
  const chartCurrencies = yearData
    ? [...new Set([settings.defaultCurrency, ...currenciesInYear(yearData.months, targets)])]
    : [];

  const hours = (m: number) => t('stats.hoursValue', { hours: formatHours(m) });
  const range = (r: DateRange) => t('stats.range', { from: r.from, to: r.to });
  const [y, m] = month.split('-').map(Number);

  return (
    <FormScreen>
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

      <MonthTargetCard
        label={
          settings.statsPeriod === 'payPeriod'
            ? t('target.periodLabel')
            : t('stats.monthLabel', { month: m })
        }
        target={target}
        prevTarget={prevTarget}
        wage={stats?.wage}
        onEdit={() => setEditing(true)}
        onCopyPrev={() => prevTarget && setTarget(prevTarget)}
      />

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
                label={t('stats.workDays')}
                value={t('stats.freeDaysValue', { count: stats.workDays })}
              />
            </View>
            <View style={styles.summary}>
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
                        t('stats.tasksSummary', {
                          count: j.tasksDone + j.tasksOpen,
                          done: j.tasksDone,
                          open: j.tasksOpen,
                        }),
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
          {summary && (
            <>
              <View style={styles.chartHeader}>
                <View style={styles.chartSummary}>
                  <Text style={styles.chartTotal}>
                    {t('target.yearEarned', { amount: formatMoney(summary.earned, chartCurrency) })}
                  </Text>
                  {summary.targetTotal > 0 && (
                    <Text style={styles.muted}>
                      {t('target.yearTarget', {
                        amount: formatMoney(summary.targetTotal, chartCurrency),
                      })}
                      {summary.judgedCount > 0 &&
                        ` · ${t('target.reachedCount', { reached: summary.reachedCount, total: summary.judgedCount })}`}
                    </Text>
                  )}
                </View>
                {chartCurrencies.length > 1 && (
                  <Pressable
                    onPress={() => setCurrencyOpen(true)}
                    accessibilityRole="button"
                    style={styles.currencyButton}>
                    <Text style={styles.currencyText}>{t(`currency.${chartCurrency}`)} ▾</Text>
                  </Pressable>
                )}
              </View>
              <YearTargetChart
                bars={summary.bars}
                currency={chartCurrency}
                selectedMonth={month}
                onSelectMonth={setMonth}
              />
              <View style={styles.divider} />
            </>
          )}
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
                  {targets[row.month] && (
                    <Text style={styles.muted}>
                      {' / '}
                      {formatMoney(targets[row.month]!.amount, targets[row.month]!.currency)}
                    </Text>
                  )}
                </Text>
              </View>
            </Pressable>
          ))}
        </Section>
      )}
      <TargetEditor
        visible={editing}
        title={t('target.editTitle', {
          month:
            settings.statsPeriod === 'payPeriod'
              ? t('target.periodLabel')
              : t('stats.monthLabel', { month: m }),
        })}
        value={target}
        defaultCurrency={prevTarget?.currency ?? settings.defaultCurrency}
        onSave={setTarget}
        onClose={() => setEditing(false)}
      />
      <ActionSheet
        visible={currencyOpen}
        title={t('target.chartCurrency')}
        onClose={() => setCurrencyOpen(false)}
        actions={chartCurrencies.map((c) => ({
          label: `${t(`currency.${c}`)} ${c}`,
          onPress: () => setChartCurrency(c),
        }))}
      />
    </FormScreen>
  );
}

function NavButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <View style={styles.big}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  chartSummary: { flex: 1, gap: 2 },
  chartTotal: { fontSize: 16, fontWeight: '600', color: colors.text },
  currencyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyText: { fontSize: 13, color: colors.text },
}));
