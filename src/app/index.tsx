import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { showMessage } from '@/components/confirm';
import { MonthCalendar, type DayBar } from '@/components/MonthCalendar';
import { StatsBar } from '@/components/StatsBar';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import { applyPendingToDates, applyTemplateToDates, sortShifts } from '@/data/shifts';
import { isTaskDone } from '@/data/tasks';
import { isActiveJob, isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { useMonthStats } from '@/data/useStats';
import { monthGridRange } from '@/lib/calendar';
import { addMonths, currentMonth, today as getToday, type LocalDate } from '@/lib/date';
import { colors } from '@/theme/colors';

/**
 * 首页 = 统计栏 + 月历
 * - 点月份标题回到本月
 * - 长按某一天开始批量排班（菜单里也有入口）
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { settings, repos } = useData();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const today = getToday();
  const [year, monthNumber] = month.split('-').map(Number);
  const [menuOpen, setMenuOpen] = useState(false);

  // 批量排班
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<LocalDate>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data } = useQuery(
    async (r) => {
      const { from, to } = monthGridRange(month, settings.weekStart);
      const [shifts, jobs, templates, tasks, events, notes] = await Promise.all([
        r.shifts.listByDateRange(from, to),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
        r.events.listByDateRange(from, to),
        r.day_notes.listByDateRange(from, to),
      ]);
      const jobsById = new Map(jobs.map((j) => [j.id, j]));
      const bars = new Map<LocalDate, DayBar[]>();
      const push = (date: LocalDate, bar: DayBar) =>
        bars.set(date, [...(bars.get(date) ?? []), bar]);
      for (const s of sortShifts(shifts)) {
        const job = jobsById.get(s.jobId);
        push(s.date, {
          id: s.id,
          color: job?.color ?? colors.textMuted,
          label: job?.name ?? '',
          pending: !isTimed(s),
        });
      }
      // 项目显示在 DDL 那天：没到 ⏰，已过 ✓
      for (const task of tasks) {
        if (task.dueDate < from || task.dueDate > to) continue;
        push(task.dueDate, {
          id: task.id,
          color: jobsById.get(task.jobId)?.color ?? colors.textMuted,
          label: `${isTaskDone(task, today) ? '✓' : '⏰'}${task.title}`,
          task: true,
        });
      }
      // 日程：用日程的颜色；笔记：灰色
      const dots = new Map<LocalDate, string[]>();
      for (const e of [...events].sort((a, b) =>
        (a.startTime ?? '').localeCompare(b.startTime ?? '')
      )) {
        dots.set(e.date, [...(dots.get(e.date) ?? []), e.color]);
      }
      for (const n of notes) dots.set(n.date, [...(dots.get(n.date) ?? []), colors.textMuted]);
      const hourlyJobs = jobs
        .filter((j) => isActiveJob(j) && jobPayType(j) === 'hourly')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { bars, dots, hourlyJobs, templates, hasJobs: jobs.some((j) => !j.deletedAt) };
    },
    [month, settings.weekStart, today]
  );

  const { data: statsData } = useMonthStats(month);

  const toggle = (date: LocalDate) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const onPressDay = (date: LocalDate) => {
    if (batchMode) toggle(date);
    else router.push({ pathname: '/day/[date]', params: { date } });
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

  /** 套用模板；template 为 null 时标记「时间待定」。完成后可以撤销 */
  const applyTemplate = async (job: Job, template: ShiftTemplate | null) => {
    setPickerOpen(false);
    try {
      const dates = [...selected];
      const created = template
        ? await applyTemplateToDates(repos, template, dates)
        : await applyPendingToDates(repos, job, dates);
      exitBatch();
      toast(t('batch.done', { count: created.length }), {
        onUndo: async () => {
          for (const s of created) await repos.shifts.remove(s.id);
        },
      });
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const isCurrentMonth = month === currentMonth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, -1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable
          onPress={() => setMonth(currentMonth())}
          accessibilityRole="button"
          accessibilityHint={t('calendar.today')}>
          <Text style={styles.title}>{t('calendar.monthTitle', { year, month: monthNumber })}</Text>
        </Pressable>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <View style={styles.spacer} />
        {!isCurrentMonth && (
          <HeaderButton label={t('calendar.today')} onPress={() => setMonth(currentMonth())} />
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

      {batchMode ? (
        <Text style={styles.batchHint}>{t('batch.hint')}</Text>
      ) : (
        <>
          <StatsBar
            month={month}
            mode={settings.statsPeriod}
            wageDisplay={settings.wageDisplay}
            currency={settings.defaultCurrency}
            stats={statsData?.stats}
            onPress={() => router.push({ pathname: '/stats', params: { month } })}
          />
          {data && !data.hasJobs && (
            <View style={styles.onboarding}>
              <Text style={styles.onboardingTitle}>{t('home.onboardingTitle')}</Text>
              <Text style={styles.onboardingBody}>{t('home.onboardingBody')}</Text>
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
        selected={batchMode ? selected : undefined}
        onPressDay={onPressDay}
        onLongPressDay={(date) => (batchMode ? toggle(date) : startBatch(date))}
        onSwipe={(delta) => setMonth((m) => addMonths(m, delta))}
      />

      {batchMode && (
        <View style={styles.batchBar}>
          <Text style={styles.batchCount}>{t('batch.selected', { count: selected.size })}</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={selected.size === 0}
            accessibilityRole="button"
            style={[styles.applyButton, selected.size === 0 && styles.disabled]}>
            <Text style={styles.applyText}>{t('batch.apply')}</Text>
          </Pressable>
        </View>
      )}

      <TemplatePicker
        visible={pickerOpen}
        jobs={data?.hourlyJobs ?? []}
        templates={data?.templates ?? []}
        onSelect={applyTemplate}
        onClose={() => setPickerOpen(false)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 8,
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
  batchHint: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 13,
    paddingBottom: 6,
  },
  onboarding: {
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EAF3FE',
    gap: 6,
  },
  onboardingTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  onboardingBody: { fontSize: 13, color: colors.textMuted },
  onboardingButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 16,
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
  disabled: { opacity: 0.4 },
});
