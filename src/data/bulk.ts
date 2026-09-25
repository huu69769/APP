import type { Repositories } from './repository';

export interface ItemRef {
  kind: 'shift' | 'event' | 'task' | 'anniversary';
  id: string;
}

const TABLE = {
  shift: 'shifts',
  event: 'events',
  task: 'tasks',
  anniversary: 'anniversaries',
} as const;

/**
 * 一次删除多条（班次、日程、项目）。返回撤销用的函数（把删掉的恢复回来）。
 */
export async function deleteItems(
  repos: Repositories,
  items: ItemRef[]
): Promise<() => Promise<void>> {
  for (const item of items) await repos[TABLE[item.kind]].remove(item.id);
  return async () => {
    for (const item of items) await repos[TABLE[item.kind]].restore(item.id);
  };
}
