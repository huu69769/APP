import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { confirmAsync } from '@/components/confirm';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { Ring } from '@/components/IncomeTarget';
import { accountLabel } from '@/components/savings/SavingsView';
import { useData } from '@/data/DataProvider';
import { useQuery } from '@/data/useQuery';
import { currentMonth, today as getToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import {
  monthSummary,
  monthsBetween,
  monthsUntil,
  pauseFrom,
  planTarget,
  resumeIn,
  savedTotal,
} from '@/lib/savings';
import { makeStyles } from '@/theme';

/** 存钱计划的详情：进度、本月情况、存入记录；暂停 / 恢复、编辑、删除 */
export default function SavingPlanScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useData();
  const month = currentMonth();
  const today = getToday();

  const { data } = useQuery(
    async (r) => {
      const [plan, deposits, accounts] = await Promise.all([
        r.saving_plans.get(id),
        r.deposits.list(),
        r.accounts.list(),
      ]);
      return {
        plan,
        deposits: deposits
          .filter((d) => d.planId === id)
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
        accounts: new Map(accounts.map((a) => [a.id, a])),
      };
    },
    [id]
  );

  if (!data) return null;
  const { plan, deposits, accounts } = data;
  if (!plan) {
    return (
      <FormScreen>
        <EmptyText>{t('errors.notFound')}</EmptyText>
      </FormScreen>
    );
  }

  const money = (v: number) => formatMoney(v, plan.currency);
  const saved = savedTotal(plan.id, deposits);
  const target = planTarget(plan);
  const [info] = monthSummary({ plans: [plan], deposits, month, today }).plans;
  const account = plan.accountId ? accounts.get(plan.accountId) : undefined;
  const remaining =
    plan.endMonth && info.status !== 'done'
      ? monthsBetween(month > plan.startMonth ? month : plan.startMonth, plan.endMonth)
      : null;

  const statusText = {
    upcoming: t('savings.startsIn', {
      month: `${plan.startMonth.slice(0, 4)}/${Number(plan.startMonth.slice(5, 7))}`,
      count: monthsUntil(month, plan.startMonth),
    }),
    active:
      info.owed === 0
        ? t('savings.monthDone')
        : t('savings.monthOwed', {
            amount: money(info.owed),
            day: Number(info.dueDate.slice(8, 10)),
          }),
    paused: t('savings.statusPaused'),
    done: t('savings.statusDone'),
  }[info.status];

  const togglePause = async () => {
    const pausing = info.status !== 'paused';
    const ok = await confirmAsync({
      title: t(pausing ? 'savings.pauseTitle' : 'savings.resumeTitle'),
      message: t(pausing ? 'savings.pauseMessage' : 'savings.resumeMessage'),
      confirmText: t(pausing ? 'savings.pause' : 'savings.resume'),
      cancelText: t('common.cancel'),
    });
    if (!ok) return;
    await repos.saving_plans.update(plan.id, {
      pauses: pausing ? pauseFrom(plan.pauses, month) : resumeIn(plan.pauses, month),
    });
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('savings.deleteTitle'),
      message: t('savings.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    for (const d of deposits) await repos.deposits.remove(d.id);
    await repos.saving_plans.remove(plan.id);
    router.back();
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: plan.name }} />
      <View style={styles.card}>
        <View style={styles.top}>
          {target !== null && (
            <View style={styles.ringWrap}>
              <Ring earned={target > 0 ? Math.min(saved / target, 1) : 1} expected={0} size={120} />
              <View style={styles.ringCenter}>
                <Text style={styles.percent}>
                  {target > 0 ? Math.floor((saved / target) * 100) : 100}%
                </Text>
              </View>
            </View>
          )}
          <View style={styles.info}>
            <Info label={t('savings.savedTotal')} value={money(saved)} />
            {target !== null && <Info label={t('savings.targetLabel')} value={money(target)} />}
            <Info label={t('savings.monthly')} value={money(plan.monthlyAmount)} />
          </View>
        </View>
        <Text style={[styles.status, info.overdue && styles.overdue]}>{statusText}</Text>
        <Text style={styles.meta}>
          {[
            t('savings.periodText', {
              start: plan.startMonth.replace('-', '/'),
              end: plan.endMonth ? plan.endMonth.replace('-', '/') : t('savings.longTerm'),
            }),
            remaining !== null ? t('savings.remainingMonths', { count: remaining }) : null,
            t('savings.everyMonthDay', { day: plan.saveDay }),
            account ? accountLabel(account) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {plan.note ? <Text style={styles.note}>{plan.note}</Text> : null}
      </View>

      {info.status !== 'done' && (
        <Button
          title={t('savings.record')}
          onPress={() =>
            router.push({
              pathname: '/savings/deposit/[id]',
              params: { id: 'new', planId: plan.id },
            })
          }
        />
      )}

      <Section title={t('savings.history')}>
        {deposits.length === 0 && <EmptyText>{t('savings.historyEmpty')}</EmptyText>}
        {deposits.map((d) => {
          const a = d.accountId ? accounts.get(d.accountId) : undefined;
          return (
            <ListRow
              key={d.id}
              title={money(d.amount)}
              subtitle={[d.date, a ? accountLabel(a) : null, d.note || null]
                .filter(Boolean)
                .join(' · ')}
              onPress={() =>
                router.push({ pathname: '/savings/deposit/[id]', params: { id: d.id } })
              }
            />
          );
        })}
      </Section>

      {(info.status === 'active' || info.status === 'paused') && (
        <Button
          variant="secondary"
          title={t(info.status === 'paused' ? 'savings.resume' : 'savings.pause')}
          onPress={togglePause}
        />
      )}
      <Button
        variant="secondary"
        title={t('savings.editPlan')}
        onPress={() => router.push({ pathname: '/savings/edit/[id]', params: { id: plan.id } })}
      />
      <Button variant="danger" title={t('common.delete')} onPress={remove} />
    </FormScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.background, borderRadius: 12, padding: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute' },
  percent: { fontSize: 22, fontWeight: '700', color: colors.text },
  info: { flex: 1, gap: 6 },
  label: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 16, fontWeight: '600', color: colors.text },
  status: { fontSize: 14, fontWeight: '600', color: colors.text },
  overdue: { color: colors.warningText },
  meta: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 14, color: colors.text },
}));
