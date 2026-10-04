import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = { title: string; description?: string };

export function SectionHeader({ title, description }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="subheading" accessibilityRole="header">
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySmall" color="textSecondary">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
});
