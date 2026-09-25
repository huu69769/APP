import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '@/theme';

const DURATION_MS = 4000;

interface ToastOptions {
  /** 传入时显示「撤销」按钮 */
  onUndo?: () => void | Promise<void>;
}

type ShowToast = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => {});

/**
 * 屏幕底部的短暂提示，比如「已添加 便利店 09:00–14:00  [撤销]」。
 * 几秒后自动消失。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    onUndo?: ToastOptions['onUndo'];
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((message, options) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, onUndo: options?.onUndo });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const undo = async () => {
    const fn = toast?.onUndo;
    setToast(null);
    if (fn) {
      await fn();
      show(t('toast.undone'));
    }
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 24 }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.onUndo && (
              <Pressable onPress={undo} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.undo}>{t('toast.undo')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.toastBg,
  },
  text: { flexShrink: 1, color: colors.toastText, fontSize: 14 },
  undo: { color: colors.toastAction, fontSize: 14, fontWeight: '700' },
}));
