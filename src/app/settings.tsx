import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking } from 'react-native';

import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { useToast } from '@/components/Toast';
import {
  getPermission,
  notificationsSupported,
  requestPermission,
  sendTestNotification,
  type PermissionState,
} from '@/notifications';

/**
 * 设置。M4：通知（权限、测试、省电模式说明）。
 * M6 会加上语言、币种、统计周期、备份等。
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => {
    getPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    // 从系统设置回来时刷新状态
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const statusText = {
    granted: t('settings.statusGranted'),
    denied: t('settings.statusDenied'),
    undetermined: t('settings.statusUndetermined'),
    unsupported: t('settings.statusUnsupported'),
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Section title={t('settings.notifications')}>
        {permission && (
          <ListRow
            title={statusText[permission]}
            right={permission === 'granted' ? '✓' : undefined}
          />
        )}
        {permission === 'undetermined' && (
          <Button
            title={t('settings.allow')}
            onPress={async () => {
              await requestPermission();
              refresh();
            }}
          />
        )}
        {permission === 'denied' && (
          <Button
            variant="secondary"
            title={t('settings.openSystem')}
            onPress={() => Linking.openSettings()}
          />
        )}
        {permission === 'granted' && (
          <Button
            variant="secondary"
            title={t('settings.test')}
            onPress={async () => {
              await sendTestNotification(t('settings.testTitle'), t('settings.testBody'));
              toast(t('settings.testSent'));
            }}
          />
        )}
      </Section>
      {notificationsSupported && (
        <Section title={t('settings.batteryTitle')}>
          <EmptyText>{t('settings.batteryBody')}</EmptyText>
          <Button
            variant="secondary"
            title={t('settings.openSystem')}
            onPress={() => Linking.openSettings()}
          />
        </Section>
      )}
      <EmptyText>{t('settings.moreLater')}</EmptyText>
    </FormScreen>
  );
}
