import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

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
import { anniversaryStatus, lunarToSolar, solarToLunar } from '@/lib/anniversary';
import { isValidLocalDate, today } from '@/lib/date';
import { lunarInfo } from '@/lib/lunar';
import { JOB_COLORS, makeStyles } from '@/theme';

type RepeatMode = 'solar' | 'lunar' | 'none';

/** 纪念日：新建（id = "new"，参数 date）或编辑 */
export default function AnniversaryEditScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(
    params.date && isValidLocalDate(params.date) ? params.date : today()
  );
  const [repeat, setRepeat] = useState<RepeatMode>('solar');
  // 农历：直接输入农历的年、月、日（农历生日大家记的是农历日期）
  const [lunarY, setLunarY] = useState('');
  const [lunarM, setLunarM] = useState('');
  const [lunarD, setLunarD] = useState('');
  const setLunarFrom = (solar: string) => {
    if (!isValidLocalDate(solar)) return;
    const l = solarToLunar(solar);
    setLunarY(String(l.year));
    setLunarM(String(l.month));
    setLunarD(String(l.day));
  };
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
        if (a.lunar) setLunarFrom(a.date);
        setColor(a.color);
        setPinned(a.pinned);
        setReminder(a.reminderDaysBefore);
        setNote(a.note);
      }
      setLoaded(true);
    });
  }, [isNew, params.id, repos]);

  const isLunar = repeat === 'lunar';
  // 实际保存的公历日期（农历模式下由农历年月日换算）
  const effectiveDate = isLunar
    ? lunarToSolar(Number(lunarY), Number(lunarM), Number(lunarD))
    : isValidLocalDate(date)
      ? date
      : null;

  const changeRepeat = (next: RepeatMode) => {
    if (next === 'lunar' && !isLunar) setLunarFrom(date);
    if (next !== 'lunar' && isLunar && effectiveDate) setDate(effectiveDate);
    setRepeat(next);
  };

  const errors = {
    title: title.trim() ? null : t('errors.nameRequired'),
    date: effectiveDate ? null : t(isLunar ? 'anniv.lunarInvalid' : 'errors.dateInvalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<Anniversary> = {
      title: title.trim(),
      date: effectiveDate!,
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

  const status = effectiveDate
    ? anniversaryStatus({ date: effectiveDate, repeat: repeat !== 'none', lunar: isLunar }, today())
    : null;
  const numberInput = (
    value: string,
    onChange: (v: string) => void,
    width: number,
    label: string
  ) => (
    <Input
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
      keyboardType="number-pad"
      accessibilityLabel={label}
      style={{ width, textAlign: 'center' }}
    />
  );

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'anniv.newTitle' : 'anniv.editTitle') }} />
      <Section>
        <Field label={t('anniv.name')} error={err('title')}>
          <Input value={title} onChangeText={setTitle} placeholder={t('anniv.namePlaceholder')} />
        </Field>
        <Field label={t('anniv.repeat')}>
          <Segmented
            options={[
              { value: 'solar', label: t('anniv.repeatSolar') },
              { value: 'lunar', label: t('anniv.repeatLunar') },
              { value: 'none', label: t('anniv.repeatNone') },
            ]}
            value={repeat}
            onChange={changeRepeat}
          />
        </Field>
        <Field label={t(isLunar ? 'anniv.lunarDate' : 'anniv.date')} error={err('date')}>
          {isLunar ? (
            <View style={styles.lunarRow}>
              {numberInput(lunarY, setLunarY, 76, t('anniv.lunarYear'))}
              <Text style={styles.unit}>{t('anniv.lunarYear')}</Text>
              {numberInput(lunarM, setLunarM, 52, t('anniv.lunarMonth'))}
              <Text style={styles.unit}>{t('anniv.lunarMonth')}</Text>
              {numberInput(lunarD, setLunarD, 52, t('anniv.lunarDay'))}
              <Text style={styles.unit}>{t('anniv.lunarDay')}</Text>
            </View>
          ) : (
            <DatePicker value={date} onChange={setDate} accessibilityLabel={t('anniv.date')} />
          )}
          {isLunar && effectiveDate && (
            <EmptyText>
              {t('anniv.lunarHint', {
                date: lunarInfo(effectiveDate).date.replace('闰', ''),
                solar: effectiveDate,
              })}
            </EmptyText>
          )}
          {status && <EmptyText>{anniversaryStatusText(t, status)}</EmptyText>}
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

const useStyles = makeStyles((colors) => ({
  lunarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: { fontSize: 15, color: colors.text },
}));
