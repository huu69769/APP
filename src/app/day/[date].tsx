import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { showMessage } from '@/components/confirm';
import { DayNoteEditor } from '@/components/DayNoteEditor';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import { buildPendingShift, buildShiftFromTemplate, sortShifts } from '@/data/shifts';
import { tasksOnDate } from '@/data/tasks';
import { isActiveJob, isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { useDayLabels } from '@/holidays/useHolidays';
import { formatDuration } from '@/i18n/format';
import { isValidLocalDate, parseLocalDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { HolidayMark } from '@/lib/holidays';
import { lunarInfo, type LunarInfo } from '@/lib/lunar';
import { isOvernight, shiftWage, workedMinutes } from '@/lib/shift';
import { colors } from '@/theme/colors';

/**
 * 当天详情页：
 * - 当天的班次、DDL 是这天的项目
 * - 一键添加：模板、时间待定
 * - ＋ 添加：手动添加班次 / 项目
 * M4 起还会有日程和笔记。
 */
export default function DayScreen() {
  const { t } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { repos, settings } = useData();
  const toast = useToast();
  const valid = !!date && isValidLocalDate(date);
  const [adding, setAdding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const safeDate = valid ? date : '2000-01-01';
  const { data: holidayData } = useDayLabels(safeDate, safeDate);

  const { data } = useQuery(
    async (r) => {
      if (!valid) return null;
      const [shifts, allJobs, templates, allTasks, events] = await Promise.all([
        r.shifts.listByDateRange(date, date),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
        r.events.listByDateRange(date, date),
      ]);
      const activeJobs = allJobs
        .filter(isActiveJob)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        shifts: sortShifts(shifts),
        tasks: tasksOnDate(allTasks, date),
        // 全天的在前，其余按开始时间
        events: events.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
        jobsById: new Map(allJobs.map((j) => [j.id, j])),
        hourlyJobs: activeJobs.filter((j) => jobPayType(j) === 'hourly'),
        activeJobs,
        templates,
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

  /** 一键添加：模板或「时间待定」，添加后显示可以撤销的提示 */
  const quickAdd = async (job: Job, template: ShiftTemplate | null) => {
    if (adding) return;
    setAdding(true);
    try {
      const shift = await repos.shifts.create(
        template ? buildShiftFromTemplate(job, template, date) : buildPendingShift(job, date)
      );
      const what = template
        ? `${job.name} ${template.startTime}–${template.endTime}`
        : t('day.pendingChip', { job: job.name });
      toast(t('toast.added', { what }), { onUndo: () => repos.shifts.remove(shift.id) });
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    } finally {
      setAdding(false);
    }
  };

  const nothing =
    data && data.shifts.length === 0 && data.tasks.length === 0 && data.events.length === 0;

  return (
    <FormScreen>
      <Stack.Screen options={{ title }} />
      <DayHeader
        lunar={settings.showLunar ? lunarInfo(date) : null}
        marks={holidayData?.marks.get(date) ?? []}
      />
      {data && (
        <>
          {nothing ? (
            <Section>
              <EmptyText>{t('day.empty')}</EmptyText>
            </Section>
          ) : (
            <>
              {data.shifts.length > 0 && (
                <Section title={t('day.shifts')}>
                  {data.shifts.map((s) => {
                    const job = data.jobsById.get(s.jobId);
                    const open = () =>
                      router.push({ pathname: '/shift/[id]', params: { id: s.id } });
                    if (!isTimed(s)) {
                      return (
                        <ListRow
                          key={s.id}
                          color={job?.color}
                          title={t('shift.pendingTitle', { job: job?.name ?? '' })}
                          subtitle={s.note || undefined}
                          right="—"
                          onPress={open}
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
                        onPress={open}
                      />
                    );
                  })}
                </Section>
              )}
              {data.events.length > 0 && (
                <Section title={t('day.events')}>
                  {data.events.map((e) => (
                    <ListRow
                      key={e.id}
                      color={e.color}
                      title={e.title}
                      subtitle={[
                        e.allDay
                          ? t('day.allDay')
                          : `${e.startTime}${e.endTime ? ` – ${e.endTime}` : ''}`,
                        e.reminderMinutesBefore !== null ? '🔔' : null,
                        e.note || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}
                    />
                  ))}
                </Section>
              )}
              {data.tasks.length > 0 && (
                <Section title={t('day.tasks')}>
                  {data.tasks.map((task) => {
                    const job = data.jobsById.get(task.jobId);
                    return (
                      <ListRow
                        key={task.id}
                        color={job?.color}
                        title={task.title}
                        subtitle={[job?.name, t('day.taskDue')].filter(Boolean).join(' · ')}
                        right={formatMoney(task.amount, task.currency)}
                        onPress={() =>
                          router.push({ pathname: '/task/[id]', params: { id: task.id } })
                        }
                      />
                    );
                  })}
                </Section>
              )}
            </>
          )}

          {data.hourlyJobs.length > 0 && (
            <Section title={t('day.quickAdd')}>
              <View style={styles.chips}>
                {data.hourlyJobs.flatMap((job) => [
                  ...data.templates
                    .filter((tpl) => tpl.jobId === job.id)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((tpl) => (
                      <Chip
                        key={tpl.id}
                        color={job.color}
                        label={`${job.name} · ${tpl.name}`}
                        detail={`${tpl.startTime}–${tpl.endTime}`}
                        disabled={adding}
                        onPress={() => quickAdd(job, tpl)}
                      />
                    )),
                  <Chip
                    key={`pending-${job.id}`}
                    color={job.color}
                    label={t('day.pendingChip', { job: job.name })}
                    dashed
                    disabled={adding}
                    onPress={() => quickAdd(job, null)}
                  />,
                ])}
              </View>
              {data.templates.length === 0 && <EmptyText>{t('day.noTemplates')}</EmptyText>}
            </Section>
          )}
          <Button title={t('day.add')} onPress={() => setSheetOpen(true)} />

          <DayNoteEditor date={date} />

          <ActionSheet
            visible={sheetOpen}
            title={t('day.addTitle')}
            onClose={() => setSheetOpen(false)}
            actions={[
              {
                label: t('day.addEvent'),
                onPress: () =>
                  router.push({ pathname: '/event/[id]', params: { id: 'new', date } }),
              },
              {
                label: t('day.addShift'),
                onPress: () =>
                  router.push({ pathname: '/shift/[id]', params: { id: 'new', date } }),
              },
              {
                label: t('day.addProject'),
                onPress: () => router.push({ pathname: '/task/[id]', params: { id: 'new', date } }),
              },
            ]}
          />
        </>
      )}
    </FormScreen>
  );
}

/** 当天的农历、节气、节假日（放假 / 调休上班） */
function DayHeader({ lunar, marks }: { lunar: LunarInfo | null; marks: HolidayMark[] }) {
  const { t } = useTranslation();
  if (!lunar && marks.length === 0) return null;
  return (
    <View style={styles.header}>
      {lunar && (
        <Text style={styles.headerLunar}>
          {t('holiday.lunar', { date: lunar.date })}
          {lunar.special ? ` · ${lunar.special}` : ''}
        </Text>
      )}
      {marks.map((m) => (
        <Text
          key={`${m.country}-${m.name}`}
          style={[
            styles.headerHoliday,
            {
              color: !m.off
                ? colors.holidayWork
                : m.country === 'JP'
                  ? colors.holidayJP
                  : colors.holidayCN,
            },
          ]}>
          {t(`holiday.country.${m.country}`)} · {m.name}
          {/* 中国要区分放假和调休上班；日本的祝日本来就是休息日，不用再写 */}
          {m.country === 'CN' ? `（${t(m.off ? 'holiday.off' : 'holiday.work')}）` : ''}
        </Text>
      ))}
    </View>
  );
}

function Chip({
  color,
  label,
  detail,
  dashed,
  disabled,
  onPress,
}: {
  color: string;
  label: string;
  detail?: string;
  dashed?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        { borderColor: color },
        dashed && styles.chipDashed,
        pressed && styles.chipPressed,
      ]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={styles.chipText}>{label}</Text>
      {detail && <Text style={styles.chipTime}>{detail}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 4, gap: 2 },
  headerLunar: { fontSize: 13, color: colors.textMuted },
  headerHoliday: { fontSize: 14, fontWeight: '600' },
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
  chipDashed: { borderStyle: 'dashed' },
  chipPressed: { opacity: 0.5 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 14, color: colors.text },
  chipTime: { fontSize: 12, color: colors.textMuted },
});
