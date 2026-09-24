import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import {
  Button,
  ColorPicker,
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
import { buildTask, primaryTask } from '@/data/tasks';
import {
  CURRENCIES,
  jobPayType,
  type Currency,
  type Job,
  type PayType,
  type Task,
} from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatDuration } from '@/i18n/format';
import { isValidLocalDate, today } from '@/lib/date';
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money';
import { workedMinutes } from '@/lib/shift';
import { parseHoursInput } from '@/lib/time';
import { JOB_COLORS } from '@/theme/colors';

/**
 * 新建 / 编辑兼职（id = "new" 表示新建）。
 * - 时薪制：填时薪等，下面管理班次模板
 * - 按项目结算：这份兼职就是一个项目，直接在这里填报酬、截止日、交付状态
 *
 * 新建时可用参数：payType=piece（预选按项目结算）、due=YYYY-MM-DD（默认截止日）
 */
export default function JobEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; payType?: string; due?: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const { repos, settings } = useData();

  const [loaded, setLoaded] = useState(isNew);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [payType, setPayType] = useState<PayType>(
    isNew && params.payType === 'piece' ? 'piece' : 'hourly'
  );
  const [color, setColor] = useState<string>(JOB_COLORS[0]);
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [wage, setWage] = useState('');
  const [endOfMonth, setEndOfMonth] = useState(true);
  const [cutoff, setCutoff] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [showErrors, setShowErrors] = useState(false);

  // 按项目结算：这个项目的内容
  const [project, setProject] = useState<Task | null>(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(
    params.due && isValidLocalDate(params.due) ? params.due : today()
  );
  const [delivered, setDelivered] = useState(false);
  const [deliveredDate, setDeliveredDate] = useState(today());
  const [hours, setHours] = useState('');

  useEffect(() => {
    if (isNew) {
      // 新兼职默认用还没被用过的颜色，方便在月历上区分
      repos.jobs.list().then((jobs) => {
        const used = new Set(jobs.map((j) => j.color));
        const free = JOB_COLORS.find((c) => !used.has(c));
        if (free) setColor(free);
      });
      return;
    }
    (async () => {
      const job = await repos.jobs.get(id);
      if (!job) {
        setMissing(true);
      } else {
        setName(job.name);
        setPayType(jobPayType(job));
        setColor(job.color);
        setCurrency(job.currency);
        setWage(moneyToInput(job.hourlyWage, job.currency));
        setEndOfMonth(job.cutoffDay === null);
        setCutoff(job.cutoffDay === null ? '' : String(job.cutoffDay));
        setBreakMinutes(String(job.defaultBreakMinutes));
        const task = primaryTask(await repos.tasks.list(), id);
        if (task) {
          setProject(task);
          setAmount(moneyToInput(task.amount, task.currency));
          setCurrency(task.currency);
          setDueDate(task.dueDate);
          setDelivered(task.deliveredDate !== null);
          setDeliveredDate(task.deliveredDate ?? today());
          setHours(
            task.minutesSpent === null
              ? ''
              : String(Math.round((task.minutesSpent / 60) * 100) / 100)
          );
        }
      }
      setLoaded(true);
    })();
  }, [id, isNew, repos]);

  // 以前从当天页面额外加的项目（同一份兼职有多个项目时）
  const { data: otherProjects } = useQuery(
    async (r) => {
      if (isNew) return [];
      const all = (await r.tasks.list()).filter((task) => task.jobId === id);
      const primary = primaryTask(all, id);
      return all
        .filter((task) => task.id !== primary?.id)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },
    [id, isNew]
  );

  const { data: templates } = useQuery(
    async (r) =>
      isNew
        ? []
        : (await r.shift_templates.list())
            .filter((tpl) => tpl.jobId === id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [id, isNew]
  );

  const isPiece = payType === 'piece';
  const wageValue = isPiece ? 0 : parseMoney(wage, currency);
  const cutoffValue = endOfMonth ? null : Number(cutoff);
  const breakValue = Number(breakMinutes);
  const amountValue = parseMoney(amount, currency);
  const minutesSpent = parseHoursInput(hours);
  const errors = {
    name: name.trim() ? null : t('errors.nameRequired'),
    wage: wageValue === null ? t('errors.wageInvalid') : null,
    cutoff:
      isPiece || endOfMonth || (/^\d{1,2}$/.test(cutoff) && cutoffValue! >= 1 && cutoffValue! <= 31)
        ? null
        : t('errors.cutoffInvalid'),
    break: isPiece || /^\d+$/.test(breakMinutes) ? null : t('errors.breakInvalid'),
    amount: !isPiece || amountValue !== null ? null : t('errors.wageInvalid'),
    dueDate: !isPiece || isValidLocalDate(dueDate) ? null : t('errors.dateInvalid'),
    deliveredDate:
      !isPiece || !delivered || isValidLocalDate(deliveredDate) ? null : t('errors.dateInvalid'),
    hours: !isPiece || minutesSpent !== undefined ? null : t('errors.hoursInvalid'),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = async () => {
    setShowErrors(true);
    if (hasErrors) return;
    const data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      name: name.trim(),
      payType,
      color,
      currency,
      hourlyWage: wageValue!,
      cutoffDay: isPiece ? null : cutoffValue,
      defaultBreakMinutes: isPiece ? 0 : breakValue,
    };
    const projectData = {
      title: name.trim(),
      dueDate,
      amount: amountValue ?? 0,
      currency,
      deliveredDate: delivered ? deliveredDate : null,
      minutesSpent: minutesSpent ?? null,
    };
    try {
      const job = isNew ? await repos.jobs.create(data) : await repos.jobs.update(id, data);
      if (isPiece) {
        if (project) await repos.tasks.update(project.id, projectData);
        else await repos.tasks.create(buildTask(job, projectData));
      }
      if (isNew && !isPiece) {
        // 时薪制：新建后留在编辑页，方便马上添加班次模板
        router.replace({ pathname: '/jobs/[id]', params: { id: job.id } });
      } else {
        router.back();
      }
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t(isPiece ? 'jobs.deleteProjectTitle' : 'jobs.deleteTitle'),
      message: t(isPiece ? 'jobs.deleteProjectMessage' : 'jobs.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    for (const tpl of templates ?? []) await repos.shift_templates.remove(tpl.id);
    if (isPiece) {
      // 删除项目就不再计入统计
      for (const task of (await repos.tasks.list()).filter((x) => x.jobId === id)) {
        await repos.tasks.remove(task.id);
      }
    }
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
        <Field label={t('jobs.payType')} hint={isPiece ? t('jobs.pieceHint') : undefined}>
          <Segmented
            options={[
              { value: 'hourly', label: t('jobs.payHourly') },
              { value: 'piece', label: t('jobs.payPiece') },
            ]}
            value={payType}
            onChange={setPayType}
          />
        </Field>
        <Field label={t(isPiece ? 'task.title' : 'jobs.name')} error={err('name')}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t(isPiece ? 'task.titlePlaceholder' : 'jobs.namePlaceholder')}
          />
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

        {isPiece ? (
          <>
            <Field label={t('task.amount')} error={err('amount')}>
              <Input
                value={amount}
                onChangeText={setAmount}
                keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
                placeholder={currency === 'JPY' ? '10000' : '800.00'}
              />
            </Field>
            <Field label={t('task.dueDate')} error={err('dueDate')} hint={t('jobs.dueHint')}>
              <DateInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder={t('task.datePlaceholder')}
              />
            </Field>
          </>
        ) : (
          <>
            <Field
              label={t('jobs.hourlyWage')}
              error={err('wage')}
              hint={isNew ? undefined : t('jobs.wageNote')}>
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
          </>
        )}
      </Section>

      {isPiece && (
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
        </Section>
      )}

      <Button title={t('common.save')} onPress={save} />

      {!isPiece && (
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
      )}

      {isPiece && otherProjects && otherProjects.length > 0 && (
        <Section title={t('jobs.otherProjects')}>
          {otherProjects.map((task) => (
            <ListRow
              key={task.id}
              color={color}
              title={`${task.deliveredDate ? '✓ ' : ''}${task.title}`}
              subtitle={`${t('day.taskDue')} ${task.dueDate}`}
              right={formatMoney(task.amount, task.currency)}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            />
          ))}
        </Section>
      )}

      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
