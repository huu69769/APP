import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { anniversaryStatusText } from '@/components/anniversaryText';
import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import type { Anniversary } from '@/data/types';
import { useQuery } from '@/data/useQuery';
import { anniversaryStatus, daysSince, type AnniversaryStatus } from '@/lib/anniversary';
import { today as getToday, parseLocalDate } from '@/lib/date';
import { lunarInfo } from '@/lib/lunar';

/** 纪念日列表：近的在上面；不重复、已经过去的放在最下面 */
export default function AnniversariesScreen() {
  const { t } = useTranslation();
  const today = getToday();

  const { data } = useQuery(
    async (r) => {
      const rows = (await r.anniversaries.list()).map((a) => ({
        a,
        status: anniversaryStatus(a, today),
      }));
      const days = (s: AnniversaryStatus) => (s.kind === 'until' ? s.days : 0);
      return {
        upcoming: rows
          .filter((x) => x.status.kind !== 'since')
          .sort((x, y) => days(x.status) - days(y.status)),
        passed: rows
          .filter((x) => x.status.kind === 'since')
          .sort((x, y) => y.a.date.localeCompare(x.a.date)),
      };
    },
    [today]
  );

  const dateText = (a: Anniversary) => {
    const d = parseLocalDate(a.date);
    if (!a.repeat) return a.date;
    if (a.lunar)
      return t('anniv.everyYearLunar', { date: lunarInfo(a.date).date.replace('闰', '') });
    return t('anniv.everyYear', {
      date: t('calendar.dayLabel', { month: d.month() + 1, day: d.date() }),
    });
  };

  const subtitle = (a: Anniversary) => {
    const since = a.repeat ? daysSince(a, today) : null;
    return [
      dateText(a),
      since ? t('anniv.totalDays', { count: since }) : null,
      a.pinned ? t('anniv.pinnedShort') : null,
      a.note || null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const open = (a: Anniversary) =>
    router.push({ pathname: '/anniversaries/[id]', params: { id: a.id } });

  return (
    <FormScreen>
      <Section>
        {data && data.upcoming.length + data.passed.length === 0 && (
          <EmptyText>{t('anniv.empty')}</EmptyText>
        )}
        {data?.upcoming.map(({ a, status }) => (
          <ListRow
            key={a.id}
            color={a.color}
            title={a.title}
            subtitle={subtitle(a)}
            right={anniversaryStatusText(t, status)}
            onPress={() => open(a)}
          />
        ))}
      </Section>
      <Button
        title={t('anniv.add')}
        onPress={() => router.push({ pathname: '/anniversaries/[id]', params: { id: 'new' } })}
      />
      {data && data.passed.length > 0 && (
        <Section title={t('anniv.passedSection')}>
          {data.passed.map(({ a, status }) => (
            <ListRow
              key={a.id}
              color={a.color}
              title={a.title}
              subtitle={subtitle(a)}
              right={anniversaryStatusText(t, status)}
              onPress={() => open(a)}
            />
          ))}
        </Section>
      )}
    </FormScreen>
  );
}
