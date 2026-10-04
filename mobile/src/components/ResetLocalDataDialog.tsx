import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Dialog } from './Dialog';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  busy: boolean;
  /** Translated error from a failed attempt, if any. */
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * The confirmation for "Reset local data". It lists exactly what will and will not be deleted, and the
 * confirm button stays disabled until the user types the word shown (hard to trigger by accident).
 */
export function ResetLocalDataDialog({ visible, busy, error, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const word = t('settings.reset.typeWord');
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === word.toLowerCase();
  const deletes = t('settings.reset.deletes', { returnObjects: true }) as unknown as string[];
  const keeps = t('settings.reset.keeps', { returnObjects: true }) as unknown as string[];

  const close = () => {
    setTyped('');
    onClose();
  };

  return (
    <Dialog
      testID="reset-data-dialog"
      visible={visible}
      title={t('settings.reset.confirmTitle')}
      onClose={close}
      actions={[
        {
          label: t('settings.reset.confirm'),
          variant: 'primary',
          icon: 'trash-can-outline',
          testID: 'reset-data-confirm',
          disabled: !matches || busy,
          onPress: () => {
            if (matches && !busy) onConfirm();
          },
        },
        { label: t('common.cancel'), testID: 'reset-data-cancel', onPress: close },
      ]}
    >
      <View style={styles.list}>
        <AppText variant="subheading" accessibilityRole="header">
          {t('settings.reset.deletesTitle')}
        </AppText>
        {deletes.map((line) => (
          <AppText key={line} testID="reset-deletes-item">{`• ${line}`}</AppText>
        ))}
      </View>
      <View style={styles.list}>
        <AppText variant="subheading" accessibilityRole="header">
          {t('settings.reset.keepsTitle')}
        </AppText>
        {keeps.map((line) => (
          <AppText key={line} testID="reset-keeps-item">{`• ${line}`}</AppText>
        ))}
      </View>
      <AppText>{t('settings.reset.typePrompt', { word })}</AppText>
      <TextField
        testID="reset-data-input"
        label={t('settings.reset.typeField', { word })}
        value={typed}
        onChangeText={setTyped}
        error={error ?? undefined}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xxs },
});
