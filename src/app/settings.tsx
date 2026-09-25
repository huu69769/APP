import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, Platform } from 'react-native';

import {
  Button,
  EmptyText,
  Field,
  FormScreen,
  ListRow,
  Section,
  Segmented,
} from '@/components/form';
import { useToast } from '@/components/Toast';
import { useBackup } from '@/backup/useBackup';
import { useData } from '@/data/DataProvider';
import { CURRENCIES } from '@/data/types';
import { dayjs } from '@/lib/date';
import {
  getPermission,
  notificationsSupported,
  requestPermission,
  sendTestNotification,
  type PermissionState,
} from '@/notifications';

/**
 * 设置：通用（语言、币种、每周起始日）、统计、节假日与农历、通知、备份、关于。
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { settings, updateSettings } = useData();
  const { exportBackup, importBackup } = useBackup();
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

      <Section title={t('settings.general')}>
        <Field label={t('settings.language')} hint={t('settings.languageHint')}>
          <Segmented
            options={[
              { value: 'zh', label: '中文' },
              { value: 'ja', label: '日本語' },
            ]}
            value={settings.language}
            onChange={(v) => updateSettings({ language: v })}
          />
        </Field>
        <Field label={t('settings.defaultCurrency')} hint={t('settings.defaultCurrencyHint')}>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
            value={settings.defaultCurrency}
            onChange={(v) => updateSettings({ defaultCurrency: v })}
          />
        </Field>
        <Field label={t('settings.weekStart')}>
          <Segmented
            options={[
              { value: 0, label: t('settings.weekSun') },
              { value: 1, label: t('settings.weekMon') },
            ]}
            value={settings.weekStart}
            onChange={(v) => updateSettings({ weekStart: v })}
          />
        </Field>
      </Section>

      <Section title={t('settings.statsSection')}>
        <Field label={t('stats.periodMode')}>
          <Segmented
            options={[
              { value: 'calendarMonth', label: t('stats.calendarMonth') },
              { value: 'payPeriod', label: t('stats.payPeriod') },
            ]}
            value={settings.statsPeriod}
            onChange={(v) => updateSettings({ statsPeriod: v })}
          />
        </Field>
        <Field label={t('stats.wageDisplay')}>
          <Segmented
            options={[
              { value: 'total', label: t('stats.wageTotal') },
              { value: 'split', label: t('stats.wageSplit') },
            ]}
            value={settings.wageDisplay}
            onChange={(v) => updateSettings({ wageDisplay: v })}
          />
        </Field>
      </Section>

      <Section title={t('settings.calendar')}>
        <Field label={t('settings.holidayMode')}>
          <Segmented
            options={[
              { value: 'cn', label: t('settings.modeCn') },
              { value: 'jp', label: t('settings.modeJp') },
              { value: 'both', label: t('settings.modeBoth') },
              { value: 'none', label: t('settings.modeNone') },
            ]}
            value={settings.holidayMode}
            onChange={(v) => updateSettings({ holidayMode: v })}
          />
        </Field>
        <Field label={t('settings.lunar')}>
          <Segmented
            options={[
              { value: 'show', label: t('settings.show') },
              { value: 'hide', label: t('settings.hide') },
            ]}
            value={settings.showLunar ? 'show' : 'hide'}
            onChange={(v) => updateSettings({ showLunar: v === 'show' })}
          />
        </Field>
        <EmptyText>{t('settings.legend')}</EmptyText>
        <EmptyText>{t('settings.holidaySource')}</EmptyText>
      </Section>

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
        {notificationsSupported && (
          <>
            <EmptyText>{t('settings.batteryTitle')}</EmptyText>
            <EmptyText>{t('settings.batteryBody')}</EmptyText>
          </>
        )}
      </Section>

      <Section title={t('settings.backup')}>
        <EmptyText>{t('settings.backupDesc')}</EmptyText>
        <ListRow
          title={
            settings.lastBackupAt
              ? t('settings.lastBackup', {
                  date: dayjs(settings.lastBackupAt).format('YYYY-MM-DD HH:mm'),
                })
              : t('settings.neverBacked')
          }
        />
        <Button title={t('settings.export')} onPress={exportBackup} />
        <Button variant="secondary" title={t('settings.import')} onPress={importBackup} />
        {Platform.OS === 'web' && <EmptyText>{t('settings.webDataNote')}</EmptyText>}
      </Section>

      <Section title={t('settings.about')}>
        <ListRow
          title={t('app.name')}
          right={t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
        />
      </Section>
    </FormScreen>
  );
}
