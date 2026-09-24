import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { showMessage } from '@/components/confirm';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { useData } from '@/data/DataProvider';
import { buildPendingShift, buildShiftFromTemplate, sortShifts } from '@/data/shifts';
import { tasksOnDate } from '@/data/tasks';
import { isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatDuration } from '@/i18n/format';
import { isValidLocalDate, parseLocalDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { isOvernight, shiftWage, workedMinutes } from '@/lib/shift';
import { colors } from '@/theme/colors';

/**
 * 当天详情页：当天的班次列表、模板一键添加、手动添加。
 * M4 起还会显示日程和笔记。
 */
export default function DayScreen() {
  const { t } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { repos } = useData();
  const valid = !!date && isValidLocalDate(date);
  const [adding, setAdding] = useState(false);

  const { data } = useQuery(
    async (r) => {
      if (!valid) return null;
      const [shifts, allJobs, templates, allTasks] = await Promise.all([
        r.shifts.listByDateRange(date, date),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
      ]);
      const jobsById = new Map(allJobs.map((j) => [j.id, j]));
      const activeJobs = allJobs
        .filter((j) => !j.deletedAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const tasks = tasksOnDate(allTasks, date).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return {
        shifts: sortShifts(shifts),
        jobsById,
        hourlyJobs: activeJobs.filter((j) => jobPayType(j) === 'hourly'),
        pieceJobs: activeJobs.filter((j) => jobPayType(j) === 'piece'),
        activeJobs,
        templates,
        tasks,
      };
    },
    [date, valid]
  );

  if (!valid) {
    return (
      <FormScreen>
        <EmptyText>{t('day.invalidDate')}</EmptyText>
      </FormScreen>
    );
  }

  const d = parseLocalDate(date);
  const weekdays = t('day.weekdays', { returnObjects: true }) as string[];
  const title = t('day.title', { month: d.month() + 1, day: d.date(), weekday: weekdays[d.day()] });

  const addFromTemplate = async (job: Job, template: ShiftTemplate | null) => {
    if (adding) return;
    setAdding(true);
    try {
      await repos.shifts.create(
        template ? buildShiftFromTemplate(job, template, date) : buildPendingShift(job, date)
      );
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    } finally {
      setAdding(false);
    }
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title }} />
      {data && (
        <>
          {(data.shifts.length > 0 ||
            data.pieceJobs.length === 0 ||
            data.hourlyJobs.length > 0) && (
            <Section title={t('day.shifts')}>
              {data.shifts.length === 0 && <EmptyText>{t('day.empty')}</EmptyText>}
              {data.shifts.map((s) => {
                const job = data.jobsById.get(s.jobId);
                if (!isTimed(s)) {
                  return (
                    <ListRow
                      key={s.id}
                      color={job?.color}
                      title={t('shift.pendingTitle', { job: job?.name ?? '' })}
                      subtitle={s.note || undefined}
                      right="—"
                      onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
                    />
                  );
                }
                const overnight = isOvernight(s.startTime, s.endTime);
                return (
                  <ListRow
                    key={s.id}
                    color={job?.color}
                    title={`${job?.name ?? ''}  ${s.startTime} – ${overnight ? '+1 ' : ''}${s.endTime}`}
                    subtitle={[
                      formatDuration(t, workedMinutes(s)),
                      s.breakMinutes > 0 ? `☕ ${formatDuration(t, s.breakMinutes)}` : null,
                      s.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={formatMoney(shiftWage(s), s.currencySnapshot)}
                    onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
                  />
                );
              })}
            </Section>
          )}

          {(data.pieceJobs.length > 0 || data.tasks.length > 0) && (
            <Section
              title={t('day.tasks')}
              right={
                data.pieceJobs.length > 0 ? (
                  <Button
                    variant="secondary"
                    title={t('day.addTask')}
                    onPress={() =>
                      router.push({ pathname: '/task/[id]', params: { id: 'new', date } })
                    }
                  />
                ) : undefined
              }>
              {data.tasks.length === 0 && <EmptyText>{t('day.noTasks')}</EmptyText>}
              {data.tasks.map((task) => {
                const job = data.jobsById.get(task.jobId);
                return (
                  <ListRow
                    key={task.id}
                    color={job?.color}
                    title={`${task.deliveredDate ? '✓ ' : ''}${task.title}`}
                    subtitle={[
                      job?.name,
                      task.dueDate === date ? t('day.taskDue') : null,
                      task.deliveredDate
                        ? t('day.taskDeliveredOn', { date: task.deliveredDate })
                        : t('task.open'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={formatMoney(task.amount, task.currency)}
                    onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                  />
                );
              })}
            </Section>
          )}

          {data.activeJobs.length === 0 ? (
            <Section>
              <EmptyText>{t('day.noJobs')}</EmptyText>
              <Button title={t('day.goJobs')} onPress={() => router.push('/jobs')} />
            </Section>
          ) : data.hourlyJobs.length === 0 ? null : (
            <>
              <Section title={t('day.quickAdd')}>
                <View style={styles.chips}>
                  {data.hourlyJobs.flatMap((job) => [
                    ...data.templates
                      .filter((tpl) => tpl.jobId === job.id)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((tpl) => (
                        <Pressable
                          key={tpl.id}
                          onPress={() => addFromTemplate(job, tpl)}
                          disabled={adding}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.chip,
                            { borderColor: job.color },
                            pressed && styles.chipPressed,
                          ]}>
                          <View style={[styles.chipDot, { backgroundColor: job.color }]} />
                          <Text style={styles.chipText}>
                            {job.name} · {tpl.name}
                          </Text>
                          <Text style={styles.chipTime}>
                            {tpl.startTime}–{tpl.endTime}
                          </Text>
                        </Pressable>
                      )),
                    <Pressable
                      key={`pending-${job.id}`}
                      onPress={() => addFromTemplate(job, null)}
                      disabled={adding}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.chip,
                        styles.chipPending,
                        { borderColor: job.color },
                        pressed && styles.chipPressed,
                      ]}>
                      <View style={[styles.chipDot, { backgroundColor: job.color }]} />
                      <Text style={styles.chipText}>{t('day.pendingChip', { job: job.name })}</Text>
                    </Pressable>,
                  ])}
                </View>
                {data.templates.length === 0 && <EmptyText>{t('day.noTemplates')}</EmptyText>}
              </Section>
              <Button
                variant="secondary"
                title={t('day.manualAdd')}
                onPress={() =>
                  router.push({ pathname: '/shift/[id]', params: { id: 'new', date } })
                }
              />
            </>
          )}
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipPressed: { opacity: 0.5 },
  chipPending: { borderStyle: 'dashed' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 14, color: colors.text },
  chipTime: { fontSize: 12, color: colors.textMuted },
});
