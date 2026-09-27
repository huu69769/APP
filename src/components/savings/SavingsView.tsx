import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { Button, EmptyText, Section } from '@/components/form';
import { YearTargetChart } from '@/components/IncomeTarget';
import { useData } from '@/data/DataProvider';
import type { Account, Currency, SavingPlan } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { currentMonth, today as getToday, type YearMonth } from '@/lib/date';
import { formatMoney, formatMoneyMulti } from '@/lib/money';
import {
  monthSummary,
  monthsUntil,
  planTarget,
  savedTotal,
  savingsYearBars,
  type PlanMonth,
} from '@/lib/savings';
import { makeStyles } from '@/theme';

import { PlanProgressBar } from './PlanProgressBar';

/**
 * 存钱：本月应存 / 已存 / 还差，按状态分组的计划列表，全年每月存入的柱状图，账户管理入口。
 */
export function SavingsView() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { settings } = useData();
  const today = getToday();
  const month = currentMonth();
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(month);
  const [chartCurrency, setChartCurrency] = useState<Currency>(settings.defaultCurrency);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const { data } = useQuery(async (r) => {
    const [plans, deposits, accounts] = await Promise.all([
      r.saving_plans.list(),
      r.deposits.list(),
      r.accounts.list(),
    ]);
    return {
      plans: plans.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      deposits,
      accounts: new Map(accounts.map((a) => [a.id, a])),
    };
  }, []);

  if (!data) return null;
  const { plans, deposits, accounts } = data;
  const summary = monthSummary({ plans, deposits, month, today });
  const byPlan = new Map(summary.plans.map((p) => [p.planId, p]));
  const group = (status: PlanMonth['status']) =>
    plans.filter((p) => byPlan.get(p.id)?.status === status);
  const currencies = [...new Set([settings.defaultCurrency, ...plans.map((p) => p.currency)])];
  const year = Number(selectedMonth.slice(0, 4));
  const bars = savingsYearBars({ plans, deposits, year, currency: chartCurrency, today });
  const selected = monthSummary({ plans, deposits, month: selectedMonth, today });
  const fallback = plans[0]?.currency ?? settings.defaultCurrency;

  const open = (p: SavingPlan) => router.push({ pathname: '/savings/[id]', params: { id: p.id } });
  const row = (p: SavingPlan) => (
    <PlanRow
      key={p.id}
      plan={p}
      month={byPlan.get(p.id)!}
      saved={savedTotal(p.id, deposits)}
      account={p.accountId ? accounts.get(p.accountId) : undefined}
      currentMonth={month}
      onPress={() => open(p)}
    />
  );

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('savings.thisMonth')}</Text>
        <View style={styles.totals}>
          <Total
            label={t('savings.required')}
            value={formatMoneyMulti(summary.required, fallback)}
          />
          <Total label={t('savings.saved')} value={formatMoneyMulti(summary.saved, fallback)} />
          <Total label={t('savings.owed')} value={formatMoneyMulti(summary.owed, fallback)} />
        </View>
      </View>

      {plans.length === 0 && (
        <Section>
          <EmptyText>{t('savings.empty')}</EmptyText>
        </Section>
      )}
      {(
        [
          ['active', 'savings.groupActive'],
          ['paused', 'savings.groupPaused'],
          ['upcoming', 'savings.groupUpcoming'],
          ['done', 'savings.groupDone'],
        ] as const
      ).map(([status, title]) => {
        const list = group(status);
        return list.length ? (
          <Section key={status} title={t(title)}>
            {list.map(row)}
          </Section>
        ) : null;
      })}

      <Button
        title={t('savings.newPlan')}
        onPress={() => router.push({ pathname: '/savings/edit/[id]', params: { id: 'new' } })}
      />

      {plans.length > 0 && (
        <Section title={t('savings.yearTitle', { year })}>
          <View style={styles.chartHeader}>
            <Text style={styles.muted}>{t('savings.chartHint')}</Text>
            {currencies.length > 1 && (
              <Pressable
                onPress={() => setCurrencyOpen(true)}
                accessibilityRole="button"
                style={styles.currencyButton}>
                <Text style={styles.currencyText}>{t(`currency.${chartCurrency}`)} ▾</Text>
              </Pressable>
            )}
          </View>
          <YearTargetChart
            bars={bars}
            currency={chartCurrency}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            labels={{ earned: t('savings.saved'), target: t('savings.required') }}
          />
          <Text style={styles.monthTitle}>
            {t('savings.monthDetail', { month: Number(selectedMonth.slice(5, 7)) })}
          </Text>
          {selected.plans
            .filter((p) => p.required > 0 || p.saved > 0)
            .map((p) => {
              const plan = plans.find((x) => x.id === p.planId)!;
              return (
                <View key={p.planId} style={styles.detailRow}>
                  <Text style={styles.detailName} numberOfLines={1}>
                    {plan.name}
                  </Text>
                  <Text style={styles.detailValue}>
                    {formatMoney(p.saved, plan.currency)}
                    {p.required > 0 && (
                      <Text style={styles.muted}> / {formatMoney(p.required, plan.currency)}</Text>
                    )}
                  </Text>
                </View>
              );
            })}
          {selected.plans.every((p) => p.required === 0 && p.saved === 0) && (
            <EmptyText>{t('savings.monthNone')}</EmptyText>
          )}
        </Section>
      )}

      <Pressable
        onPress={() => router.push('/accounts')}
        accessibilityRole="button"
        style={styles.link}>
        <Text style={styles.linkText}>{t('savings.manageAccounts')}</Text>
      </Pressable>

      <ActionSheet
        visible={currencyOpen}
        title={t('target.chartCurrency')}
        onClose={() => setCurrencyOpen(false)}
        actions={currencies.map((c) => ({
          label: `${t(`currency.${c}`)} ${c}`,
          onPress: () => setChartCurrency(c),
        }))}
      />
    </>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.total}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** 列表里的一个计划：名称、账户、进度，以及这个月的情况 / 离开始还有几个月 */
function PlanRow({
  plan,
  month,
  saved,
  account,
  currentMonth: now,
  onPress,
}: {
  plan: SavingPlan;
  month: PlanMonth;
  saved: number;
  account: Account | undefined;
  currentMonth: YearMonth;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const target = planTarget(plan);
  const money = (v: number) => formatMoney(v, plan.currency);
  let status: string;
  if (month.status === 'upcoming') {
    status = t('savings.startsIn', {
      month: `${plan.startMonth.slice(0, 4)}/${Number(plan.startMonth.slice(5, 7))}`,
      count: monthsUntil(now, plan.startMonth),
    });
  } else if (month.status === 'active') {
    status =
      month.owed === 0
        ? t('savings.monthDone')
        : t('savings.monthOwed', {
            amount: money(month.owed),
            day: Number(month.dueDate.slice(8, 10)),
          });
  } else if (month.status === 'paused') {
    status = t('savings.statusPaused');
  } else {
    status = t('savings.statusDone');
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.plan}>
      <View style={styles.planHeader}>
        <Text
          style={[styles.planName, month.status === 'upcoming' && styles.dim]}
          numberOfLines={1}>
          {plan.name}
        </Text>
        <Text style={styles.planAmount}>
          {t('savings.perMonth', { amount: money(plan.monthlyAmount) })}
        </Text>
      </View>
      {target !== null ? (
        <>
          <PlanProgressBar
            ratio={target > 0 ? saved / target : 1}
            dim={month.status !== 'active'}
          />
          <Text style={styles.planSub}>
            {t('savings.progress', {
              saved: money(saved),
              target: money(target),
              percent: target > 0 ? Math.floor((saved / target) * 100) : 100,
            })}
          </Text>
        </>
      ) : (
        <Text style={styles.planSub}>{t('savings.savedLongTerm', { saved: money(saved) })}</Text>
      )}
      <Text style={[styles.planStatus, month.overdue && styles.overdue]}>
        {[status, account ? accountLabel(account) : null].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
}

/** 「招商银行 生日专款卡（1234）」 */
export function accountLabel(a: Pick<Account, 'name' | 'last4'>): string {
  return a.last4 ? `${a.name}（${a.last4}）` : a.name;
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.background, borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, gap: 2 },
  totalValue: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  dim: { color: colors.textMuted },
  plan: { paddingVertical: 10, gap: 5 },
  planHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  planName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  planAmount: { fontSize: 13, color: colors.textMuted },
  planSub: { fontSize: 13, color: colors.text },
  planStatus: { fontSize: 12, color: colors.textMuted },
  overdue: { color: colors.warningText },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyText: { fontSize: 13, color: colors.text },
  monthTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  detailName: { flex: 1, fontSize: 14, color: colors.text },
  detailValue: { fontSize: 14, color: colors.text },
  link: { alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 14, color: colors.primary },
}));
