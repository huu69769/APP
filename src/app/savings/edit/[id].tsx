import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Input, Section, Segmented } from '@/components/form';
import { MonthInput, toYearMonth } from '@/components/savings/MonthInput';
import { accountLabel } from '@/components/savings/SavingsView';
import { useNewAccount } from '@/components/savings/useNewAccount';
import { useData } from '@/data/DataProvider';
import { CURRENCIES, type Currency, type NewEntity, type SavingPlan } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { currentMonth } from '@/lib/date';
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money';
import { planTarget } from '@/lib/savings';
import { makeStyles } from '@/theme';

const NO_ACCOUNT = 'none';

/** 存钱计划：新建（id = "new"）或编辑 */
export default function SavingPlanEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const { repos, settings } = useData();
  const { data: accounts } = useQuery((r) => r.accounts.list(), []);

  const now = currentMonth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [monthly, setMonthly] = useState('');
  const [startY, setStartY] = useState(now.slice(0, 4));
  const [startM, setStartM] = useState(String(Number(now.slice(5, 7))));
  const [longTerm, setLongTerm] = useState(false);
  const [endY, setEndY] = useState('');
  const [endM, setEndM] = useState('');
  const [target, setTarget] = useState('');
  const [saveDay, setSaveDay] = useState('25');
  const [accountId, setAccountId] = useState<string>(NO_ACCOUNT);
  const [remind, setRemind] = useState(true);
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<SavingPlan | null>(null);
  const newAccount = useNewAccount(accounts, setAccountId);
  const styles = useStyles();
  const [loaded, setLoaded] = useState(isNew);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repos.saving_plans.get(params.id).then((p) => {
      if (p) {
        setExisting(p);
        setName(p.name);
        setCurrency(p.currency);
        setMonthly(moneyToInput(p.monthlyAmount, p.currency));
        setStartY(p.startMonth.slice(0, 4));
        setStartM(String(Number(p.startMonth.slice(5, 7))));
        setLongTerm(p.endMonth === null);
        if (p.endMonth) {
          setEndY(p.endMonth.slice(0, 4));
          setEndM(String(Number(p.endMonth.slice(5, 7))));
        }
        setTarget(p.targetAmount === null ? '' : moneyToInput(p.targetAmount, p.currency));
        setSaveDay(String(p.saveDay));
        setAccountId(p.accountId ?? NO_ACCOUNT);
        setRemind(p.remind);
        setNote(p.note);
      }
      setLoaded(true);
    });
  }, [isNew, params.id, repos]);

  const monthlyAmount = parseMoney(monthly, currency);
  const startMonth = toYearMonth(startY, startM);
  const endMonth = longTerm ? null : toYearMonth(endY, endM);
  const targetAmount = target.trim() ? parseMoney(target, currency) : null;
  const day = Number(saveDay);
  const errors = {
    name: name.trim() ? null : t('errors.nameRequired'),
    monthly: monthlyAmount !== null && monthlyAmount > 0 ? null : t('target.amountInvalid'),
    start: startMonth ? null : t('savings.monthInvalid'),
    end:
      longTerm || (endMonth && startMonth && endMonth >= startMonth)
        ? null
        : t('savings.endInvalid'),
    target:
      !target.trim() || (targetAmount !== null && targetAmount > 0)
        ? null
        : t('target.amountInvalid'),
    saveDay: Number.isInteger(day) && day >= 1 && day <= 31 ? null : t('savings.dayInvalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  // 自动算出来的总目标（每月 × 月数），填在提示里
  const autoTarget =
    monthlyAmount && startMonth && endMonth
      ? planTarget({
          id: '',
          currency,
          monthlyAmount,
          startMonth,
          endMonth,
          targetAmount: null,
          saveDay: 1,
          pauses: [],
        })
      : null;

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<SavingPlan> = {
      name: name.trim(),
      currency,
      monthlyAmount: monthlyAmount!,
      startMonth: startMonth!,
      endMonth,
      targetAmount: longTerm ? null : targetAmount,
      saveDay: day,
      accountId: accountId === NO_ACCOUNT ? null : accountId,
      pauses: existing?.pauses ?? [],
      remind,
      note: note.trim(),
    };
    try {
      if (isNew) {
        const created = await repos.saving_plans.create(data);
        router.replace({ pathname: '/savings/[id]', params: { id: created.id } });
      } else {
        await repos.saving_plans.update(params.id, data);
        router.back();
      }
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  if (!loaded) return null;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'savings.newPlan' : 'savings.editPlan') }} />
      <Section>
        <Field label={t('savings.name')} error={err('name')}>
          <Input value={name} onChangeText={setName} placeholder={t('savings.namePlaceholder')} />
        </Field>
        <Field label={t('target.currency')}>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
            value={currency}
            onChange={setCurrency}
          />
        </Field>
        <Field label={t('savings.monthly')} error={err('monthly')}>
          <Input
            value={monthly}
            onChangeText={setMonthly}
            keyboardType="decimal-pad"
            placeholder="700"
          />
        </Field>
        <Field label={t('savings.start')} error={err('start')} hint={t('savings.startHint')}>
          <MonthInput
            year={startY}
            month={startM}
            onChangeYear={setStartY}
            onChangeMonth={setStartM}
            label={t('savings.start')}
          />
        </Field>
        <Field label={t('savings.end')} error={err('end')}>
          <Segmented
            options={[
              { value: 'end', label: t('savings.hasEnd') },
              { value: 'long', label: t('savings.longTerm') },
            ]}
            value={longTerm ? 'long' : 'end'}
            onChange={(v) => setLongTerm(v === 'long')}
          />
          {!longTerm && (
            <MonthInput
              year={endY}
              month={endM}
              onChangeYear={setEndY}
              onChangeMonth={setEndM}
              label={t('savings.end')}
            />
          )}
        </Field>
        {!longTerm && (
          <Field
            label={t('savings.target')}
            error={err('target')}
            hint={
              autoTarget !== null
                ? t('savings.targetHint', { amount: formatMoney(autoTarget, currency) })
                : undefined
            }>
            <Input
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              placeholder={autoTarget !== null ? moneyToInput(autoTarget, currency) : ''}
            />
          </Field>
        )}
        <Field label={t('savings.saveDay')} error={err('saveDay')} hint={t('savings.saveDayHint')}>
          <Input
            value={saveDay}
            onChangeText={(v) => setSaveDay(v.replace(/\D/g, '').slice(0, 2))}
            accessibilityLabel={t('savings.saveDay')}
            keyboardType="number-pad"
            style={{ width: 80, textAlign: 'center' }}
          />
        </Field>
        <Field label={t('savings.account')}>
          <Segmented
            options={[
              { value: NO_ACCOUNT, label: t('savings.noAccount') },
              ...(accounts ?? []).map((a) => ({ value: a.id, label: accountLabel(a) })),
            ]}
            value={accountId}
            onChange={setAccountId}
          />
          <Pressable onPress={() => newAccount(currency)} accessibilityRole="button">
            <Text style={styles.addAccount}>{t('savings.addAccount')}</Text>
          </Pressable>
          {accounts && accounts.length === 0 && (
            <EmptyText>{t('savings.noAccountsHint')}</EmptyText>
          )}
        </Field>
        <Field label={t('reminder.label')}>
          <Segmented
            options={[
              { value: 'on', label: t('savings.remindOn') },
              { value: 'off', label: t('reminder.none') },
            ]}
            value={remind ? 'on' : 'off'}
            onChange={(v) => setRemind(v === 'on')}
          />
        </Field>
        <Field label={t('savings.note')}>
          <Input
            value={note}
            onChangeText={setNote}
            multiline
            placeholder={t('savings.notePlaceholder')}
          />
        </Field>
      </Section>
      <Button title={t('common.save')} onPress={save} />
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  addAccount: { fontSize: 14, color: colors.primary, paddingVertical: 4 },
}));
