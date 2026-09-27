import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { FormScreen } from '@/components/form';
import { makeStyles, useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** 使用指南：每个功能一行标题 + 一行操作路径；点一下展开大白话的详细说明 */
const STEPS: { key: string; icon: IconName }[] = [
  { key: 'job', icon: 'briefcase-outline' },
  { key: 'shift', icon: 'add-circle-outline' },
  { key: 'recurring', icon: 'repeat-outline' },
  { key: 'batch', icon: 'checkbox-outline' },
  { key: 'week', icon: 'calendar-outline' },
  { key: 'income', icon: 'stats-chart-outline' },
  { key: 'savings', icon: 'wallet-outline' },
  { key: 'anniversary', icon: 'gift-outline' },
  { key: 'backup', icon: 'cloud-download-outline' },
];

export default function GuideScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  // 一次只展开一条
  const [open, setOpen] = useState<string | null>(null);
  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('guide.title') }} />
      <Text style={styles.hint}>{t('guide.tapHint')}</Text>
      {STEPS.map(({ key, icon }, i) => {
        const isOpen = open === key;
        return (
          <Pressable
            key={key}
            onPress={() => setOpen(isOpen ? null : key)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>
                  {i + 1}. {t(`guide.${key}.title`)}
                </Text>
                <Text style={styles.how}>{t(`guide.${key}.how`)}</Text>
              </View>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            {isOpen && (
              <View style={styles.details}>
                {t(`guide.${key}.detail`)
                  .split('\n')
                  .map((line, j) => (
                    <Text key={j} style={styles.detail}>
                      {line}
                    </Text>
                  ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  details: { gap: 8, paddingLeft: 54 },
  detail: { fontSize: 14, lineHeight: 21, color: colors.text },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  how: { fontSize: 13, color: colors.textMuted },
}));
