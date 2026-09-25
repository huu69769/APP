import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useData } from '@/data/DataProvider';
import { addDays, parseLocalDate, today } from '@/lib/date';
import { computeReminders, REMINDER_HORIZON_DAYS, type Reminder } from '@/lib/reminders';
import {
  getPermission,
  initNotifications,
  notificationsSupported,
  replaceScheduled,
} from '@/notifications';

const DEBOUNCE_MS = 800;

/**
 * 数据有变化时（新增、修改、删除），重新安排所有提醒。
 * 不显示任何东西，放在 app 最外层即可。网页版什么都不做。
 */
export function ReminderSync() {
  const { t, i18n } = useTranslation();
  const { repos, dataVersion } = useData();
  // App 回到前台时也重新安排（比如刚在系统设置里打开了通知、或者过了一天）
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setWake((w) => w + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!notificationsSupported) return;
    initNotifications(t('reminder.channelName')).catch(() => {});
  }, [t]);

  useEffect(() => {
    if (!notificationsSupported) return;
    const timer = setTimeout(async () => {
      try {
        if ((await getPermission()) !== 'granted') return;
        const from = addDays(today(), -1);
        const to = addDays(today(), REMINDER_HORIZON_DAYS + 1);
        const [shifts, events, tasks, jobs] = await Promise.all([
          repos.shifts.listByDateRange(from, to),
          repos.events.listByDateRange(from, to),
          repos.tasks.list(),
          repos.jobs.listWithDeleted(),
        ]);
        const reminders = computeReminders({
          shifts,
          events,
          tasks,
          jobNames: new Map(jobs.map((j) => [j.id, j.name])),
          now: new Date(),
        });
        await replaceScheduled(reminders.map((r) => ({ id: r.id, at: r.at, ...format(r) })));
      } catch {
        // 安排提醒失败不影响使用，下次数据变化时会再试
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);

    function format(r: Reminder): { title: string; body: string } {
      const d = parseLocalDate(r.date);
      const date = t('calendar.dayLabel', { month: d.month() + 1, day: d.date() });
      if (r.kind === 'task') {
        return {
          title: t('reminder.taskTitle', { title: r.title }),
          body: t('reminder.taskBody', { date }),
        };
      }
      const title =
        r.kind === 'shift' && r.time ? `${r.title} ${r.time}–${r.endTime ?? ''}` : r.title;
      return {
        title,
        body: r.time
          ? t('reminder.startsAt', { date, time: r.time })
          : t('reminder.allDayBody', { date }),
      };
    }
  }, [repos, dataVersion, wake, t, i18n.language]);

  return null;
}
