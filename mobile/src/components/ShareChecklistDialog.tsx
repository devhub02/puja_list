import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import type { LocaleMap } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import type { Entry } from '@/utils/checklistEntries';
import { SECTION_ORDER } from '@/utils/preparationProgress';
import { formatChecklistText, selectShareEntries } from '@/utils/shareChecklist';
import type { ShareLabels, ShareMode } from '@/utils/shareChecklist';
import { notify } from '@/utils/notify';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { Dialog } from './Dialog';

type Props = {
  visible: boolean;
  onClose: () => void;
  pujaName: LocaleMap;
  label: string | null;
  entries: readonly Entry[];
};

/** Labels in the language selected right now (names fall back to English inside the formatter). */
export function shareLabelsFor(language: LanguageCode): ShareLabels {
  const t = i18n.getFixedT(language);
  return {
    sections: Object.fromEntries(
      SECTION_ORDER.map((section) => [section, t(`checklist.section.${section}`)]),
    ) as ShareLabels['sections'],
    footer: `${t('share.footer')} - ${t('settings.disclaimer.body')}`,
  };
}

/**
 * Share dialog: choose "All items" or "Only items I still need", then hand plain text to the system share
 * sheet (React Native's built-in Share, no extra package). Closing the sheet without sharing is not an error.
 */
export function ShareChecklistDialog({ visible, onClose, pujaName, label, entries }: Props) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [mode, setMode] = useState<ShareMode>('all');
  const [busy, setBusy] = useState(false);
  const nothing = selectShareEntries(entries, mode).length === 0;

  const send = async () => {
    setBusy(true);
    try {
      const message = formatChecklistText({
        pujaName,
        label,
        entries,
        mode,
        language,
        labels: shareLabelsFor(language),
      });
      await Share.share({ message });
      onClose();
    } catch (error) {
      console.error('Could not share the checklist', error);
      notify(t('share.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      testID="share-dialog"
      visible={visible}
      title={t('share.title')}
      message={t('share.body')}
      onClose={onClose}
      actions={[
        {
          label: t('share.send'),
          variant: 'primary',
          icon: 'share-variant-outline',
          testID: 'share-send',
          onPress: () => {
            if (!nothing && !busy) void send();
          },
        },
        { label: t('share.cancel'), testID: 'share-cancel', onPress: onClose },
      ]}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('share.modeLabel')}
        style={styles.chips}
      >
        <Chip
          testID="share-mode-all"
          label={t('share.modeAll')}
          selected={mode === 'all'}
          onPress={() => setMode('all')}
        />
        <Chip
          testID="share-mode-needed"
          label={t('share.modeNeeded')}
          selected={mode === 'needed'}
          onPress={() => setMode('needed')}
        />
      </View>
      {nothing ? (
        <AppText variant="bodySmall" color="textSecondary" testID="share-nothing">
          {t('share.nothingLeft')}
        </AppText>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
