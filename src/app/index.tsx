import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBackup } from '@/backup/useBackup';
import { ActionSheet, type SheetAction } from '@/components/ActionSheet';
import { confirmAsync, showMessage } from '@/components/confirm';
import { DayPanel } from '@/components/DayPanel';
import { MonthCalendar, type DayBar } from '@/components/MonthCalendar';
import { Segmented } from '@/components/form';
import { StatsBar } from '@/components/StatsBar';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import { buildDayItems, type DayItem } from '@/data/dayItems';
import { deleteItems } from '@/data/bulk';
import {
  applyPendingToDates,
  applyTemplateToDates,
  buildPendingShift,
  buildShiftFromTemplate,
  createShiftUnlessDuplicate,
  sortShifts,
} from '@/data/shifts';
import { isTaskDone } from '@/data/tasks';
import { isActiveJob, isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { useMonthStats } from '@/data/useStats';
import { useDayLabels } from '@/holidays/useHolidays';
import { shouldRemindBackup } from '@/lib/backup';
import { HOME_ROW_HEIGHT, monthGridRange } from '@/lib/calendar';
import {
  addMonths,
  currentMonth,
  parseLocalDate,
  today as getToday,
  type LocalDate,
  type YearMonth,
} from '@/lib/date';
import { lunarInfo } from '@/lib/lunar';
import { colors } from '@/theme/colors';

/** 切换到某个月时默认选中的日期：本月选今天，其他月选 1 号 */
function defaultFocus(month: YearMonth, today: LocalDate): LocalDate {
  return today.startsWith(month) ? today : `${month}-01`;
}

/**
 * 首页：
 * - 顶部固定：月份、菜单
 * - 下面整页一起滚动：统计栏（一行）+ 打工 / 日程 视图切换、月历、选中那天的安排
 * - 点日期 = 选中那一天，下面列出这天的安排（点一条进入编辑，「详情」进入当天页面）
 * - 右下角「＋」：给选中的那天一键添加（模板）或添加日程 / 班次 / 项目
 * - 点月份标题回到本月；长按日期开始批量排班
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, repos } = useData();
  const toast = useToast();
  const { exportBackup } = useBackup();
  const today = getToday();
  const [month, setMonth] = useState(currentMonth());
  const [focused, setFocused] = useState<LocalDate>(today);
  const [year, monthNumber] = month.split('-').map(Number);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const view = settings.calendarView;

  // 批量排班
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<LocalDate>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 下方列表的选择模式（一次删除多条）
  const [selection, setSelection] = useState<Set<string> | undefined>(undefined);

  const goToMonth = (m: YearMonth) => {
    setMonth(m);
    setFocused(defaultFocus(m, today));
    setSelection(undefined);
  };

  const { data } = useQuery(
    async (r) => {
      const { from, to } = monthGridRange(month, settings.weekStart);
      const [shifts, jobs, templates, allTasks, events, notes] = await Promise.all([
        r.shifts.listByDateRange(from, to),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
        r.events.listByDateRange(from, to),
        r.day_notes.listByDateRange(from, to),
      ]);
      const tasks = allTasks.filter((x) => x.dueDate >= from && x.dueDate <= to);
      const jobsById = new Map(jobs.map((j) => [j.id, j]));
      const bars = new Map<LocalDate, DayBar[]>();
      const dots = new Map<LocalDate, string[]>();
      const bar = (date: LocalDate, b: DayBar) => bars.set(date, [...(bars.get(date) ?? []), b]);
      const dot = (date: LocalDate, c: string) => dots.set(date, [...(dots.get(date) ?? []), c]);

      const sortedEvents = [...events].sort((a, b) =>
        a.allDay === b.allDay
          ? (a.startTime ?? '').localeCompare(b.startTime ?? '')
          : a.allDay
            ? -1
            : 1
      );
      // 打工视图：班次是色块、日程是小圆点；日程视图：日程是色块、班次是小圆点
      if (view === 'schedule') {
        for (const e of sortedEvents) {
          bar(e.date, {
            id: e.id,
            color: e.color,
            // 标题在前：格子窄时至少能看到标题
            label: e.allDay || !e.startTime ? e.title : `${e.title} ${e.startTime}`,
          });
        }
        for (const s of sortShifts(shifts))
          dot(s.date, jobsById.get(s.jobId)?.color ?? colors.textMuted);
      } else {
        for (const s of sortShifts(shifts)) {
          const job = jobsById.get(s.jobId);
          bar(s.date, {
            id: s.id,
            color: job?.color ?? colors.textMuted,
            label: job?.name ?? '',
            pending: !isTimed(s),
          });
        }
        for (const e of sortedEvents) dot(e.date, e.color);
      }
      // 项目在两种视图里都显示在 DDL 那天：没到 ⏰，已过 ✓
      for (const task of tasks) {
        bar(task.dueDate, {
          id: task.id,
          color: jobsById.get(task.jobId)?.color ?? colors.textMuted,
          label: `${isTaskDone(task, today) ? '✓' : '⏰'}${task.title}`,
          task: true,
        });
      }
      for (const n of notes) dot(n.date, colors.textMuted);

      const hourlyJobs = jobs
        .filter((j) => isActiveJob(j) && jobPayType(j) === 'hourly')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        bars,
        dots,
        shifts,
        events,
        tasks,
        jobsById,
        hourlyJobs,
        templates,
        hasJobs: jobs.some((j) => !j.deletedAt),
        // 最早的一份工作的创建时间：从没备份过时，用它来判断要不要提示备份
        oldestDataAt: jobs.map((j) => j.createdAt).sort()[0] ?? null,
      };
    },
    [month, settings.weekStart, today, view]
  );

  const { data: statsData } = useMonthStats(month);
  const grid = monthGridRange(month, settings.weekStart);
  const { data: holidayData } = useDayLabels(grid.from, grid.to);

  const items = data
    ? buildDayItems({
        date: focused,
        today,
        shifts: data.shifts,
        events: data.events,
        tasks: data.tasks,
        jobsById: data.jobsById,
      })
    : undefined;

  const toggle = (date: LocalDate) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const openDay = (date: LocalDate) => router.push({ pathname: '/day/[date]', params: { date } });

  const onPressDay = (date: LocalDate) => {
    if (batchMode) {
      toggle(date);
      return;
    }
    if (!date.startsWith(month)) {
      // 点了上下月补位的日期：切到那个月并选中
      setMonth(date.slice(0, 7));
      setFocused(date);
      return;
    }
    // 再点一次已选中的日期 → 打开当天页面
    if (date === focused) openDay(date);
    else {
      setFocused(date);
      setSelection(undefined);
    }
  };

  const openItem = (item: DayItem) => {
    if (selection) {
      const next = new Set(selection);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      setSelection(next);
      return;
    }
    if (item.kind === 'shift') router.push({ pathname: '/shift/[id]', params: { id: item.id } });
    else if (item.kind === 'event')
      router.push({ pathname: '/event/[id]', params: { id: item.id } });
    else router.push({ pathname: '/task/[id]', params: { id: item.id } });
  };

  const startBatch = (date?: LocalDate) => {
    setBatchMode(true);
    setSelected(new Set(date ? [date] : []));
  };

  const exitBatch = () => {
    setBatchMode(false);
    setSelected(new Set());
    setPickerOpen(false);
  };

  /** 批量套用模板；template 为 null 时标记「时间待定」。完成后可以撤销 */
  const applyTemplate = async (job: Job, template: ShiftTemplate | null) => {
    setPickerOpen(false);
    try {
      const dates = [...selected];
      const { created, skipped } = template
        ? await applyTemplateToDates(repos, template, dates)
        : await applyPendingToDates(repos, job, dates);
      exitBatch();
      const message = skipped.length
        ? t('batch.doneSkipped', { count: created.length, skipped: skipped.length })
        : t('batch.done', { count: created.length });
      toast(message, {
        onUndo: created.length
          ? async () => {
              for (const s of created) await repos.shifts.remove(s.id);
            }
          : undefined,
      });
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  /** 一键添加到选中的那天（模板或时间待定），可以撤销 */
  const quickAdd = async (job: Job, template: ShiftTemplate | null) => {
    try {
      const what = template
        ? `${job.name} ${template.startTime}–${template.endTime}`
        : t('day.pendingChip', { job: job.name });
      const shift = await createShiftUnlessDuplicate(
        repos,
        template ? buildShiftFromTemplate(job, template, focused) : buildPendingShift(job, focused)
      );
      if (!shift) {
        toast(t('toast.duplicate', { what }));
        return;
      }
      toast(t('toast.added', { what }), { onUndo: () => repos.shifts.remove(shift.id) });
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  /** 删除列表里选中的条目，可以撤销 */
  const deleteSelected = async () => {
    const chosen = (items ?? []).filter((i) => selection?.has(i.key));
    if (!chosen.length) return;
    const ok = await confirmAsync({
      title: t('bulk.deleteTitle', { count: chosen.length }),
      message: t('bulk.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const undo = await deleteItems(repos, chosen);
    setSelection(undefined);
    toast(t('toast.deleted', { count: chosen.length }), { onUndo: undo });
  };

  /** 批量模式：删除所选日期的班次 / 日程（项目不在这里删），可以撤销 */
  const deleteOnSelectedDays = async (what: 'shifts' | 'events' | 'all') => {
    const refs = [
      ...(what !== 'events' ? (data?.shifts ?? []) : [])
        .filter((s) => selected.has(s.date))
        .map((s) => ({ kind: 'shift' as const, id: s.id })),
      ...(what !== 'shifts' ? (data?.events ?? []) : [])
        .filter((e) => selected.has(e.date))
        .map((e) => ({ kind: 'event' as const, id: e.id })),
    ];
    if (!refs.length) return;
    const ok = await confirmAsync({
      title: t(`batch.deleteTitle_${what}`, { days: selected.size, count: refs.length }),
      message: t('bulk.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const undo = await deleteItems(repos, refs);
    exitBatch();
    toast(t('toast.deleted', { count: refs.length }), { onUndo: undo });
  };

  const shiftsOnSelected = (data?.shifts ?? []).filter((s) => selected.has(s.date)).length;
  const eventsOnSelected = (data?.events ?? []).filter((e) => selected.has(e.date)).length;
  const openDeleteSheet = () => {
    if (!shiftsOnSelected && !eventsOnSelected) {
      toast(t('batch.nothingToDelete'));
      return;
    }
    setDeleteOpen(true);
  };
  const deleteActions: SheetAction[] = [
    ...(shiftsOnSelected
      ? [
          {
            label: t('batch.deleteShiftsOpt', { count: shiftsOnSelected }),
            onPress: () => deleteOnSelectedDays('shifts'),
          },
        ]
      : []),
    ...(eventsOnSelected
      ? [
          {
            label: t('batch.deleteEventsOpt', { count: eventsOnSelected }),
            onPress: () => deleteOnSelectedDays('events'),
          },
        ]
      : []),
    ...(shiftsOnSelected && eventsOnSelected
      ? [
          {
            label: t('batch.deleteAllOpt', { count: shiftsOnSelected + eventsOnSelected }),
            onPress: () => deleteOnSelectedDays('all'),
          },
        ]
      : []),
  ];

  const fd = parseLocalDate(focused);
  const addActions: SheetAction[] = [
    ...(data?.hourlyJobs ?? []).flatMap((job) => [
      ...(data?.templates ?? [])
        .filter((tpl) => tpl.jobId === job.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((tpl) => ({
          label: `${job.name} · ${tpl.name}`,
          detail: `${tpl.startTime}–${tpl.endTime}`,
          color: job.color,
          onPress: () => quickAdd(job, tpl),
        })),
      {
        label: t('day.pendingChip', { job: job.name }),
        color: job.color,
        dashed: true,
        onPress: () => quickAdd(job, null),
      },
    ]),
    {
      label: t('day.addEvent'),
      onPress: () => router.push({ pathname: '/event/[id]', params: { id: 'new', date: focused } }),
    },
    {
      label: t('day.addShift'),
      onPress: () => router.push({ pathname: '/shift/[id]', params: { id: 'new', date: focused } }),
    },
    {
      label: t('day.addProject'),
      onPress: () => router.push({ pathname: '/task/[id]', params: { id: 'new', date: focused } }),
    },
  ];

  const isCurrentMonth = month === currentMonth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => goToMonth(addMonths(month, -1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable
          onPress={() => goToMonth(currentMonth())}
          accessibilityRole="button"
          accessibilityHint={t('calendar.today')}>
          <Text style={styles.title}>{t('calendar.monthTitle', { year, month: monthNumber })}</Text>
        </Pressable>
        <Pressable
          onPress={() => goToMonth(addMonths(month, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <View style={styles.spacer} />
        {!isCurrentMonth && (
          <HeaderButton label={t('calendar.today')} onPress={() => goToMonth(currentMonth())} />
        )}
        {batchMode ? (
          <HeaderButton label={t('common.cancel')} onPress={exitBatch} />
        ) : (
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel={t('home.menu')}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {batchMode ? (
          <Text style={styles.batchHint}>{t('batch.hint')}</Text>
        ) : (
          <>
            <View style={styles.toolbar}>
              <StatsBar
                month={month}
                mode={settings.statsPeriod}
                wageDisplay={settings.wageDisplay}
                currency={settings.defaultCurrency}
                stats={statsData?.stats}
                onPress={() => router.push({ pathname: '/stats', params: { month } })}
              />
              <Segmented
                size="small"
                options={[
                  { value: 'work', label: t('home.viewWork') },
                  { value: 'schedule', label: t('home.viewSchedule') },
                ]}
                value={view}
                onChange={(v) => updateSettings({ calendarView: v })}
              />
            </View>
            {data &&
              shouldRemindBackup({
                lastBackupAt: settings.lastBackupAt,
                dismissedAt: settings.backupReminderDismissedAt,
                oldestDataAt: data.oldestDataAt,
                now: new Date(),
              }) && (
                <View style={styles.backupCard}>
                  <Text style={styles.backupText}>{t('home.backupReminder')}</Text>
                  <View style={styles.backupActions}>
                    <Pressable
                      onPress={() =>
                        updateSettings({ backupReminderDismissedAt: new Date().toISOString() })
                      }
                      accessibilityRole="button"
                      hitSlop={8}>
                      <Text style={styles.backupDismiss}>{t('home.dismiss')}</Text>
                    </Pressable>
                    <Pressable onPress={exportBackup} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.backupAction}>{t('home.backupNow')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            {data && !data.hasJobs && (
              <View style={styles.onboarding}>
                <View style={styles.onboardingText}>
                  <Text style={styles.onboardingTitle}>{t('home.onboardingTitle')}</Text>
                  <Text style={styles.onboardingBody}>{t('home.onboardingBody')}</Text>
                </View>
                <Pressable
                  onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: 'new' } })}
                  accessibilityRole="button"
                  style={styles.onboardingButton}>
                  <Text style={styles.onboardingButtonText}>{t('home.onboardingButton')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <MonthCalendar
          month={month}
          weekStart={settings.weekStart}
          today={today}
          bars={data?.bars}
          dots={data?.dots}
          labels={holidayData?.labels}
          selected={batchMode ? selected : undefined}
          focusedDate={batchMode ? null : focused}
          rowHeight={HOME_ROW_HEIGHT}
          onPressDay={onPressDay}
          onLongPressDay={(date) => (batchMode ? toggle(date) : startBatch(date))}
          onSwipe={(delta) => goToMonth(addMonths(month, delta))}
        />

        {!batchMode && (
          <DayPanel
            date={focused}
            items={items}
            lunar={settings.showLunar ? lunarInfo(focused) : null}
            marks={holidayData?.marks.get(focused) ?? []}
            onOpenDetails={() => openDay(focused)}
            onPressItem={openItem}
            selection={selection}
            onStartSelect={() => setSelection(new Set())}
          />
        )}
      </ScrollView>

      {batchMode ? (
        <View style={styles.batchBar}>
          <Text style={styles.batchCount}>{t('batch.selected', { count: selected.size })}</Text>
          <Pressable
            onPress={openDeleteSheet}
            disabled={selected.size === 0}
            accessibilityRole="button"
            style={[styles.deleteButton, selected.size === 0 && styles.disabled]}>
            <Text style={styles.deleteText}>{t('batch.delete')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={selected.size === 0}
            accessibilityRole="button"
            style={[styles.applyButton, selected.size === 0 && styles.disabled]}>
            <Text style={styles.applyText}>{t('batch.apply')}</Text>
          </Pressable>
        </View>
      ) : selection ? (
        <View style={styles.batchBar}>
          <Text style={styles.batchCount}>
            {t('common.selectedCount', { count: selection.size })}
          </Text>
          <Pressable
            onPress={() => setSelection(undefined)}
            accessibilityRole="button"
            style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={deleteSelected}
            disabled={selection.size === 0}
            accessibilityRole="button"
            style={[styles.deleteButtonFilled, selection.size === 0 && styles.disabled]}>
            <Text style={styles.deleteTextFilled}>
              {t('common.deleteSelected', { count: selection.size })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('home.add')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}

      <TemplatePicker
        visible={pickerOpen}
        jobs={data?.hourlyJobs ?? []}
        templates={data?.templates ?? []}
        onSelect={applyTemplate}
        onClose={() => setPickerOpen(false)}
      />

      <ActionSheet
        visible={addOpen}
        title={t('home.addTo', {
          date: t('calendar.dayLabel', { month: fd.month() + 1, day: fd.date() }),
        })}
        onClose={() => setAddOpen(false)}
        actions={addActions}
      />

      <ActionSheet
        visible={deleteOpen}
        title={t('batch.deleteWhat', { count: selected.size })}
        onClose={() => setDeleteOpen(false)}
        actions={deleteActions}
      />

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: t('home.jobs'), onPress: () => router.push('/jobs') },
          { label: t('home.batch'), onPress: () => startBatch() },
          {
            label: t('home.stats'),
            onPress: () => router.push({ pathname: '/stats', params: { month } }),
          },
          { label: t('home.settings'), onPress: () => router.push('/settings') },
        ]}
      />
    </SafeAreaView>
  );
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.headerButton} accessibilityRole="button">
      <Text style={styles.headerButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 4,
  },
  navButton: { paddingHorizontal: 10, paddingVertical: 4 },
  navText: { fontSize: 24, color: colors.text },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  spacer: { flex: 1 },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  headerButtonText: { color: colors.primary, fontSize: 13 },
  menuButton: { paddingHorizontal: 10, paddingVertical: 4 },
  menuIcon: { fontSize: 22, color: colors.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  batchHint: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 13,
    paddingBottom: 6,
  },
  onboarding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.infoBg,
  },
  onboardingText: { flex: 1, gap: 2 },
  backupCard: {
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
    gap: 8,
  },
  backupText: { fontSize: 13, color: colors.warningText },
  backupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  backupDismiss: { fontSize: 14, color: colors.textMuted },
  backupAction: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  onboardingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  onboardingBody: { fontSize: 12, color: colors.textMuted },
  onboardingButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  onboardingButtonText: { color: colors.onPrimary, fontWeight: '600' },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  batchCount: { flex: 1, color: colors.text, fontSize: 15 },
  applyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  applyText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  deleteText: { color: colors.danger, fontSize: 14 },
  deleteButtonFilled: {
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  deleteTextFilled: { color: colors.onColor, fontSize: 14, fontWeight: '600' },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelText: { color: colors.textMuted, fontSize: 14 },
  disabled: { opacity: 0.4 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabPressed: { opacity: 0.8 },
  fabText: { color: colors.onPrimary, fontSize: 28, lineHeight: 30 },
});
