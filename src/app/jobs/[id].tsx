import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import {
  Button,
  ColorPicker,
  EmptyText,
  Field,
  FormScreen,
  Input,
  ListRow,
  Section,
  Segmented,
} from '@/components/form';
import { useData } from '@/data/DataProvider';
import { CURRENCIES, type Currency, type Job } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatDuration } from '@/i18n/format';
import { moneyToInput, parseMoney } from '@/lib/money';
import { workedMinutes } from '@/lib/shift';
import { JOB_COLORS } from '@/theme/colors';

/** 新建 / 编辑兼职（id = "new" 表示新建），下面列出这份兼职的班次模板 */
export default function JobEditScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { repos, settings } = useData();

  const [loaded, setLoaded] = useState(isNew);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(JOB_COLORS[0]);
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [wage, setWage] = useState('');
  const [endOfMonth, setEndOfMonth] = useState(true);
  const [cutoff, setCutoff] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repos.jobs.get(id).then((job) => {
      if (!job) {
        setMissing(true);
      } else {
        setName(job.name);
        setColor(job.color);
        setCurrency(job.currency);
        setWage(moneyToInput(job.hourlyWage, job.currency));
        setEndOfMonth(job.cutoffDay === null);
        setCutoff(job.cutoffDay === null ? '' : String(job.cutoffDay));
        setBreakMinutes(String(job.defaultBreakMinutes));
      }
      setLoaded(true);
    });
  }, [id, isNew, repos]);

  const { data: templates } = useQuery(
    async (r) =>
      isNew
        ? []
        : (await r.shift_templates.list())
            .filter((tpl) => tpl.jobId === id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [id, isNew]
  );

  const wageValue = parseMoney(wage, currency);
  const cutoffValue = endOfMonth ? null : Number(cutoff);
  const breakValue = Number(breakMinutes);
  const errors = {
    name: name.trim() ? null : t('errors.nameRequired'),
    wage: wageValue === null ? t('errors.wageInvalid') : null,
    cutoff:
      endOfMonth || (/^\d{1,2}$/.test(cutoff) && cutoffValue! >= 1 && cutoffValue! <= 31)
        ? null
        : t('errors.cutoffInvalid'),
    break: /^\d+$/.test(breakMinutes) ? null : t('errors.breakInvalid'),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = async () => {
    setShowErrors(true);
    if (hasErrors) return;
    const data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      name: name.trim(),
      color,
      currency,
      hourlyWage: wageValue!,
      cutoffDay: cutoffValue,
      defaultBreakMinutes: breakValue,
    };
    try {
      if (isNew) {
        const job = await repos.jobs.create(data);
        // 新建后留在编辑页，方便马上添加模板
        router.replace({ pathname: '/jobs/[id]', params: { id: job.id } });
      } else {
        await repos.jobs.update(id, data);
        router.back();
      }
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('jobs.deleteTitle'),
      message: t('jobs.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    for (const tpl of templates ?? []) await repos.shift_templates.remove(tpl.id);
    await repos.jobs.remove(id);
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

  const err = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'jobs.newTitle' : 'jobs.editTitle') }} />
      <Section>
        <Field label={t('jobs.name')} error={err('name')}>
          <Input value={name} onChangeText={setName} placeholder={t('jobs.namePlaceholder')} />
        </Field>
        <Field label={t('jobs.color')}>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label={t('jobs.currency')}>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
            value={currency}
            onChange={setCurrency}
          />
        </Field>
        <Field label={t('jobs.hourlyWage')} error={err('wage')} hint={isNew ? undefined : t('jobs.wageNote')}>
          <Input
            value={wage}
            onChangeText={setWage}
            keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
            placeholder={currency === 'JPY' ? '1200' : '25.00'}
          />
        </Field>
        <Field label={t('jobs.cutoffDay')} error={err('cutoff')} hint={t('jobs.cutoffHint')}>
          <Segmented
            options={[
              { value: 'end', label: t('jobs.cutoffEndOfMonth') },
              { value: 'day', label: t('jobs.cutoffValue', { day: cutoff || '…' }) },
            ]}
            value={endOfMonth ? 'end' : 'day'}
            onChange={(v) => setEndOfMonth(v === 'end')}
          />
          {!endOfMonth && (
            <Input
              value={cutoff}
              onChangeText={(v) => setCutoff(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder={t('jobs.cutoffPlaceholder')}
              style={{ width: 96 }}
            />
          )}
        </Field>
        <Field label={t('jobs.defaultBreak')} error={err('break')}>
          <Input
            value={breakMinutes}
            onChangeText={(v) => setBreakMinutes(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={{ width: 96 }}
          />
        </Field>
      </Section>

      <Button title={t('common.save')} onPress={save} />

      <Section
        title={t('jobs.templates')}
        right={
          isNew ? undefined : (
            <Button
              variant="secondary"
              title={t('jobs.addTemplate')}
              onPress={() =>
                router.push({ pathname: '/templates/[id]', params: { id: 'new', jobId: id } })
              }
            />
          )
        }>
        {isNew ? (
          <EmptyText>{t('jobs.saveFirst')}</EmptyText>
        ) : templates && templates.length === 0 ? (
          <EmptyText>{t('jobs.noTemplates')}</EmptyText>
        ) : (
          templates?.map((tpl) => (
            <ListRow
              key={tpl.id}
              color={color}
              title={tpl.name}
              subtitle={`${tpl.startTime} – ${tpl.endTime}`}
              right={formatDuration(t, workedMinutes(tpl))}
              onPress={() => router.push({ pathname: '/templates/[id]', params: { id: tpl.id } })}
            />
          ))
        )}
      </Section>

      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
