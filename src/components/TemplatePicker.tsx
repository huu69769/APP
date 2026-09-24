import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Job, ShiftTemplate } from '@/data/types';
import { colors } from '@/theme/colors';

import { EmptyText, ListRow } from './form';

/** 从底部弹出的模板选择列表（批量排班用） */
export function TemplatePicker({
  visible,
  jobs,
  templates,
  onSelect,
  onClose,
}: {
  visible: boolean;
  jobs: Job[];
  templates: ShiftTemplate[];
  onSelect: (template: ShiftTemplate) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rows = jobs.flatMap((job) =>
    templates
      .filter((tpl) => tpl.jobId === job.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((tpl) => ({ job, tpl }))
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('batch.chooseTemplate')}</Text>
        <ScrollView style={styles.list}>
          {rows.length === 0 && <EmptyText>{t('batch.noTemplates')}</EmptyText>}
          {rows.map(({ job, tpl }) => (
            <ListRow
              key={tpl.id}
              color={job.color}
              title={`${job.name} · ${tpl.name}`}
              subtitle={`${tpl.startTime} – ${tpl.endTime}`}
              onPress={() => onSelect(tpl)}
            />
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    maxHeight: '70%',
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  list: { flexGrow: 0 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: colors.primary, fontSize: 16 },
});
