import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 本地通知（手机版）。网页版见 index.web.ts：什么都不做。
 *
 * 提醒的安排方式：每次数据变化后，取消全部已安排的通知，再按当前数据重新安排
 * （见 ReminderSync）。这样修改、删除班次或日程时，提醒一定是同步的。
 */
export const notificationsSupported = true;

const CHANNEL_ID = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function initNotifications(channelName: string): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** 申请通知权限（Android 13 及以上会弹出系统对话框） */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export interface ScheduledNotification {
  id: string;
  at: Date;
  title: string;
  body: string;
}

/** 取消全部已安排的提醒，按给定列表重新安排 */
export async function replaceScheduled(items: ScheduledNotification[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of items) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** 5 秒后发一条测试通知 */
export async function sendTestNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'test',
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CHANNEL_ID,
    },
  });
}
