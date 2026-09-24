import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { primaryTask } from '@/data/tasks';
import { jobPayType, type Job } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatMoney } from '@/lib/money';

/** 兼职列表 */
export default function JobsScreen() {
  const { t } = useTranslation();
  const { data } = useQuery(async (repos) => {
    const [jobs, tasks] = await Promise.all([repos.jobs.list(), repos.tasks.list()]);
    const projects = new Map(jobs.map((j) => [j.id, primaryTask(tasks, j.id)]));
    // 时薪兼职在前；项目按「进行中（截止日早的在前）→ 已交付」排列
    const rank = (j: Job) => {
      if (jobPayType(j) === 'hourly') return `0 ${j.createdAt}`;
      const p = projects.get(j.id);
      return p?.deliveredDate ? `2 ${p.deliveredDate}` : `1 ${p?.dueDate ?? ''}`;
    };
    return { jobs: [...jobs].sort((a, b) => rank(a).localeCompare(rank(b))), projects };
  }, []);
  const jobs = data?.jobs;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('jobs.title') }} />
      <Section>
        {jobs && jobs.length === 0 && <EmptyText>{t('jobs.empty')}</EmptyText>}
        {jobs?.map((job) => {
          const project = data?.projects.get(job.id);
          return (
            <ListRow
              key={job.id}
              color={job.color}
              title={job.name}
              subtitle={
                jobPayType(job) === 'piece'
                  ? [
                      t('jobs.pieceSubtitle'),
                      project ? `${t('day.taskDue')} ${project.dueDate}` : null,
                      project?.deliveredDate ? t('task.delivered') : t('task.open'),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t('jobs.perHour', { amount: formatMoney(job.hourlyWage, job.currency) })
              }
              right={project ? formatMoney(project.amount, project.currency) : undefined}
              onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })}
            />
          );
        })}
      </Section>
      <Button
        title={t('jobs.add')}
        onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: 'new' } })}
      />
    </FormScreen>
  );
}
