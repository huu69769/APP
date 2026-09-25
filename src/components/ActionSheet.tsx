import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** 显示在前面的小色点（比如兼职颜色） */
  color?: string;
  /** 右边的灰色小字（比如时间） */
  detail?: string;
  /** 虚线边框的色点（时间待定） */
  dashed?: boolean;
}

/** 从底部弹出的选项列表 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheet}>
        {title && <Text style={styles.title}>{title}</Text>}
        <ScrollView style={styles.list}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {a.color && (
                <View
                  style={[
                    styles.dot,
                    a.dashed
                      ? { borderColor: a.color, borderWidth: 1.5, borderStyle: 'dashed' }
                      : { backgroundColor: a.color },
                  ]}
                />
              )}
              <Text style={styles.actionText}>{a.label}</Text>
              {a.detail && <Text style={styles.detail}>{a.detail}</Text>}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    gap: 4,
    maxHeight: '75%',
  },
  title: { fontSize: 14, color: colors.textMuted, paddingBottom: 4 },
  list: { flexGrow: 0 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  actionText: { flex: 1, fontSize: 17, color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  cancel: { alignItems: 'center', paddingTop: 14 },
  cancelText: { color: colors.primary, fontSize: 16 },
});
