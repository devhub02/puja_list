import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PujaCategory } from '@/db/types';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { PujaImage } from './PujaImage';

type Props = { category: PujaCategory; count: number; onPress: (category: PujaCategory) => void };

/** Home category tile: category artwork (or icon), name and how many pujas it holds right now. */
export function CategoryCard({ category, count, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const name = t(`categories.${category}`);
  const countText = count > 0 ? t('home.categoryCount', { count }) : t('home.categoryNone');
  return (
    <Pressable
      testID={`category-card-${category}`}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.categoryCard', { name, count: countText })}
      onPress={() => onPress(category)}
      android_ripple={{ color: colors.pressed }}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow(1),
      ]}
    >
      <PujaImage category={category} style={styles.image} />
      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {name}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {countText}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 84 },
  text: { padding: spacing.sm, gap: spacing.xxs, minHeight: 72 },
});
