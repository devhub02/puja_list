import { ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  /** true (default) = a single-choice group of chips; false = independent on/off shortcuts. */
  radio?: boolean;
  children: ReactNode;
};

/** A labelled, horizontally scrolling row of filter chips. */
export function ChipRow({ label, radio = true, children }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.group}
      accessibilityRole={radio ? 'radiogroup' : undefined}
      accessibilityLabel={t('a11y.filterGroup', { name: label })}
    >
      <AppText variant="label" color="goldText">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xxs },
  chips: { gap: spacing.xs, paddingVertical: 2, paddingRight: spacing.md },
});
