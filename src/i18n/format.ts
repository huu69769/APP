import type { TFunction } from 'i18next';

import { splitMinutes } from '@/lib/time';

/** 分钟数 → "5小时30分" / "5時間30分" */
export function formatDuration(t: TFunction, totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  if (hours === 0) return t('duration.m', { minutes });
  if (minutes === 0) return t('duration.h', { hours });
  return t('duration.hm', { hours, minutes });
}
