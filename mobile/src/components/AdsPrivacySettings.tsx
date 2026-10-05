import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getConsentState, showPrivacyOptions, subscribeConsent } from '@/ads/consent';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';

/**
 * The "About ads" text (always shown) and the "Ad privacy choices" row (only when the UMP SDK
 * says `privacyOptionsRequired`, e.g. for a user in the EEA/UK). Honest about what AdMob
 * processes; never claims no data is collected (CLAUDE.md "Privacy").
 */
export function AdsPrivacySettings() {
  const { t } = useTranslation();
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(
    () => getConsentState().privacyOptionsRequired,
  );

  useEffect(
    () => subscribeConsent((state) => setPrivacyOptionsRequired(state.privacyOptionsRequired)),
    [],
  );

  return (
    <View style={styles.section}>
      <SectionHeader title={t('settings.ads.title')} />
      <Card>
        <AppText>{t('settings.ads.about')}</AppText>
        <AppText variant="bodySmall" color="textSecondary">
          {t('settings.ads.aboutDetail')}
        </AppText>
      </Card>
      {privacyOptionsRequired ? (
        <Button
          testID="settings-ads-privacy-choices"
          variant="outline"
          icon="shield-account-outline"
          label={t('settings.ads.privacyChoices')}
          onPress={() => void showPrivacyOptions()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
