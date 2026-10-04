import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ScreenContainer } from '@/components/ScreenContainer';
import { formatToday } from '@/i18n/format';
import { useSettingsStore } from '@/store/settingsStore';
import { iconSize, radius, spacing, useTheme } from '@/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('a11y.appLogo')}
          style={[styles.logo, { backgroundColor: colors.primary, borderColor: colors.gold }]}
        >
          <MaterialCommunityIcons name="om" size={iconSize.lg} color={colors.onPrimary} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="title">{t('app.name')}</AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('app.tagline')}
          </AppText>
        </View>
      </View>

      <View style={styles.today}>
        <AppText variant="label" color="goldText">
          {t('home.todayLabel')}
        </AppText>
        <AppText variant="subheading" testID="home-date">
          {formatToday(new Date(), language)}
        </AppText>
      </View>

      <EmptyState
        icon="hands-pray"
        badge={t('home.comingSoon')}
        title={t('home.emptyTitle')}
        body={t('home.emptyBody')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { gap: spacing.xxs },
});
