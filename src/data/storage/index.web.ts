import { DEMO_PREFIX } from '../demo';
import type { StorageDriver } from './types';
import { WebDriver } from './webDriver';

/** 网页版使用浏览器存储（localStorage）。演示模式（?demo=1）用另一块地方，不碰平时的数据。 */
export function createDefaultDriver(options: { demo?: boolean } = {}): StorageDriver {
  return options.demo ? new WebDriver(globalThis.localStorage, DEMO_PREFIX) : new WebDriver();
}
