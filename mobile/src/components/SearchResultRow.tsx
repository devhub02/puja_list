import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconSize, minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  pujaId: string;
  title: string;
  subtitle?: string;
  icon: 'hands-pray' | 'flower-tulip-outline';
  onOpen: (pujaId: string) => void;
};

/** One search suggestion/result. Always opens the puja; a samagri match says which puja contains it. */
function SearchResultRowBase({ pujaId, title, subtitle, icon, onOpen }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`search-result-${pujaId}`}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => onOpen(pujaId)}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.pressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primaryTint }]}>
        <MaterialCommunityIcons
          name={icon}
          size={iconSize.md}
          color={colors.primary}
          importantForAccessibility="no"
        />
      </View>
      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={iconSize.md}
        color={colors.textSecondary}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

export const SearchResultRow = memo(SearchResultRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
