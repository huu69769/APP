import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import {
  Button,
  DateInput,
  EmptyText,
  Field,
  FormScreen,
  Input,
  ListRow,
  Section,
  Segmented,
} from '@/components/form';
import { useData } from '@/data/DataProvider';
import { buildTask } from '@/data/tasks';
import { CURRENCIES, jobPayType, type Currency, type Job, type Task } from '@/data/types';
import { isValidLocalDate, today } from '@/lib/date';
import { moneyToInput, parseMoney } from '@/lib/money';
import { parseHoursInput } from '@/lib/time';

/**
 * 按件计酬的任务：新建（id = "new"，参数 date 作为默认截止日）或编辑。
 */
export default function TaskEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string; jobId?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(params.date ?? today());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('CNY');
  const [delivered, setDelivered] = useState(false);
  const [deliveredDate, setDeliveredDate] = useState(today());
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const list = (await repos.jobs.list())
          .filter((j) => jobPayType(j) === 'piece')
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setJobs(list);
        // 从兼职页面进来时，默认选中那份兼职
        const initial = list.find((j) => j.id === params.jobId) ?? list[0];
        if (initial) {
          setJobId(initial.id);
          setCurrency(initial.currency);
        }
      } else {
        const task = await repos.tasks.get(params.id);
        if (!task) setMissing(true);
        else {
          setJobId(task.jobId);
          setTitle(task.title);
          setDueDate(task.dueDate);
          setAmount(moneyToInput(task.amount, task.currency));
          setCurrency(task.currency);
          setDelivered(task.deliveredDate !== null);
          setDeliveredDate(task.deliveredDate ?? today());
          setHours(
            task.minutesSpent === null
              ? ''
              : String(Math.round((task.minutesSpent / 60) * 100) / 100)
          );
          setNote(task.note);
          const job = (await repos.jobs.listWithDeleted()).find((j) => j.id === task.jobId);
          if (job) setJobs([job]);
        }
      }
      setLoaded(true);
    })();
  }, [isNew, params.id, params.jobId, repos]);

  const job = jobs.find((j) => j.id === jobId);
  const amountValue = parseMoney(amount, currency);
  const minutes = parseHoursInput(hours);
  const errors = {
    title: title.trim() ? null : t('errors.titleRequired'),
    dueDate: isValidLocalDate(dueDate) ? null : t('errors.dateInvalid'),
    amount: amountValue === null ? t('errors.wageInvalid') : null,
    deliveredDate: !delivered || isValidLocalDate(deliveredDate) ? null : t('errors.dateInvalid'),
    hours: minutes === undefined ? t('errors.hoursInvalid') : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean) || !job) return;
    const data: Partial<Task> = {
      title: title.trim(),
      dueDate,
      amount: amountValue!,
      currency,
      deliveredDate: delivered ? deliveredDate : null,
      minutesSpent: minutes ?? null,
      note: note.trim(),
    };
    try {
      if (isNew) {
        await repos.tasks.create(
          buildTask(job, { ...data, title: data.title!, dueDate, amount: amountValue! })
        );
      } else {
        await repos.tasks.update(params.id, data);
      }
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('task.deleteTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.tasks.remove(params.id);
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
        <Stack.Screen options={{ title: t('task.newTitle') }} />
        <Section>
          <EmptyText>{t('task.noPieceJobs')}</EmptyText>
        </Section>
        <Button title={t('day.goJobs')} onPress={() => router.push('/jobs')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'task.newTitle' : 'task.editTitle') }} />
      <Section>
        <Field label={t('task.job')}>
          {isNew ? (
            <Segmented
              options={jobs.map((j) => ({ value: j.id, label: j.name }))}
              value={jobId}
              onChange={(id) => {
                setJobId(id);
                const j = jobs.find((x) => x.id === id);
                if (j) setCurrency(j.currency);
              }}
            />
          ) : (
            <ListRow color={job?.color} title={job?.name ?? ''} />
          )}
        </Field>
        <Field label={t('task.title')} error={err('title')}>
          <Input value={title} onChangeText={setTitle} placeholder={t('task.titlePlaceholder')} />
        </Field>
        <Field label={t('task.dueDate')} error={err('dueDate')}>
          <DateInput
            value={dueDate}
            onChangeText={setDueDate}
            placeholder={t('task.datePlaceholder')}
          />
        </Field>
        <Field label={t('task.amount')} error={err('amount')}>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={currency}
            onChange={setCurrency}
          />
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
            placeholder={currency === 'JPY' ? '10000' : '800.00'}
          />
        </Field>
      </Section>

      <Section>
        <Field label={t('task.status')}>
          <Segmented
            options={[
              { value: 'open', label: t('task.open') },
              { value: 'delivered', label: t('task.delivered') },
            ]}
            value={delivered ? 'delivered' : 'open'}
            onChange={(v) => setDelivered(v === 'delivered')}
          />
        </Field>
        {delivered && (
          <Field
            label={t('task.deliveredDate')}
            error={err('deliveredDate')}
            hint={t('task.deliveredHint')}>
            <DateInput
              value={deliveredDate}
              onChangeText={setDeliveredDate}
              placeholder={t('task.datePlaceholder')}
            />
          </Field>
        )}
        <Field label={t('task.hours')} error={err('hours')} hint={t('task.hoursHint')}>
          <Input
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="2.5"
            style={{ width: 96 }}
          />
        </Field>
        <Field label={t('task.note')}>
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
