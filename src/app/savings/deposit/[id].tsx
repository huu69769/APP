import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Input, Section, Segmented } from '@/components/form';
import { DatePicker } from '@/components/pickers/TimePicker';
import { accountLabel } from '@/components/savings/SavingsView';
import { useData } from '@/data/DataProvider';
import type { Account, Deposit, NewEntity, SavingPlan } from '@/data/types';
import { currentMonth, isValidLocalDate, today } from '@/lib/date';
import { moneyToInput, parseMoney } from '@/lib/money';
import { monthSummary } from '@/lib/savings';

const NO_ACCOUNT = 'none';

/** 记录一笔存入：新建（id = "new"，参数 planId）或编辑 */
export default function DepositEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; planId?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [plan, setPlan] = useState<SavingPlan | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string>(NO_ACCOUNT);
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      setAccounts(await repos.accounts.list());
      let planId = params.planId;
      if (!isNew) {
        const d = await repos.deposits.get(params.id);
        if (d) {
          planId = d.planId;
          setDate(d.date);
          setAccountId(d.accountId ?? NO_ACCOUNT);
          setNote(d.note);
        }
        const p = planId ? await repos.saving_plans.get(planId) : null;
        setPlan(p);
        if (d && p) setAmount(moneyToInput(d.amount, p.currency));
      } else if (planId) {
        const p = await repos.saving_plans.get(planId);
        setPlan(p);
        if (p) {
          // 默认：这个月还差多少（没差就填每月金额）、计划的默认账户
          const deposits = await repos.deposits.list();
          const [info] = monthSummary({
            plans: [p],
            deposits,
            month: currentMonth(),
            today: today(),
          }).plans;
          setAmount(moneyToInput(info.owed || p.monthlyAmount, p.currency));
          setAccountId(p.accountId ?? NO_ACCOUNT);
        }
      }
      setLoaded(true);
    })();
  }, [isNew, params.id, params.planId, repos]);

  if (!loaded) return null;
  if (!plan) {
    return (
      <FormScreen>
        <EmptyText>{t('errors.notFound')}</EmptyText>
      </FormScreen>
    );
  }

  const parsed = parseMoney(amount, plan.currency);
  const errors = {
    amount: parsed !== null && parsed > 0 ? null : t('target.amountInvalid'),
    date: isValidLocalDate(date) ? null : t('errors.dateInvalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<Deposit> = {
      planId: plan.id,
      date,
      amount: parsed!,
      accountId: accountId === NO_ACCOUNT ? null : accountId,
      note: note.trim(),
    };
    try {
      if (isNew) await repos.deposits.create(data);
      else await repos.deposits.update(params.id, data);
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('savings.deleteDepositTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.deposits.remove(params.id);
    router.back();
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'savings.record' : 'savings.editDeposit') }} />
      <Section title={plan.name}>
        <Field label={t('savings.amount')} error={err('amount')}>
          <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </Field>
        <Field label={t('savings.date')} error={err('date')}>
          <DatePicker value={date} onChange={setDate} accessibilityLabel={t('savings.date')} />
        </Field>
        <Field label={t('savings.account')}>
          <Segmented
            options={[
              { value: NO_ACCOUNT, label: t('savings.noAccount') },
              ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) })),
            ]}
            value={accountId}
            onChange={setAccountId}
          />
        </Field>
        <Field label={t('savings.note')}>
          <Input
            value={note}
            onChangeText={setNote}
            multiline
            placeholder={t('savings.depositNotePlaceholder')}
          />
        </Field>
      </Section>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
