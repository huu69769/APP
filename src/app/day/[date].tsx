import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { confirmAsync, showMessage } from '@/components/confirm';
import { DayNoteEditor } from '@/components/DayNoteEditor';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import { deleteItems, type ItemRef } from '@/data/bulk';
import {
  buildPendingShift,
  buildShiftFromTemplate,
  createShiftUnlessDuplicate,
  sortShifts,
} from '@/data/shifts';
import { tasksOnDate } from '@/data/tasks';
import { isActiveJob, isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { useDayLabels } from '@/holidays/useHolidays';
import { formatDuration } from '@/i18n/format';
import { occurrencesInRange } from '@/lib/anniversary';
import { isValidLocalDate, parseLocalDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { HolidayMark } from '@/lib/holidays';
import { lunarInfo, type LunarInfo } from '@/lib/lunar';
import { isOvernight, shiftWage, workedMinutes } from '@/lib/shift';
import { makeStyles, useColors } from '@/theme';

/**
 * 当天详情页：
 * - 当天的班次、DDL 是这天的项目
 * - 一键添加：模板、时间待定
 * - ＋ 添加：手动添加班次 / 项目
 * M4 起还会有日程和笔记。
 */
export default function DayScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { repos, settings } = useData();
  const toast = useToast();
  const valid = !!date && isValidLocalDate(date);
  const [adding, setAdding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 选择模式（一次删除多条）：选中的 "kind:id"
  const [selection, setSelection] = useState<Set<string> | undefined>(undefined);
  const safeDate = valid ? date : '2000-01-01';
  const { data: holidayData } = useDayLabels(safeDate, safeDate);

  const { data } = useQuery(
    async (r) => {
      if (!valid) return null;
      const [shifts, allJobs, templates, allTasks, events, anniversaries] = await Promise.all([
        r.shifts.listByDateRange(date, date),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
        r.events.listByDateRange(date, date),
        r.anniversaries.list(),
      ]);
      const activeJobs = allJobs
        .filter(isActiveJob)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        shifts: sortShifts(shifts),
        tasks: tasksOnDate(allTasks, date),
        anniversaries: anniversaries.flatMap((a) =>
          occurrencesInRange(a, date, date).map((o) => ({ a, years: o.years }))
        ),
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
      const what = template
        ? `${job.name} ${template.startTime}–${template.endTime}`
        : t('day.pendingChip', { job: job.name });
      const shift = await createShiftUnlessDuplicate(
        repos,
        template ? buildShiftFromTemplate(job, template, date) : buildPendingShift(job, date)
      );
      if (!shift) {
        toast(t('toast.duplicate', { what }));
        return;
      }
      toast(t('toast.added', { what }), { onUndo: () => repos.shifts.remove(shift.id) });
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    } finally {
      setAdding(false);
    }
  };

  /** 列表里一行：选择模式时点一下是勾选，平时是打开编辑 */
  const rowProps = (kind: ItemRef['kind'], id: string, open: () => void) => {
    const key = `${kind}:${id}`;
    if (!selection) return { onPress: open };
    return {
      selected: selection.has(key),
      onPress: () => {
        const next = new Set(selection);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelection(next);
      },
    };
  };

  const deleteSelected = async () => {
    if (!selection?.size) return;
    const ok = await confirmAsync({
      title: t('bulk.deleteTitle', { count: selection.size }),
      message: t('bulk.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const refs = [...selection].map((k) => {
      const [kind, id] = k.split(':');
      return { kind: kind as ItemRef['kind'], id };
    });
    const undo = await deleteItems(repos, refs);
    setSelection(undefined);
    toast(t('toast.deleted', { count: refs.length }), { onUndo: undo });
  };

  const nothing =
    data &&
    data.shifts.length === 0 &&
    data.tasks.length === 0 &&
    data.events.length === 0 &&
    data.anniversaries.length === 0;

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
              <View style={styles.selectBar}>
                {selection ? (
                  <>
                    <Text style={styles.selectCount}>
                      {t('common.selectedCount', { count: selection.size })}
                    </Text>
                    <Pressable
                      onPress={() => setSelection(undefined)}
                      accessibilityRole="button"
                      hitSlop={8}>
                      <Text style={styles.selectCancel}>{t('common.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={deleteSelected}
                      disabled={selection.size === 0}
                      accessibilityRole="button"
                      style={[styles.deleteButton, selection.size === 0 && styles.disabled]}>
                      <Text style={styles.deleteText}>
                        {t('common.deleteSelected', { count: selection.size })}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setSelection(new Set())}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={styles.selectStart}>{t('common.select')}</Text>
                  </Pressable>
                )}
              </View>
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
                          {...rowProps('shift', s.id, open)}
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
                        {...rowProps('shift', s.id, open)}
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
                      {...rowProps('event', e.id, () =>
                        router.push({ pathname: '/event/[id]', params: { id: e.id } })
                      )}
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
                        {...rowProps('task', task.id, () =>
                          router.push({ pathname: '/task/[id]', params: { id: task.id } })
                        )}
                      />
                    );
                  })}
                </Section>
              )}
              {data.anniversaries.length > 0 && (
                <Section title={t('anniv.title')}>
                  {data.anniversaries.map(({ a, years }) => (
                    <ListRow
                      key={a.id}
                      color={a.color}
                      title={`★ ${a.title}`}
                      subtitle={
                        [years > 0 ? t('anniv.years', { count: years }) : null, a.note || null]
                          .filter(Boolean)
                          .join(' · ') || undefined
                      }
                      {...rowProps('anniversary', a.id, () =>
                        router.push({ pathname: '/anniversaries/[id]', params: { id: a.id } })
                      )}
                    />
                  ))}
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
              {
                label: t('anniv.add'),
                onPress: () =>
                  router.push({ pathname: '/anniversaries/[id]', params: { id: 'new', date } }),
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
  const colors = useColors();
  const styles = useStyles();
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
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 4,
    minHeight: 32,
  },
  selectStart: { color: colors.primary, fontSize: 14 },
  selectCount: { flex: 1, color: colors.text, fontSize: 14 },
  selectCancel: { color: colors.textMuted, fontSize: 14 },
  deleteButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  deleteText: { color: colors.onColor, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.4 },
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
}));
