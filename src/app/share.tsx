import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import type Svg from 'react-native-svg';

import { showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Section, Segmented } from '@/components/form';
import { useData } from '@/data/DataProvider';
import { useQuery } from '@/data/useQuery';
import { addMonths, currentMonth, type YearMonth } from '@/lib/date';
import { calendarMonthRange } from '@/lib/period';
import { SHARE_WIDTH, ShareCard, shareHeight, shareWeeks } from '@/share/ShareCard';
import { shareSvgImage } from '@/share/shareImage';
import { makeStyles } from '@/theme';

const DOM_ID = 'share-card';

/** 分享打工日程：生成这个月的月历图片（只有班次，没有工资和日程），发给朋友 */
export default function ShareScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const params = useLocalSearchParams<{ month?: string }>();
  const { settings } = useData();
  const [month, setMonth] = useState<YearMonth>(
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth()
  );
  const [showNames, setShowNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<Svg>(null);

  const { data } = useQuery(
    async (r) => {
      const range = calendarMonthRange(month);
      const [shifts, jobs] = await Promise.all([
        r.shifts.listByDateRange(range.from, range.to),
        r.jobs.listWithDeleted(),
      ]);
      return { shifts, jobsById: new Map(jobs.map((j) => [j.id, j])) };
    },
    [month]
  );

  const [y, m] = month.split('-').map(Number);
  const weeks = shareWeeks(month, settings.weekStart).length;
  const height = shareHeight(weeks);
  const workDays = new Set(data?.shifts.map((s) => s.date)).size;

  const share = async () => {
    setBusy(true);
    try {
      await shareSvgImage({
        svg: svgRef.current,
        domId: DOM_ID,
        width: SHARE_WIDTH,
        height,
        fileName: `shift-${month}.png`,
        dialogTitle: t('share.title'),
      });
    } catch (e) {
      showMessage(t('share.failed', { message: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('share.title') }} />
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setMonth(addMonths(month, -1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}
          style={styles.nav}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{t('calendar.monthTitle', { year: y, month: m })}</Text>
        <Pressable
          onPress={() => setMonth(addMonths(month, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}
          style={styles.nav}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <Section>
        <Field label={t('share.nameLabel')} hint={t('share.privacy')}>
          <Segmented
            options={[
              { value: 'show', label: t('share.showNames') },
              { value: 'hide', label: t('share.hideNames') },
            ]}
            value={showNames ? 'show' : 'hide'}
            onChange={(v) => setShowNames(v === 'show')}
          />
        </Field>
      </Section>

      {data && (
        <View nativeID={DOM_ID} style={[styles.preview, { aspectRatio: SHARE_WIDTH / height }]}>
          <ShareCard
            ref={svgRef}
            month={month}
            weekStart={settings.weekStart}
            shifts={data.shifts}
            jobsById={data.jobsById}
            showNames={showNames}
            texts={{
              title: t('share.cardTitle', { year: y, month: m }),
              subtitle: t('share.cardSubtitle', { count: workDays }),
              weekdays: t('calendar.weekdaysShort', { returnObjects: true }) as string[],
              work: t('share.work'),
              pending: t('share.pending'),
              more: (n) => t('calendar.more', { count: n }),
              footer: t('app.name'),
            }}
          />
        </View>
      )}
      {data && data.shifts.length === 0 && <EmptyText>{t('share.empty')}</EmptyText>}

      <Button
        title={t('share.button')}
        onPress={share}
        disabled={busy || !data || data.shifts.length === 0}
      />
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nav: { paddingHorizontal: 12, paddingVertical: 4 },
  navText: { fontSize: 24, color: colors.text },
  monthTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  preview: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
