import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { DatePicker, TimePicker } from '@/components/pickers/TimePicker';
import { useData } from '@/data/DataProvider';
import { buildTask } from '@/data/tasks';
import { CURRENCIES, jobPayType, type Currency, type Job, type PayType } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatDuration } from '@/i18n/format';
import { isValidLocalDate, today } from '@/lib/date';
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money';
import { validateShift, workedMinutes } from '@/lib/shift';
import { makeStyles, JOB_COLORS } from '@/theme';

/** 新建时薪兼职时，直接填的时间段（保存时变成班次模板） */
interface SlotDraft {
  key: number;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
}

/**
 * 新建 / 编辑工作（id = "new" 表示新建）。
 * - 时薪：填时薪；新建时可以直接加时间段模板，编辑时管理模板
 * - 按项目结算：这里是客户；新建时可以直接填第一个项目，编辑时管理项目
 *
 * 新建时可用参数：payType=piece（预选按项目结算）、due=YYYY-MM-DD（第一个项目的默认 DDL）
 */
export default function JobEditScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; payType?: string; due?: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const { repos, settings } = useData();

  const [loaded, setLoaded] = useState(isNew);
  const [missing, setMissing] = useState(false);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [payType, setPayType] = useState<PayType>(
    isNew && params.payType === 'piece' ? 'piece' : 'hourly'
  );
  const [color, setColor] = useState<string>(JOB_COLORS[0]);
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [wage, setWage] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [endOfMonth, setEndOfMonth] = useState(true);
  const [cutoff, setCutoff] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [showErrors, setShowErrors] = useState(false);

  // 新建时薪兼职：时间段
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  // 新建客户：第一个项目
  const [projectTitle, setProjectTitle] = useState('');
  const [projectAmount, setProjectAmount] = useState('');
  const [projectDue, setProjectDue] = useState(
    params.due && isValidLocalDate(params.due) ? params.due : ''
  );

  useEffect(() => {
    if (isNew) {
      // 新工作默认用还没被用过的颜色，方便在月历上区分
      repos.jobs.list().then((jobs) => {
        const used = new Set(jobs.map((j) => j.color));
        const free = JOB_COLORS.find((c) => !used.has(c));
        if (free) setColor(free);
      });
      return;
    }
    repos.jobs.get(id).then((job) => {
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
        setMoreOpen(job.cutoffDay !== null || job.defaultBreakMinutes > 0);
        setEndedAt(job.endedAt ?? null);
      }
      setLoaded(true);
    });
  }, [id, isNew, repos]);

  const { data: related } = useQuery(
    async (r) => {
      if (isNew) return { templates: [], projects: [] };
      const [templates, tasks] = await Promise.all([r.shift_templates.list(), r.tasks.list()]);
      return {
        templates: templates
          .filter((tpl) => tpl.jobId === id)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        // DDL 新的在前
        projects: tasks
          .filter((task) => task.jobId === id)
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
      };
    },
    [id, isNew]
  );

  const isPiece = payType === 'piece';
  const wageValue = isPiece ? 0 : parseMoney(wage, currency);
  const cutoffValue = endOfMonth ? null : Number(cutoff);
  const breakValue = Number(breakMinutes);

  // 第一个项目：全部空着就不建；填了一部分就要求填完整
  const projectStarted =
    isNew && isPiece && !!(projectTitle.trim() || projectAmount.trim() || projectDue);
  const projectAmountValue = parseMoney(projectAmount, currency);

  // 时间段：两个时间都空的忽略；只填了一部分就报错
  const slotError = (s: SlotDraft) => {
    if (!s.startTime && !s.endTime) return null;
    if (!/^\d+$/.test(s.breakMinutes)) return t('errors.breakInvalid');
    const code = validateShift({
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: Number(s.breakMinutes),
    });
    if (code === 'breakTooLong') return t('errors.breakTooLong');
    if (code) return t('errors.timeInvalid');
    return null;
  };

  const errors = {
    name: name.trim() ? null : t('errors.nameRequired'),
    wage: wageValue === null ? t('errors.wageInvalid') : null,
    cutoff:
      endOfMonth || (/^\d{1,2}$/.test(cutoff) && cutoffValue! >= 1 && cutoffValue! <= 31)
        ? null
        : t('errors.cutoffInvalid'),
    break: isPiece || /^\d+$/.test(breakMinutes) ? null : t('errors.breakInvalid'),
    slots: !isNew || isPiece || slots.every((s) => !slotError(s)) ? null : 'slot',
    projectTitle: !projectStarted || projectTitle.trim() ? null : t('errors.titleRequired'),
    projectAmount: !projectStarted || projectAmountValue !== null ? null : t('errors.wageInvalid'),
    projectDue: !projectStarted || isValidLocalDate(projectDue) ? null : t('errors.dateInvalid'),
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const err = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const save = async () => {
    setShowErrors(true);
    if (hasErrors) return;
    const data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      name: name.trim(),
      payType,
      color,
      currency,
      hourlyWage: wageValue!,
      cutoffDay: cutoffValue,
      defaultBreakMinutes: isPiece ? 0 : breakValue,
      endedAt,
    };
    try {
      if (!isNew) {
        await repos.jobs.update(id, data);
        router.back();
        return;
      }
      const job = await repos.jobs.create(data);
      if (isPiece && projectStarted) {
        await repos.tasks.create(
          buildTask(job, {
            title: projectTitle.trim(),
            amount: projectAmountValue!,
            dueDate: projectDue,
          })
        );
      }
      if (!isPiece) {
        for (const s of slots) {
          if (!s.startTime && !s.endTime) continue;
          await repos.shift_templates.create({
            jobId: job.id,
            name: s.name.trim() || `${s.startTime}–${s.endTime}`,
            startTime: s.startTime,
            endTime: s.endTime,
            breakMinutes: Number(s.breakMinutes),
          });
        }
      }
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const setEnded = async (ended: boolean) => {
    if (ended) {
      const ok = await confirmAsync({
        title: t('jobs.endTitle'),
        message: t('jobs.endMessage'),
        confirmText: t('jobs.endAction'),
        cancelText: t('common.cancel'),
      });
      if (!ok) return;
    }
    await repos.jobs.update(id, { endedAt: ended ? today() : null });
    router.back();
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
    // 删除 = 加错了：它的所有记录都一起删掉（软删除），不再计入统计
    const [shifts, tasks, templates] = await Promise.all([
      repos.shifts.list(),
      repos.tasks.list(),
      repos.shift_templates.list(),
    ]);
    for (const x of shifts.filter((s) => s.jobId === id)) await repos.shifts.remove(x.id);
    for (const x of tasks.filter((s) => s.jobId === id)) await repos.tasks.remove(x.id);
    for (const x of templates.filter((s) => s.jobId === id))
      await repos.shift_templates.remove(x.id);
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

  const updateSlot = (key: number, patch: Partial<SlotDraft>) =>
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'jobs.newTitle' : 'jobs.editTitle') }} />

      {endedAt && (
        <Section>
          <EmptyText>{t('jobs.endedOn', { date: endedAt })}</EmptyText>
          <Button variant="secondary" title={t('jobs.restore')} onPress={() => setEnded(false)} />
        </Section>
      )}

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
        <Field label={t(isPiece ? 'jobs.clientName' : 'jobs.name')} error={err('name')}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t(isPiece ? 'jobs.clientPlaceholder' : 'jobs.namePlaceholder')}
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
        {!isPiece && (
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
        )}

        <Pressable
          onPress={() => setMoreOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          style={styles.moreToggle}>
          <Text style={styles.moreText}>
            {moreOpen ? '▾' : '▸'} {t('jobs.more')}
          </Text>
        </Pressable>
        {(moreOpen || !!err('cutoff') || !!err('break')) && (
          <>
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
                  style={styles.narrow}
                />
              )}
            </Field>
            {!isPiece && (
              <Field label={t('jobs.defaultBreak')} error={err('break')}>
                <Input
                  value={breakMinutes}
                  onChangeText={(v) => setBreakMinutes(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  style={styles.narrow}
                />
              </Field>
            )}
          </>
        )}
      </Section>

      {/* 新建时薪兼职：直接加时间段 */}
      {isNew && !isPiece && (
        <Section title={t('jobs.templates')}>
          <EmptyText>{t('jobs.templatesHint')}</EmptyText>
          {slots.map((s) => {
            const e = showErrors ? slotError(s) : null;
            return (
              <View key={s.key} style={styles.slot}>
                <View style={styles.slotHeader}>
                  <Input
                    value={s.name}
                    onChangeText={(v) => updateSlot(s.key, { name: v })}
                    placeholder={t('templates.namePlaceholder')}
                    style={styles.slotName}
                  />
                  <Pressable
                    onPress={() => setSlots((list) => list.filter((x) => x.key !== s.key))}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={styles.remove}>{t('jobs.removeSlot')}</Text>
                  </Pressable>
                </View>
                <View style={styles.slotRow}>
                  <TimePicker
                    value={s.startTime}
                    onChange={(v) => updateSlot(s.key, { startTime: v })}
                    placeholder={t('shift.startTime')}
                    accessibilityLabel={t('shift.startTime')}
                  />
                  <Text style={styles.dash}>–</Text>
                  <TimePicker
                    value={s.endTime}
                    onChange={(v) => updateSlot(s.key, { endTime: v })}
                    placeholder={t('shift.endTime')}
                    accessibilityLabel={t('shift.endTime')}
                  />
                  <Input
                    value={s.breakMinutes}
                    onChangeText={(v) => updateSlot(s.key, { breakMinutes: v.replace(/\D/g, '') })}
                    keyboardType="number-pad"
                    style={styles.slotBreak}
                    accessibilityLabel={t('shift.breakMinutes')}
                  />
                  <Text style={styles.unit}>{t('shift.breakMinutes')}</Text>
                </View>
                {e && <Text style={styles.error}>{e}</Text>}
              </View>
            );
          })}
          <Button
            variant="secondary"
            title={t('jobs.addSlot')}
            onPress={() =>
              setSlots((list) => [
                ...list,
                {
                  key: Date.now(),
                  name: '',
                  startTime: '',
                  endTime: '',
                  breakMinutes: breakMinutes || '0',
                },
              ])
            }
          />
        </Section>
      )}

      {/* 新建客户：直接填第一个项目 */}
      {isNew && isPiece && (
        <Section title={t('jobs.firstProject')}>
          <EmptyText>{t('jobs.firstProjectHint')}</EmptyText>
          <Field label={t('task.title')} error={err('projectTitle')}>
            <Input
              value={projectTitle}
              onChangeText={setProjectTitle}
              placeholder={t('task.titlePlaceholder')}
            />
          </Field>
          <Field label={t('task.amount')} error={err('projectAmount')}>
            <Input
              value={projectAmount}
              onChangeText={setProjectAmount}
              keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
              placeholder={currency === 'JPY' ? '10000' : '800.00'}
            />
          </Field>
          <Field label={t('task.dueDate')} error={err('projectDue')} hint={t('task.dueHint')}>
            <DatePicker
              value={projectDue}
              onChange={setProjectDue}
              placeholder={t('task.datePlaceholder')}
              accessibilityLabel={t('task.dueDate')}
            />
          </Field>
        </Section>
      )}

      <Button title={t('common.save')} onPress={save} />

      {/* 编辑：模板 / 项目列表 */}
      {!isNew && !isPiece && (
        <Section
          title={t('jobs.templates')}
          right={
            <Button
              variant="secondary"
              title={t('jobs.addTemplate')}
              onPress={() =>
                router.push({ pathname: '/templates/[id]', params: { id: 'new', jobId: id } })
              }
            />
          }>
          {related && related.templates.length === 0 && (
            <EmptyText>{t('jobs.templatesHint')}</EmptyText>
          )}
          {related?.templates.map((tpl) => (
            <ListRow
              key={tpl.id}
              color={color}
              title={tpl.name}
              subtitle={`${tpl.startTime} – ${tpl.endTime}`}
              right={formatDuration(t, workedMinutes(tpl))}
              onPress={() => router.push({ pathname: '/templates/[id]', params: { id: tpl.id } })}
            />
          ))}
        </Section>
      )}
      {!isNew && isPiece && (
        <Section
          title={t('jobs.projects')}
          right={
            <Button
              variant="secondary"
              title={t('task.newTitle')}
              onPress={() =>
                router.push({ pathname: '/task/[id]', params: { id: 'new', jobId: id } })
              }
            />
          }>
          {related && related.projects.length === 0 && (
            <EmptyText>{t('jobs.noProjects')}</EmptyText>
          )}
          {related?.projects.map((task) => (
            <ListRow
              key={task.id}
              color={color}
              title={task.title}
              subtitle={`${t('day.taskDue')} ${task.dueDate}`}
              right={formatMoney(task.amount, task.currency)}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            />
          ))}
        </Section>
      )}

      {!isNew && !endedAt && (
        <Button variant="secondary" title={t('jobs.end')} onPress={() => setEnded(true)} />
      )}
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  moreToggle: { paddingVertical: 4 },
  moreText: { color: colors.primary, fontSize: 14 },
  narrow: { width: 96 },
  slot: {
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotName: { flex: 1 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  slotBreak: { width: 56, textAlign: 'center' },
  dash: { color: colors.textMuted },
  unit: { fontSize: 12, color: colors.textMuted },
  remove: { color: colors.danger, fontSize: 14 },
  error: { fontSize: 12, color: colors.danger },
}));
