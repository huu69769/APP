import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { Currency, MinorUnits } from '@/data/types';
import { formatDuration } from '@/i18n/format';
import { formatMoney } from '@/lib/money';
import { isOvernight, shiftWage, validateShift, workedMinutes, type ShiftTimes } from '@/lib/shift';
import { normalizeTime } from '@/lib/time';
import { colors } from '@/theme/colors';

import { Field, Input, TimeInput } from './form';

/** 开始 / 结束 / 休息 三个输入框的状态，以及校验结果 */
export function useShiftTimeState() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');

  const setAll = useCallback((v: { startTime: string; endTime: string; breakMinutes: number }) => {
    setStartTime(v.startTime);
    setEndTime(v.endTime);
    setBreakMinutes(String(v.breakMinutes));
  }, []);

  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const brk = /^\d+$/.test(breakMinutes) ? Number(breakMinutes) : null;

  let error: 'timeInvalid' | 'breakInvalid' | 'breakTooLong' | null = null;
  if (!start || !end) error = 'timeInvalid';
  else if (brk === null) error = 'breakInvalid';
  else {
    const code = validateShift({ startTime: start, endTime: end, breakMinutes: brk });
    if (code) error = code === 'invalidBreak' ? 'breakInvalid' : code === 'invalidTime' ? 'timeInvalid' : code;
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
}: {
  state: ShiftTimeState;
  showErrors: boolean;
  /** 传入时显示工钱预览 */
  wage?: { amount: MinorUnits; currency: Currency };
}) {
  const { t } = useTranslation();
  const v = state.validated;

  return (
    <>
      <View style={styles.row}>
        <Field label={t('shift.startTime')}>
          <TimeInput
            value={state.startTime}
            onChangeText={state.setStartTime}
            placeholder={t('shift.timePlaceholder')}
          />
        </Field>
        <Text style={styles.dash}>–</Text>
        <Field label={t('shift.endTime')}>
          <TimeInput
            value={state.endTime}
            onChangeText={state.setEndTime}
            placeholder={t('shift.timePlaceholder')}
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
                  amount: formatMoney(shiftWage({ ...v, wageSnapshot: wage.amount }), wage.currency),
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
