import type { TFunction } from 'i18next';

import type { AnniversaryStatus } from '@/lib/anniversary';

/** 「还有 12 天 · 56 周年」「就是今天」「已经 5 天」 */
export function anniversaryStatusText(t: TFunction, s: AnniversaryStatus): string {
  if (s.kind === 'since') return t('anniv.since', { count: s.days });
  const main = s.kind === 'today' ? t('anniv.today') : t('anniv.until', { count: s.days });
  return s.years > 0 ? `${main} · ${t('anniv.years', { count: s.years })}` : main;
}
