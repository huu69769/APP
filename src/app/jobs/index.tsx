import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { jobPayType } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { formatMoney } from '@/lib/money';

/** 兼职列表 */
export default function JobsScreen() {
  const { t } = useTranslation();
  const { data: jobs } = useQuery((repos) => repos.jobs.list(), []);

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('jobs.title') }} />
      <Section>
        {jobs && jobs.length === 0 && <EmptyText>{t('jobs.empty')}</EmptyText>}
        {[...(jobs ?? [])]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((job) => (
            <ListRow
              key={job.id}
              color={job.color}
              title={job.name}
              subtitle={
                jobPayType(job) === 'piece'
                  ? `${t('jobs.pieceSubtitle')} · ${job.currency}`
                  : t('jobs.perHour', { amount: formatMoney(job.hourlyWage, job.currency) })
              }
              onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })}
            />
          ))}
      </Section>
      <Button
        title={t('jobs.add')}
        onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: 'new' } })}
      />
    </FormScreen>
  );
}
