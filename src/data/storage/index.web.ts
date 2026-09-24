import type { StorageDriver } from './types';
import { WebDriver } from './webDriver';

/** 网页版使用浏览器存储（localStorage）。 */
export function createDefaultDriver(): StorageDriver {
  return new WebDriver();
}
