import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { getCategoryImage, getPujaImage } from '@/theme/images';
import { iconSize } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { categoryIcon } from '@/utils/pujaDisplay';
import type { PujaCategory } from '@/db/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  /** Puja artwork first, then its category's artwork, then a vector icon. */
  pujaId?: string;
  category?: PujaCategory;
  style?: StyleProp<ViewStyle>;
};

/** Decorative artwork (the name is always printed next to it). Never throws on a missing image. */
export function PujaImage({ pujaId, category, style }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const source = failed
    ? null
    : pujaId
      ? getPujaImage(pujaId, category)
      : getCategoryImage(category);
  const icon = (category ? categoryIcon[category] : 'hands-pray') as IconName;

  return (
    <View
      style={[styles.box, { backgroundColor: colors.primaryTint }, style]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {source ? (
        <Image
          source={source}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <MaterialCommunityIcons name={icon} size={iconSize.hero} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
