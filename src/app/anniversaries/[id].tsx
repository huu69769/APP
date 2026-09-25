import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { anniversaryStatusText } from '@/components/anniversaryText';
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
import { DatePicker } from '@/components/pickers/TimePicker';
import { ReminderSelect } from '@/components/ReminderSelect';
import { useData } from '@/data/DataProvider';
import type { Anniversary, NewEntity } from '@/data/types';
import { anniversaryStatus } from '@/lib/anniversary';
import { isValidLocalDate, today } from '@/lib/date';
import { lunarInfo } from '@/lib/lunar';
import { JOB_COLORS } from '@/theme';

type RepeatMode = 'solar' | 'lunar' | 'none';

/** 纪念日：新建（id = "new"，参数 date）或编辑 */
export default function AnniversaryEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(
    params.date && isValidLocalDate(params.date) ? params.date : today()
  );
  const [repeat, setRepeat] = useState<RepeatMode>('solar');
  const [color, setColor] = useState<string>(JOB_COLORS[0]);
  const [pinned, setPinned] = useState(false);
  const [reminder, setReminder] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repos.anniversaries.get(params.id).then((a) => {
      if (!a) setMissing(true);
      else {
        setTitle(a.title);
        setDate(a.date);
        setRepeat(!a.repeat ? 'none' : a.lunar ? 'lunar' : 'solar');
        setColor(a.color);
        setPinned(a.pinned);
        setReminder(a.reminderDaysBefore);
        setNote(a.note);
      }
      setLoaded(true);
    });
  }, [isNew, params.id, repos]);

  const errors = {
    title: title.trim() ? null : t('errors.nameRequired'),
    date: isValidLocalDate(date) ? null : t('errors.dateInvalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<Anniversary> = {
      title: title.trim(),
      date,
      repeat: repeat !== 'none',
      lunar: repeat === 'lunar',
      color,
      pinned,
      reminderDaysBefore: reminder,
      note: note.trim(),
    };
    try {
      if (isNew) await repos.anniversaries.create(data);
      else await repos.anniversaries.update(params.id, data);
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('anniv.deleteTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.anniversaries.remove(params.id);
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

  const valid = isValidLocalDate(date);
  const status = valid
    ? anniversaryStatus({ date, repeat: repeat !== 'none', lunar: repeat === 'lunar' }, today())
    : null;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'anniv.newTitle' : 'anniv.editTitle') }} />
      <Section>
        <Field label={t('anniv.name')} error={err('title')}>
          <Input value={title} onChangeText={setTitle} placeholder={t('anniv.namePlaceholder')} />
        </Field>
        <Field label={t('anniv.date')} error={err('date')}>
          <DatePicker value={date} onChange={setDate} accessibilityLabel={t('anniv.date')} />
          {status && <EmptyText>{anniversaryStatusText(t, status)}</EmptyText>}
        </Field>
        <Field label={t('anniv.repeat')}>
          <Segmented
            options={[
              { value: 'solar', label: t('anniv.repeatSolar') },
              { value: 'lunar', label: t('anniv.repeatLunar') },
              { value: 'none', label: t('anniv.repeatNone') },
            ]}
            value={repeat}
            onChange={setRepeat}
          />
          {repeat === 'lunar' && valid && (
            <EmptyText>
              {t('anniv.lunarHint', { date: lunarInfo(date).date.replace('闰', '') })}
            </EmptyText>
          )}
        </Field>
        <Field label={t('anniv.color')}>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label={t('anniv.pin')}>
          <Segmented
            options={[
              { value: 'on', label: t('anniv.pinOn') },
              { value: 'off', label: t('anniv.pinOff') },
            ]}
            value={pinned ? 'on' : 'off'}
            onChange={(v) => setPinned(v === 'on')}
          />
          <EmptyText>{t('anniv.pinHint')}</EmptyText>
        </Field>
        <ReminderSelect value={reminder} onChange={setReminder} kind="anniversary" />
        <Field label={t('anniv.note')}>
          <Input value={note} onChangeText={setNote} multiline />
        </Field>
      </Section>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
