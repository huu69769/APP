import * as DocumentPicker from 'expo-document-picker';

/** 网页版：直接下载备份文件（网页版的数据和手机上是分开的） */
export async function saveBackupFile(fileName: string, text: string, _dialogTitle: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '.json'] });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}
