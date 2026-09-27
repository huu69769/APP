import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { Account, Currency } from '@/data/types';

/**
 * 在计划 / 存入页面里「＋ 新建账户」：打开新建账户页面，建好回来后自动选中新账户。
 * 做法：打开前记下已有的账户，回来后列表里多出来的那个就是新建的。
 */
export function useNewAccount(
  accounts: Pick<Account, 'id'>[] | undefined,
  select: (id: string) => void
): (currency: Currency) => void {
  const before = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!before.current || !accounts) return;
    const added = accounts.find((a) => !before.current!.has(a.id));
    if (added) {
      before.current = null;
      select(added.id);
    }
  }, [accounts, select]);

  return (currency: Currency) => {
    before.current = new Set((accounts ?? []).map((a) => a.id));
    router.push({ pathname: '/accounts/[id]', params: { id: 'new', currency } });
  };
}
