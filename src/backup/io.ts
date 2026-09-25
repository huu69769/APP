import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * 手机上：把备份写到临时文件，再用安卓的「分享」保存到文件夹、网盘或发给自己。
 * 网页版见 io.web.ts（直接下载）。
 */
export async function saveBackupFile(fileName: string, text: string, dialogTitle: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle,
    UTI: 'public.json',
  });
}

/** 选择一个备份文件并读出内容；取消返回 null */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return new File(result.assets[0].uri).text();
}
