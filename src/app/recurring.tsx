import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { showMessage } from '@/components/confirm';
import {
  Button,
  EmptyText,
  Field,
  FormScreen,
  MultiSelect,
  Section,
  Segmented,
} from '@/components/form';
import { DatePicker } from '@/components/pickers/TimePicker';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import { applyPendingToDates, applyTemplateToDates } from '@/data/shifts';
import { isActiveJob, jobPayType } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { orderedWeekdays } from '@/lib/calendar';
import { isValidLocalDate, today as getToday } from '@/lib/date';
import { datesByWeekdays, endOfNextMonth } from '@/lib/week';
import { makeStyles } from '@/theme';

const PENDING = 'pending';

/**
 * 按星期排班：固定的排班（比如周一到周五 9:00–15:00），选好星期和期间，一次录入。
 * 生成的是普通班次，之后可以单独修改、删除。已经有同样班次的日子会跳过。
 */
export default function RecurringScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const { repos, settings } = useData();
  const toast = useToast();
  const today = getToday();

  const { data } = useQuery(async (r) => {
    const [jobs, templates] = await Promise.all([r.jobs.list(), r.shift_templates.list()]);
    return {
      jobs: jobs
        .filter((j) => isActiveJob(j) && jobPayType(j) === 'hourly')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      templates: templates.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  }, []);

  const [jobId, setJobId] = useState(params.jobId ?? '');
  const [templateId, setTemplateId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(endOfNextMonth(today));
  const [saving, setSaving] = useState(false);

  // 默认选第一份工作、它的第一个时间段
  const job = data?.jobs.find((j) => j.id === jobId) ?? data?.jobs[0];
  const templates = data?.templates.filter((x) => x.jobId === job?.id) ?? [];
  const template = templates.find((x) => x.id === templateId);
  useEffect(() => {
    if (job && !templates.some((x) => x.id === templateId) && templateId !== PENDING) {
      setTemplateId(templates[0]?.id ?? PENDING);
    }
  }, [job, templates, templateId]);

  if (!data) return null;
  if (!job) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: t('recurring.title') }} />
        <EmptyText>{t('recurring.noJobs')}</EmptyText>
      </FormScreen>
    );
  }

  const rangeValid = isValidLocalDate(from) && isValidLocalDate(to) && from <= to;
  const dates = rangeValid ? datesByWeekdays(from, to, weekdays) : [];
  const weekdayNames = t('calendar.weekdaysShort', { returnObjects: true }) as string[];

  const apply = async () => {
    if (!dates.length || saving) return;
    setSaving(true);
    try {
      const { created, skipped } =
        templateId === PENDING || !template
          ? await applyPendingToDates(repos, job, dates)
          : await applyTemplateToDates(repos, template, dates);
      router.back();
      toast(
        skipped.length
          ? t('batch.doneSkipped', { count: created.length, skipped: skipped.length })
          : t('batch.done', { count: created.length }),
        {
          onUndo: created.length
            ? async () => {
                for (const s of created) await repos.shifts.remove(s.id);
              }
            : undefined,
        }
      );
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
      setSaving(false);
    }
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('recurring.title') }} />
      <EmptyText>{t('recurring.hint')}</EmptyText>
      <Section>
        <Field label={t('recurring.job')}>
          <Segmented
            options={data.jobs.map((j) => ({ value: j.id, label: j.name }))}
            value={job.id}
            onChange={(v) => {
              setJobId(v);
              setTemplateId('');
            }}
          />
        </Field>
        <Field label={t('recurring.template')}>
          <Segmented
            options={[
              ...templates.map((x) => ({
                value: x.id,
                label: `${x.name} ${x.startTime}–${x.endTime}`,
              })),
              { value: PENDING, label: t('recurring.pending') },
            ]}
            value={templateId || PENDING}
            onChange={setTemplateId}
          />
          {templates.length === 0 && <EmptyText>{t('recurring.noTemplates')}</EmptyText>}
        </Field>
        <Field label={t('recurring.weekdays')}>
          <MultiSelect
            options={orderedWeekdays(settings.weekStart).map((wd) => ({
              value: wd,
              label: weekdayNames[wd],
            }))}
            values={weekdays}
            onChange={setWeekdays}
          />
        </Field>
        <Field
          label={t('recurring.period')}
          error={rangeValid ? null : t('recurring.periodInvalid')}>
          <View style={styles.period}>
            <Text style={styles.periodLabel}>{t('recurring.from')}</Text>
            <DatePicker value={from} onChange={setFrom} accessibilityLabel={t('recurring.from')} />
          </View>
          <View style={styles.period}>
            <Text style={styles.periodLabel}>{t('recurring.to')}</Text>
            <DatePicker value={to} onChange={setTo} accessibilityLabel={t('recurring.to')} />
          </View>
        </Field>
      </Section>
      <Button
        title={t('recurring.apply', { count: dates.length })}
        onPress={apply}
        disabled={dates.length === 0 || saving}
      />
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  period: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodLabel: { width: 48, fontSize: 14, color: colors.textMuted },
}));
