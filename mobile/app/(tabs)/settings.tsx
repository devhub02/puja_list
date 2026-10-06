import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AdsPrivacySettings } from '@/components/AdsPrivacySettings';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NotificationsSettings } from '@/components/NotificationsSettings';
import { PrivacyPolicyRow } from '@/components/PrivacyPolicyRow';
import { ResetLocalDataDialog } from '@/components/ResetLocalDataDialog';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { SegmentOption } from '@/components/SegmentedControl';
import { useOptionalDatabase } from '@/db/DatabaseProvider';
import { useContentInfo } from '@/db/useContentInfo';
import { useResetLocalData } from '@/hooks/useResetLocalData';
import { languageCodes, languages } from '@/i18n/registry';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing, textSizeOrder, themeModes, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const contentInfo = useContentInfo();
  const language = useSettingsStore((s) => s.language);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const textSize = useSettingsStore((s) => s.textSize);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const { colors } = useTheme();
  const db = useOptionalDatabase();
  const reset = useResetLocalData();

  const languageOptions = languageCodes.map((code) => ({
    value: code,
    label: languages[code].nativeName,
  }));
  const themeOptions: SegmentOption<(typeof themeModes)[number]>[] = themeModes.map((mode) => ({
    value: mode,
    label: t(`settings.theme.${mode}`),
  }));
  const sizeOptions: SegmentOption<(typeof textSizeOrder)[number]>[] = textSizeOrder.map(
    (size) => ({
      value: size,
      label: t(`settings.textSize.${size}`),
    }),
  );

  return (
    <ScreenContainer>
      <AppText variant="title">{t('settings.title')}</AppText>

      <View style={styles.section}>
        <SectionHeader
          title={t('settings.language.title')}
          description={t('settings.language.description')}
        />
        <SegmentedControl
          testIDPrefix="language"
          accessibilityLabel={t('settings.language.title')}
          options={languageOptions}
          value={language}
          onChange={setLanguage}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.appearance.title')} />
        <AppText variant="bodySmall" color="textSecondary">
          {t('settings.theme.title')}
        </AppText>
        <SegmentedControl
          testIDPrefix="theme"
          accessibilityLabel={t('settings.theme.title')}
          options={themeOptions}
          value={themeMode}
          onChange={setThemeMode}
        />
        <AppText variant="bodySmall" color="textSecondary" style={styles.subLabel}>
          {t('settings.textSize.title')}
        </AppText>
        <SegmentedControl
          testIDPrefix="textsize"
          accessibilityLabel={t('settings.textSize.title')}
          options={sizeOptions}
          value={textSize}
          onChange={setTextSize}
        />
        <Card tone="alt" style={styles.preview}>
          <AppText variant="label" color="goldText">
            {t('settings.preview.title')}
          </AppText>
          <AppText variant="heading" testID="preview-heading">
            {t('settings.preview.heading')}
          </AppText>
          <AppText testID="preview-body">{t('settings.preview.body')}</AppText>
        </Card>
      </View>

      {db ? <NotificationsSettings /> : null}

      <View style={styles.section}>
        <SectionHeader title={t('settings.about.title')} />
        <Card>
          <View style={styles.versionRow}>
            <AppText variant="bodySmall" color="textSecondary">
              {t('settings.about.version')}
            </AppText>
            <AppText variant="subheading" testID="app-version">
              {Constants.expoConfig?.version ?? ''}
            </AppText>
          </View>
          <View style={styles.versionRow}>
            <AppText variant="bodySmall" color="textSecondary">
              {t('settings.about.contentVersion')}
            </AppText>
            <AppText variant="subheading" testID="content-version">
              {contentInfo?.contentVersion ?? t('settings.about.contentUnavailable')}
            </AppText>
          </View>
          <View style={styles.versionRow}>
            <AppText variant="bodySmall" color="textSecondary">
              {t('settings.about.pujaCount')}
            </AppText>
            <AppText variant="subheading" testID="puja-count">
              {contentInfo ? contentInfo.pujaCount : t('settings.about.contentUnavailable')}
            </AppText>
          </View>
          <View style={styles.versionRow}>
            <AppText variant="bodySmall" color="textSecondary">
              {t('settings.about.festivalCount')}
            </AppText>
            <AppText variant="subheading" testID="festival-count">
              {contentInfo ? contentInfo.festivalCount : t('settings.about.contentUnavailable')}
            </AppText>
          </View>
          <AppText>{t('settings.about.description')}</AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('settings.about.offline')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('settings.about.deviceOnly')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('settings.about.reviewNote')}
          </AppText>
        </Card>
      </View>

      <AdsPrivacySettings />

      <PrivacyPolicyRow />

      <Card tone="alt">
        <AppText variant="subheading" accessibilityRole="header">
          {t('settings.disclaimer.title')}
        </AppText>
        <AppText testID="disclaimer-body">{t('settings.disclaimer.body')}</AppText>
      </Card>

      <View style={styles.section}>
        <Card style={[styles.danger, { borderColor: colors.heading }]} testID="danger-section">
          <AppText variant="subheading" color="heading" accessibilityRole="header">
            {t('settings.reset.title')}
          </AppText>
          <AppText>{t('settings.reset.description')}</AppText>
          <Button
            testID="reset-data-open"
            variant="outline"
            icon="trash-can-outline"
            label={t('settings.reset.button')}
            disabled={!reset.canReset}
            onPress={reset.openDialog}
          />
        </Card>
      </View>

      <ResetLocalDataDialog
        visible={reset.open}
        busy={reset.busy}
        error={reset.error}
        onClose={reset.close}
        onConfirm={() => void reset.confirm()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  subLabel: { marginTop: spacing.xs },
  preview: { marginTop: spacing.xs },
  danger: { borderWidth: 1.5, gap: spacing.sm },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
