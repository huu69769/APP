import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import { useToast } from '@/components/Toast';
import { useData } from '@/data/DataProvider';
import {
  BackupError,
  backupFileName,
  countBackup,
  parseBackup,
  serializeBackup,
} from '@/lib/backup';
import { nowIso } from '@/lib/date';

import { pickBackupFile, saveBackupFile } from './io';

/** 导出 / 导入备份（设置页和首页提示共用） */
export function useBackup() {
  const { t } = useTranslation();
  const toast = useToast();
  const { driver, updateSettings, replaceAllData } = useData();

  const exportBackup = async () => {
    try {
      const now = new Date();
      // 先记下备份时间，这样导出的文件里也带着它
      await updateSettings({ lastBackupAt: nowIso(now) });
      const text = serializeBackup(await driver.exportAll(), now);
      await saveBackupFile(backupFileName(now), text, t('settings.export'));
      toast(t('settings.exportDone'));
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const importBackup = async () => {
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const dump = parseBackup(text);
      const ok = await confirmAsync({
        title: t('settings.importTitle'),
        message: t('settings.importMessage', countBackup(dump)),
        confirmText: t('settings.importConfirm'),
        cancelText: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
      await replaceAllData(dump);
      // 刚恢复的数据就等于这份备份
      await updateSettings({ lastBackupAt: nowIso() });
      toast(t('settings.importDone'));
    } catch (e) {
      const message =
        e instanceof BackupError
          ? t(`settings.importError.${e.code}`)
          : t('settings.importError.other', { message: String(e) });
      showMessage(message);
    }
  };

  return { exportBackup, importBackup };
}
