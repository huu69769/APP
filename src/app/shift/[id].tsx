import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Input, ListRow, Section, Segmented } from '@/components/form';
import { ShiftTimeFields, useShiftTimeState } from '@/components/ShiftTimeFields';
import { useData } from '@/data/DataProvider';
import { buildPendingShift, buildShift } from '@/data/shifts';
import type { Job, Shift } from '@/data/types';
import { formatMoney } from '@/lib/money';

/**
 * 手动添加班次（id = "new"，参数 date），或编辑已有班次。
 * 编辑时可以改时间、休息、备注；兼职和时薪快照不变。
 */
export default function ShiftEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [shift, setShift] = useState<Shift | null>(null);
  const [date, setDate] = useState(params.date ?? '');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const times = useShiftTimeState();
  const { setAll, setBreakMinutes } = times;

  useEffect(() => {
    (async () => {
      if (isNew) {
        const list = (await repos.jobs.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setJobs(list);
        if (list[0]) {
          setJobId(list[0].id);
          setAll({ startTime: '', endTime: '', breakMinutes: list[0].defaultBreakMinutes });
        }
      } else {
        const s = await repos.shifts.get(params.id);
        if (!s) setMissing(true);
        else {
          setShift(s);
          setJobId(s.jobId);
          setDate(s.date);
          setNote(s.note);
          setAll(s);
          const job = (await repos.jobs.listWithDeleted()).find((j) => j.id === s.jobId);
          if (job) setJobs([job]);
        }
      }
      setLoaded(true);
    })();
  }, [isNew, params.id, repos, setAll]);

  const job = jobs.find((j) => j.id === jobId);
  const wage = shift
    ? { amount: shift.wageSnapshot, currency: shift.currencySnapshot }
    : job
      ? { amount: job.hourlyWage, currency: job.currency }
      : undefined;

  const selectJob = (id: string) => {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    if (j) setBreakMinutes(String(j.defaultBreakMinutes));
  };

  const save = async () => {
    setShowErrors(true);
    const value = times.validated;
    const pending = times.pending;
    if (!pending && !value) return;
    try {
      if (isNew) {
        if (!job) return;
        await repos.shifts.create(
          pending
            ? buildPendingShift(job, date, note.trim())
            : buildShift(job, { ...value!, date, note: note.trim() })
        );
      } else {
        await repos.shifts.update(
          params.id,
          pending
            ? { startTime: null, endTime: null, note: note.trim() }
            : { ...value!, note: note.trim() }
        );
      }
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('shift.deleteTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.shifts.remove(params.id);
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

  if (isNew && jobs.length === 0) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: t('shift.newTitle') }} />
        <Section>
          <EmptyText>{t('day.noJobs')}</EmptyText>
        </Section>
        <Button title={t('day.goJobs')} onPress={() => router.push('/jobs')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'shift.newTitle' : 'shift.editTitle') }} />
      <Section>
        <Field label={t('shift.job')}>
          {isNew ? (
            <Segmented
              options={jobs.map((j) => ({ value: j.id, label: j.name }))}
              value={jobId}
              onChange={selectJob}
            />
          ) : (
            <ListRow color={job?.color} title={job?.name ?? ''} />
          )}
        </Field>
        <Field label={t('shift.date')}>
          <ListRow title={date} />
        </Field>
        <ShiftTimeFields state={times} showErrors={showErrors} wage={wage} allowPending />
        {wage && (
          <EmptyText>{t('shift.wageSnapshot', { amount: formatMoney(wage.amount, wage.currency) })}</EmptyText>
        )}
        <Field label={t('shift.note')}>
          <Input value={note} onChangeText={setNote} placeholder={t('shift.notePlaceholder')} multiline />
        </Field>
      </Section>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
