import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/** 从底部弹出的选项列表 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: { label: string; onPress: () => void }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheet}>
        {title && <Text style={styles.title}>{title}</Text>}
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  title: { fontSize: 14, color: colors.textMuted, paddingBottom: 4 },
  action: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.5 },
  actionText: { fontSize: 17, color: colors.text },
  cancel: { alignItems: 'center', paddingTop: 14 },
  cancelText: { color: colors.primary, fontSize: 16 },
});
