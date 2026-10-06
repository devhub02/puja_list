import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { PRIVACY_POLICY_URL } from '@/config/legal';
import { minTouchTarget, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Settings row that opens the published privacy policy in the browser. Hidden when PRIVACY_POLICY_URL is empty.
 * The browser loads the page; the app itself makes no network request for it.
 */
export function PrivacyPolicyRow({ url = PRIVACY_POLICY_URL }: { url?: string }) {
  const { t } = useTranslation();
  if (!url) return null;
  return (
    <View style={styles.row} testID="privacy-policy-row">
      <AppText variant="bodySmall" color="textSecondary">
        {t('settings.privacyPolicy.hint')}
      </AppText>
      <Button
        testID="privacy-policy-open"
        variant="outline"
        icon="shield-account-outline"
        label={t('settings.privacyPolicy.open')}
        accessibilityLabel={t('settings.privacyPolicy.openA11y')}
        onPress={() => {
          void Linking.openURL(url).catch(() => undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, minHeight: minTouchTarget },
});
