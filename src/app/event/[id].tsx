import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { confirmAsync, showMessage } from '@/components/confirm';
import {
  Button,
  ColorPicker,
  EmptyText,
  Field,
  FormScreen,
  Input,
  Section,
  Segmented,
} from '@/components/form';
import { DatePicker, TimePicker } from '@/components/pickers/TimePicker';
import { ReminderSelect } from '@/components/ReminderSelect';
import { useData } from '@/data/DataProvider';
import type { CalendarEvent, NewEntity } from '@/data/types';
import { isValidLocalDate, today } from '@/lib/date';
import { isValidTime } from '@/lib/time';
import { makeStyles, JOB_COLORS } from '@/theme';

/**
 * 日程：新建（id = "new"，参数 date）或编辑。
 * 日程不影响空闲时间的统计（日程就是用空闲时间安排的事，PRD 5.4）。
 */
export default function EventEditScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string; startTime?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(
    params.date && isValidLocalDate(params.date) ? params.date : today()
  );
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState(
    params.startTime && isValidTime(params.startTime) ? params.startTime : ''
  );
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState<string>(JOB_COLORS[5]);
  const [note, setNote] = useState('');
  const [reminder, setReminder] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repos.events.get(params.id).then((e) => {
      if (!e) setMissing(true);
      else {
        setTitle(e.title);
        setDate(e.date);
        setAllDay(e.allDay);
        setStartTime(e.startTime ?? '');
        setEndTime(e.endTime ?? '');
        setColor(e.color);
        setNote(e.note);
        setReminder(e.reminderMinutesBefore);
      }
      setLoaded(true);
    });
  }, [isNew, params.id, repos]);

  const errors = {
    title: title.trim() ? null : t('errors.nameRequired'),
    date: isValidLocalDate(date) ? null : t('errors.dateInvalid'),
    time:
      allDay ||
      (isValidTime(startTime) &&
        // 结束时间比开始早 = 到第二天（比如 18:00–00:00、22:00–02:00）
        (endTime === '' || (isValidTime(endTime) && endTime !== startTime)))
        ? null
        : t('errors.timeInvalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<CalendarEvent> = {
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay || !endTime ? null : endTime,
      color,
      note: note.trim(),
      reminderMinutesBefore: reminder,
    };
    try {
      if (isNew) await repos.events.create(data);
      else await repos.events.update(params.id, data);
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('event.deleteTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.events.remove(params.id);
    router.back();
  };

  if (missing) {
    return (
      <FormScreen>
        <EmptyText>{t('errors.notFound')}</EmptyText>
      </FormScreen>
    );
  }
  if (!loaded) return null;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'event.newTitle' : 'event.editTitle') }} />
      <Section>
        <Field label={t('event.title')} error={err('title')}>
          <Input value={title} onChangeText={setTitle} placeholder={t('event.titlePlaceholder')} />
        </Field>
        <Field label={t('event.date')} error={err('date')}>
          <DatePicker value={date} onChange={setDate} accessibilityLabel={t('event.date')} />
        </Field>
        <Field label={t('event.time')} error={err('time')}>
          <Segmented
            options={[
              { value: 'timed', label: t('event.timed') },
              { value: 'allDay', label: t('event.allDay') },
            ]}
            value={allDay ? 'allDay' : 'timed'}
            onChange={(v) => setAllDay(v === 'allDay')}
          />
          {!allDay && (
            <View style={styles.row}>
              <TimePicker
                value={startTime}
                onChange={setStartTime}
                placeholder={t('shift.startTime')}
                accessibilityLabel={t('shift.startTime')}
              />
              <Text style={styles.dash}>–</Text>
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                placeholder={t('event.endOptional')}
                accessibilityLabel={t('event.endOptional')}
              />
            </View>
          )}
        </Field>
        <Field label={t('event.color')}>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <ReminderSelect
          value={reminder}
          onChange={setReminder}
          hint={allDay ? t('reminder.allDayHint') : undefined}
        />
        <Field label={t('event.note')}>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder={t('shift.notePlaceholder')}
            multiline
          />
        </Field>
      </Section>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dash: { color: colors.textMuted },
}));
