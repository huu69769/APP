import { useTranslation } from 'react-i18next';

import {
  ANNIVERSARY_REMINDER_OPTIONS,
  TASK_REMINDER_OPTIONS,
  TIMED_REMINDER_OPTIONS,
} from '@/lib/reminders';
import { notificationsSupported, requestPermission } from '@/notifications';

import { EmptyText, Field, Segmented } from './form';
import { useToast } from './Toast';

const LABELS: Record<string, string> = {
  none: 'reminder.none',
  '0': 'reminder.atTime',
  '30': 'reminder.m30',
  '60': 'reminder.h1',
  '1440': 'reminder.d1',
};
const TASK_LABELS: Record<string, string> = {
  none: 'reminder.none',
  '0': 'reminder.taskDay',
  '1440': 'reminder.taskD1',
  '4320': 'reminder.taskD3',
};
const ANNIV_LABELS: Record<string, string> = {
  none: 'reminder.none',
  '0': 'reminder.annivDay',
  '1': 'reminder.annivD1',
  '3': 'reminder.annivD3',
  '7': 'reminder.annivD7',
};

/**
 * 「提醒」选择。第一次选了提醒时申请通知权限（Android 13 及以上）。
 */
export function ReminderSelect({
  value,
  onChange,
  kind = 'timed',
  hint,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  /** timed：班次 / 日程（分钟）；task：项目 DDL（分钟）；anniversary：纪念日（天） */
  kind?: 'timed' | 'task' | 'anniversary';
  hint?: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const options: readonly (number | null)[] =
    kind === 'task'
      ? TASK_REMINDER_OPTIONS
      : kind === 'anniversary'
        ? ANNIVERSARY_REMINDER_OPTIONS
        : TIMED_REMINDER_OPTIONS;
  const labels = kind === 'task' ? TASK_LABELS : kind === 'anniversary' ? ANNIV_LABELS : LABELS;

  const select = async (key: string) => {
    const v = key === 'none' ? null : Number(key);
    onChange(v);
    if (v !== null && notificationsSupported) {
      const ok = await requestPermission();
      if (!ok) toast(t('reminder.denied'));
    }
  };

  return (
    <Field label={t('reminder.label')}>
      <Segmented
        options={options.map((o) => ({
          value: o === null ? 'none' : String(o),
          label: t(labels[o === null ? 'none' : String(o)]),
        }))}
        value={value === null ? 'none' : String(value)}
        onChange={select}
      />
      {!notificationsSupported && <EmptyText>{t('reminder.webHint')}</EmptyText>}
      {notificationsSupported && hint ? <EmptyText>{hint}</EmptyText> : null}
    </Field>
  );
}
