import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { CURRENCIES, type Currency } from '@/data/types';
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money';
import type { MoneyByCurrency } from '@/lib/stats';
import { targetProgress, type IncomeTarget } from '@/lib/target';
import { makeStyles } from '@/theme';

import { Button, Field, Input, Segmented } from './form';

type Wage = { completed: MoneyByCurrency; total: MoneyByCurrency };

/** 进度条：深色 = 已赚，浅色 = 已排班还没上 */
function ProgressBar({
  earned,
  expected,
  thin,
}: {
  earned: number;
  expected: number;
  thin?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.track, thin && styles.trackThin]}>
      <View style={[styles.expected, { width: `${expected * 100}%` }]} />
      <View style={[styles.earned, { width: `${earned * 100}%` }]} />
    </View>
  );
}

/** 统计页的目标卡片；没设目标时只显示一行「设置收入目标」 */
export function TargetCard({
  title,
  target,
  wage,
  onEdit,
}: {
  title: string;
  target: IncomeTarget | null;
  wage: Wage | undefined;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (!target) {
    return (
      <Pressable onPress={onEdit} accessibilityRole="button" style={styles.card}>
        <Text style={styles.setText}>＋ {t('target.set', { what: title })}</Text>
      </Pressable>
    );
  }
  const p = wage ? targetProgress(target, wage) : null;
  const money = (v: number) => formatMoney(v, target.currency);
  return (
    <Pressable onPress={onEdit} accessibilityRole="button" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.amount}>{money(target.amount)} ✏️</Text>
      </View>
      {p && (
        <>
          <ProgressBar earned={p.earnedRatio} expected={p.expectedRatio} />
          <Text style={styles.detail}>
            {t('target.earned', { amount: money(p.earned) })} ·{' '}
            {t('target.expected', { amount: money(p.expected) })}
          </Text>
          <Text style={styles.status}>
            {p.remaining === 0
              ? t('target.reached', { percent: p.percent })
              : t('target.remaining', { percent: p.percent, amount: money(p.remaining) })}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** 首页统计栏下面的细进度条（只有设了月目标才显示） */
export function TargetBar({
  target,
  wage,
  onPress,
}: {
  target: IncomeTarget;
  wage: Wage | undefined;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  if (!wage) return null;
  const p = targetProgress(target, wage);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('target.a11y', { percent: p.percent })}
      style={styles.bar}>
      <View style={styles.barTrack}>
        <ProgressBar earned={p.earnedRatio} expected={p.expectedRatio} thin />
      </View>
      <Text style={styles.barText}>{p.percent}%</Text>
    </Pressable>
  );
}

/** 设置目标：金额 + 币种；「不设目标」清除 */
export function TargetEditor({
  visible,
  title,
  value,
  defaultCurrency,
  hint,
  onSave,
  onClose,
}: {
  hint?: string;
  visible: boolean;
  title: string;
  value: IncomeTarget | null;
  defaultCurrency: Currency;
  onSave: (target: IncomeTarget | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [currency, setCurrency] = useState<Currency>(value?.currency ?? defaultCurrency);
  const [text, setText] = useState(value ? moneyToInput(value.amount, value.currency) : '');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrency(value?.currency ?? defaultCurrency);
    setText(value ? moneyToInput(value.amount, value.currency) : '');
    setError(false);
  }, [visible, value, defaultCurrency]);

  const save = () => {
    const amount = parseMoney(text, currency);
    if (amount === null || amount <= 0) {
      setError(true);
      return;
    }
    onSave({ amount, currency });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Field label={t('target.currency')}>
            <Segmented
              options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
              value={currency}
              onChange={setCurrency}
            />
          </Field>
          <Field label={t('target.amount')} error={error ? t('target.amountInvalid') : null}>
            <Input
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={currency === 'JPY' ? '50000' : '5000'}
            />
          </Field>
          <Text style={styles.hint}>{t('target.currencyHint')}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Button title={t('common.save')} onPress={save} />
          {value && (
            <Button
              variant="secondary"
              title={t('target.clear')}
              onPress={() => {
                onSave(null);
                onClose();
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  setText: { fontSize: 15, color: colors.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  amount: { fontSize: 15, color: colors.text },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  trackThin: { height: 5, borderRadius: 3, backgroundColor: colors.border },
  expected: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.selectedBg,
  },
  earned: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  detail: { fontSize: 13, color: colors.textMuted },
  status: { fontSize: 14, color: colors.text, fontWeight: '600' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
  },
  barTrack: { flex: 1 },
  barText: { fontSize: 11, color: colors.textMuted, minWidth: 30, textAlign: 'right' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted },
}));
