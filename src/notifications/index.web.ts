/**
 * 网页版不发送通知（PRD 5.9）。所有函数都什么也不做。
 */
export const notificationsSupported = false;

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface ScheduledNotification {
  id: string;
  at: Date;
  title: string;
  body: string;
}

export async function initNotifications(_channelName: string): Promise<void> {}

export async function getPermission(): Promise<PermissionState> {
  return 'unsupported';
}

export async function requestPermission(): Promise<boolean> {
  return false;
}

export async function replaceScheduled(_items: ScheduledNotification[]): Promise<void> {}

export async function sendTestNotification(_title: string, _body: string): Promise<void> {}
