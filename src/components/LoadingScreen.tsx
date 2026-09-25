import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useColors } from '@/theme';

export function LoadingScreen({ error }: { error?: Error }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error}>{t('common.loadFailed', { message: error.message })}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>{t('common.loading')}</Text>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  text: { color: colors.textMuted },
  error: { color: colors.danger, textAlign: 'center' },
}));
