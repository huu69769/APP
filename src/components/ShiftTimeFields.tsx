import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { Currency, MinorUnits } from '@/data/types';
import { formatDuration } from '@/i18n/format';
import { formatMoney } from '@/lib/money';
import { isOvernight, shiftWage, validateShift, workedMinutes, type ShiftTimes } from '@/lib/shift';
import { normalizeTime } from '@/lib/time';
import { colors } from '@/theme/colors';

import { EmptyText, Field, Input, Segmented } from './form';
import { TimePicker } from './pickers/TimePicker';

/** 开始 / 结束 / 休息 三个输入框的状态，以及校验结果 */
export function useShiftTimeState() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  /** 「时间待定」（只用于班次，模板没有这个选项） */
  const [pending, setPending] = useState(false);

  const setAll = useCallback(
    (v: { startTime: string | null; endTime: string | null; breakMinutes: number }) => {
      setStartTime(v.startTime ?? '');
      setEndTime(v.endTime ?? '');
      setBreakMinutes(String(v.breakMinutes));
      setPending(v.startTime === null || v.endTime === null);
    },
    []
  );

  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const brk = /^\d+$/.test(breakMinutes) ? Number(breakMinutes) : null;

  let error: 'timeInvalid' | 'breakInvalid' | 'breakTooLong' | null = null;
  if (!start || !end) error = 'timeInvalid';
  else if (brk === null) error = 'breakInvalid';
  else {
    const code = validateShift({ startTime: start, endTime: end, breakMinutes: brk });
    if (code)
      error =
        code === 'invalidBreak' ? 'breakInvalid' : code === 'invalidTime' ? 'timeInvalid' : code;
  }

  const validated: ShiftTimes | null =
    error === null ? { startTime: start!, endTime: end!, breakMinutes: brk! } : null;

  return {
    startTime,
    endTime,
    breakMinutes,
    setStartTime,
    setEndTime,
    setBreakMinutes,
    pending,
    setPending,
    setAll,
    error,
    validated,
  };
}

export type ShiftTimeState = ReturnType<typeof useShiftTimeState>;

export function ShiftTimeFields({
  state,
  showErrors,
  wage,
  allowPending,
}: {
  state: ShiftTimeState;
  showErrors: boolean;
  /** 显示「已定时间 / 时间待定」切换（班次用，模板不用） */
  allowPending?: boolean;
  /** 传入时显示工钱预览 */
  wage?: { amount: MinorUnits; currency: Currency };
}) {
  const { t } = useTranslation();
  const v = state.validated;
  const pending = allowPending && state.pending;

  return (
    <>
      {allowPending && (
        <Field label={t('shift.timeMode')}>
          <Segmented
            options={[
              { value: 'timed', label: t('shift.timed') },
              { value: 'pending', label: t('shift.pending') },
            ]}
            value={state.pending ? 'pending' : 'timed'}
            onChange={(x) => state.setPending(x === 'pending')}
          />
        </Field>
      )}
      {pending ? (
        <EmptyText>{t('shift.pendingHint')}</EmptyText>
      ) : (
        <TimeFields state={state} showErrors={showErrors} wage={wage} />
      )}
    </>
  );
}

function TimeFields({
  state,
  showErrors,
  wage,
}: {
  state: ShiftTimeState;
  showErrors: boolean;
  wage?: { amount: MinorUnits; currency: Currency };
}) {
  const { t } = useTranslation();
  const v = state.validated;

  return (
    <>
      <View style={styles.row}>
        <Field label={t('shift.startTime')}>
          <TimePicker
            value={state.startTime}
            onChange={state.setStartTime}
            placeholder={t('shift.timePlaceholder')}
            accessibilityLabel={t('shift.startTime')}
          />
        </Field>
        <Text style={styles.dash}>–</Text>
        <Field label={t('shift.endTime')}>
          <TimePicker
            value={state.endTime}
            onChange={state.setEndTime}
            placeholder={t('shift.timePlaceholder')}
            accessibilityLabel={t('shift.endTime')}
          />
        </Field>
        <Field label={t('shift.breakMinutes')}>
          <Input
            value={state.breakMinutes}
            onChangeText={(x) => state.setBreakMinutes(x.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={styles.break}
          />
        </Field>
      </View>
      {showErrors && state.error ? (
        <Text style={styles.error}>{t(`errors.${state.error}`)}</Text>
      ) : null}
      {v && (
        <View style={styles.summary}>
          {isOvernight(v.startTime, v.endTime) && (
            <Text style={styles.summaryText}>{t('shift.overnight', { time: v.endTime })}</Text>
          )}
          <Text style={styles.summaryText}>
            {wage
              ? t('shift.summary', {
                  duration: formatDuration(t, workedMinutes(v)),
                  amount: formatMoney(
                    shiftWage({ ...v, wageSnapshot: wage.amount }),
                    wage.currency
                  ),
                })
              : formatDuration(t, workedMinutes(v))}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  dash: { paddingBottom: 12, color: colors.textMuted },
  break: { width: 80, textAlign: 'center' },
  error: { fontSize: 12, color: colors.danger },
  summary: { gap: 2 },
  summaryText: { fontSize: 13, color: colors.textMuted },
});
