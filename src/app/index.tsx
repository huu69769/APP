import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showMessage } from '@/components/confirm';
import { MonthCalendar, type DayBar } from '@/components/MonthCalendar';
import { StatsBar } from '@/components/StatsBar';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useData } from '@/data/DataProvider';
import { applyPendingToDates, applyTemplateToDates, sortShifts } from '@/data/shifts';
import { isTimed, jobPayType, type Job, type ShiftTemplate } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { useMonthStats } from '@/data/useStats';
import { monthGridRange } from '@/lib/calendar';
import { addMonths, currentMonth, today as getToday, type LocalDate } from '@/lib/date';
import { colors } from '@/theme/colors';

/**
 * 首页 = 统计栏 + 月历
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { settings, repos } = useData();
  const [month, setMonth] = useState(currentMonth());
  const today = getToday();
  const [year, monthNumber] = month.split('-').map(Number);

  // 批量排班
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<LocalDate>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data } = useQuery(
    async (r) => {
      const { from, to } = monthGridRange(month, settings.weekStart);
      const [shifts, jobs, templates, tasks] = await Promise.all([
        r.shifts.listByDateRange(from, to),
        r.jobs.listWithDeleted(),
        r.shift_templates.list(),
        r.tasks.list(),
      ]);
      const jobsById = new Map(jobs.map((j) => [j.id, j]));
      const bars = new Map<LocalDate, DayBar[]>();
      for (const s of sortShifts(shifts)) {
        const job = jobsById.get(s.jobId);
        const list = bars.get(s.date) ?? [];
        list.push({
          id: s.id,
          color: job?.color ?? colors.textMuted,
          label: job?.name ?? '',
          pending: !isTimed(s),
        });
        bars.set(s.date, list);
      }
      // 按件计酬的任务显示在截止日
      for (const task of tasks) {
        if (task.dueDate < from || task.dueDate > to) continue;
        const job = jobsById.get(task.jobId);
        const list = bars.get(task.dueDate) ?? [];
        list.push({
          id: task.id,
          color: job?.color ?? colors.textMuted,
          label: `${task.deliveredDate ? '✓' : t('calendar.ddl')} ${task.title}`,
          task: true,
        });
        bars.set(task.dueDate, list);
      }
      const activeJobs = jobs
        .filter((j) => !j.deletedAt && jobPayType(j) === 'hourly')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { bars, activeJobs, templates };
    },
    [month, settings.weekStart, t]
  );

  const { data: statsData } = useMonthStats(month);

  const onPressDay = (date: LocalDate) => {
    if (!batchMode) {
      router.push({ pathname: '/day/[date]', params: { date } });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const exitBatch = () => {
    setBatchMode(false);
    setSelected(new Set());
    setPickerOpen(false);
  };

  /** 套用模板；template 为 null 时标记「时间待定」 */
  const applyTemplate = async (job: Job, template: ShiftTemplate | null) => {
    setPickerOpen(false);
    try {
      const dates = [...selected];
      const created = template
        ? await applyTemplateToDates(repos, template, dates)
        : await applyPendingToDates(repos, job, dates);
      exitBatch();
      showMessage(t('batch.done', { count: created.length }));
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

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
        <Text style={styles.title}>{t('calendar.monthTitle', { year, month: monthNumber })}</Text>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <View style={styles.spacer} />
        <HeaderButton label={t('calendar.today')} onPress={() => setMonth(currentMonth())} />
        {!batchMode && (
          <>
            <HeaderButton label={t('home.batch')} onPress={() => setBatchMode(true)} />
            <HeaderButton label={t('home.jobs')} onPress={() => router.push('/jobs')} />
          </>
        )}
      </View>

      {batchMode ? (
        <Text style={styles.batchHint}>{t('batch.hint')}</Text>
      ) : (
        <StatsBar
          month={month}
          mode={settings.statsPeriod}
          wageDisplay={settings.wageDisplay}
          currency={settings.defaultCurrency}
          stats={statsData?.stats}
          onPress={() => router.push({ pathname: '/stats', params: { month } })}
        />
      )}

      <MonthCalendar
        month={month}
        weekStart={settings.weekStart}
        today={today}
        bars={data?.bars}
        selected={batchMode ? selected : undefined}
        onPressDay={onPressDay}
        onSwipe={(delta) => setMonth((m) => addMonths(m, delta))}
      />

      {batchMode && (
        <View style={styles.batchBar}>
          <Text style={styles.batchCount}>{t('batch.selected', { count: selected.size })}</Text>
          <HeaderButton label={t('common.cancel')} onPress={exitBatch} />
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
        jobs={data?.activeJobs ?? []}
        templates={data?.templates ?? []}
        onSelect={applyTemplate}
        onClose={() => setPickerOpen(false)}
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
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 4,
    paddingRight: 8,
  },
  navButton: { paddingHorizontal: 6, paddingVertical: 4 },
  navText: { fontSize: 24, color: colors.text },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  spacer: { flex: 1 },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  headerButtonText: { color: colors.primary, fontSize: 13 },
  batchHint: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 13,
    paddingBottom: 6,
  },
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
