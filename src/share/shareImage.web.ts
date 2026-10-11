import type Svg from 'react-native-svg';

/**
 * 网页版：把页面上的 SVG 画到 canvas，导出 PNG。
 * 浏览器支持分享文件（手机浏览器）就弹出分享面板，否则直接下载。
 */
export async function shareSvgImage(params: {
  svg: Svg | null;
  domId: string;
  width: number;
  height: number;
  fileName: string;
  dialogTitle: string;
}): Promise<void> {
  const { domId, width, height, fileName } = params;
  const el = document.getElementById(domId)?.querySelector('svg');
  if (!el) throw new Error('Image is not ready');
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to render image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export'))), 'image/png')
    );
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
