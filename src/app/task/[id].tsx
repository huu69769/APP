import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import {
  Button,
  EmptyText,
  Field,
  FormScreen,
  Input,
  ListRow,
  Section,
  Segmented,
} from '@/components/form';
import { DatePicker } from '@/components/pickers/TimePicker';
import { useData } from '@/data/DataProvider';
import { buildTask } from '@/data/tasks';
import { CURRENCIES, isActiveJob, jobPayType, type Currency, type Job } from '@/data/types';
import { isValidLocalDate } from '@/lib/date';
import { moneyToInput, parseMoney } from '@/lib/money';

/**
 * 项目（按项目结算的客户下面的一个案子）：新建或编辑。
 * 只需要填：项目名称、报酬、DDL、备注。收入算在 DDL 那天。
 *
 * 新建时的参数：date（默认 DDL）、jobId（默认选中的客户）
 */
export default function TaskEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; date?: string; jobId?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(
    params.date && isValidLocalDate(params.date) ? params.date : ''
  );
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('CNY');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const list = (await repos.jobs.list())
          .filter((j) => jobPayType(j) === 'piece' && isActiveJob(j))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setJobs(list);
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
  const errors = {
    title: title.trim() ? null : t('errors.titleRequired'),
    dueDate: isValidLocalDate(dueDate) ? null : t('errors.dateInvalid'),
    amount: amountValue === null ? t('errors.wageInvalid') : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean) || !job) return;
    const data = {
      title: title.trim(),
      dueDate,
      amount: amountValue!,
      currency,
      note: note.trim(),
    };
    try {
      if (isNew) await repos.tasks.create(buildTask(job, data));
      else await repos.tasks.update(params.id, data);
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
    // 还没有客户：直接去新建客户（同一页可以填第一个项目）
    return (
      <FormScreen>
        <Stack.Screen options={{ title: t('task.newTitle') }} />
        <Section>
          <EmptyText>{t('task.noPieceJobs')}</EmptyText>
        </Section>
        <Button
          title={t('task.addClient')}
          onPress={() =>
            router.replace({
              pathname: '/jobs/[id]',
              params: { id: 'new', payType: 'piece', ...(dueDate ? { due: dueDate } : {}) },
            })
          }
        />
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
        <Field label={t('task.dueDate')} error={err('dueDate')} hint={t('task.dueHint')}>
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder={t('task.datePlaceholder')}
            accessibilityLabel={t('task.dueDate')}
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
