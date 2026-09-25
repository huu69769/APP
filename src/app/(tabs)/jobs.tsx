import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmAsync } from '@/components/confirm';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { useData } from '@/data/DataProvider';
import { jobPayType, type Job } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { isStale, lastActivityByJob } from '@/lib/activity';
import { today as getToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme/colors';

/** 工作列表：进行中在上，已结束的折叠在最下面 */
export default function JobsScreen() {
  const { t } = useTranslation();
  const { repos } = useData();
  const [showEnded, setShowEnded] = useState(false);
  const today = getToday();

  const { data } = useQuery(
    async (r) => {
      const [jobs, tasks, shifts] = await Promise.all([
        r.jobs.list(),
        r.tasks.list(),
        r.shifts.list(),
      ]);
      const last = lastActivityByJob([
        ...shifts.map((s) => ({ jobId: s.jobId, date: s.date })),
        ...tasks.map((x) => ({ jobId: x.jobId, date: x.dueDate })),
      ]);
      // 客户：项目数、下一个 DDL
      const projectInfo = new Map<string, { count: number; nextDue: string | null }>();
      for (const task of tasks) {
        const info = projectInfo.get(task.jobId) ?? { count: 0, nextDue: null };
        info.count++;
        if (task.dueDate >= today && (!info.nextDue || task.dueDate < info.nextDue)) {
          info.nextDue = task.dueDate;
        }
        projectInfo.set(task.jobId, info);
      }
      const byCreated = (a: Job, b: Job) => a.createdAt.localeCompare(b.createdAt);
      return {
        active: jobs.filter((j) => !j.endedAt).sort(byCreated),
        ended: jobs
          .filter((j) => j.endedAt)
          .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? '')),
        last,
        projectInfo,
      };
    },
    [today]
  );

  const subtitle = (job: Job) => {
    if (jobPayType(job) === 'hourly') {
      return t('jobs.perHour', { amount: formatMoney(job.hourlyWage, job.currency) });
    }
    const info = data?.projectInfo.get(job.id);
    return [
      t('jobs.pieceSubtitle'),
      t('jobs.projectsCount', { count: info?.count ?? 0 }),
      info?.nextDue ? t('jobs.nextDue', { date: info.nextDue }) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const endJob = async (job: Job) => {
    const ok = await confirmAsync({
      title: t('jobs.endTitle'),
      message: t('jobs.endMessage'),
      confirmText: t('jobs.endAction'),
      cancelText: t('common.cancel'),
    });
    if (ok) await repos.jobs.update(job.id, { endedAt: today });
  };

  const open = (job: Job) => router.push({ pathname: '/jobs/[id]', params: { id: job.id } });

  return (
    <FormScreen>
      <Section title={data && data.ended.length > 0 ? t('jobs.activeSection') : undefined}>
        {data && data.active.length === 0 && <EmptyText>{t('jobs.empty')}</EmptyText>}
        {data?.active.map((job) => {
          const stale = isStale({
            createdAt: job.createdAt,
            lastActivity: data.last.get(job.id) ?? null,
            today,
          });
          return (
            <View key={job.id}>
              <ListRow
                color={job.color}
                title={job.name}
                subtitle={subtitle(job)}
                onPress={() => open(job)}
              />
              {stale && (
                <View style={styles.stale}>
                  <Text style={styles.staleText}>{t('jobs.staleHint')}</Text>
                  <Pressable onPress={() => endJob(job)} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.staleAction}>{t('jobs.endAction')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </Section>

      <Button
        title={t('jobs.add')}
        onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: 'new' } })}
      />

      {data && data.ended.length > 0 && (
        <Section>
          <Pressable
            onPress={() => setShowEnded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showEnded }}>
            <Text style={styles.endedToggle}>
              {showEnded ? '▾' : '▸'} {t('jobs.endedSection', { count: data.ended.length })}
            </Text>
          </Pressable>
          {showEnded &&
            data.ended.map((job) => (
              <ListRow
                key={job.id}
                color={colors.textFaint}
                title={job.name}
                subtitle={t('jobs.endedOn', { date: job.endedAt })}
                onPress={() => open(job)}
              />
            ))}
        </Section>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stale: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 18,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.warningBg,
  },
  staleText: { fontSize: 12, color: colors.warningText, flexShrink: 1 },
  staleAction: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  endedToggle: { fontSize: 15, color: colors.textMuted },
});
