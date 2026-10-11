import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type Svg from 'react-native-svg';

/**
 * 手机上：把分享卡片（SVG）转成 PNG，写到临时文件，再用系统的分享面板发出去（LINE、微信等）。
 * 网页版见 shareImage.web.ts（下载图片）。
 */
export async function shareSvgImage(params: {
  svg: Svg | null;
  domId: string;
  width: number;
  height: number;
  fileName: string;
  dialogTitle: string;
}): Promise<void> {
  const { svg, width, height, fileName, dialogTitle } = params;
  if (!svg) throw new Error('Image is not ready');
  const base64 = await new Promise<string>((resolve) => svg.toDataURL(resolve, { width, height }));
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
}
