import { Alert } from 'react-native';

/** 确认对话框（手机版）。网页版见 confirm.web.ts */
export function confirmAsync(options: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmText,
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function showMessage(title: string, message?: string): void {
  Alert.alert(title, message);
}
