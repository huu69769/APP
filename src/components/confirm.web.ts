/** 网页版：react-native-web 的 Alert 不会显示，所以用浏览器自带的对话框 */
export function confirmAsync(options: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}): Promise<boolean> {
  const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return Promise.resolve(window.confirm(text));
}

export function showMessage(title: string, message?: string): void {
  window.alert(message ? `${title}\n\n${message}` : title);
}
