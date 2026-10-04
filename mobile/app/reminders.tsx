import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ReminderDialogs } from '@/components/ReminderDialogs';
import { ReminderRow } from '@/components/ReminderRow';
import { ReminderSheet } from '@/components/ReminderSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState, LoadingState } from '@/components/StateViews';
import type { Reminder } from '@/db/repositories';
import { useCatalog } from '@/hooks/useCatalog';
import { usePreparationSummaries } from '@/hooks/usePreparation';
import { useReminderController } from '@/hooks/useReminderController';
import { useReminders } from '@/hooks/useReminders';
import { localize } from '@/i18n/localeMap';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { groupReminders } from '@/utils/reminderDisplay';
import type { ReminderGroup } from '@/utils/reminderDisplay';

const GROUPS: ReminderGroup[] = ['upcoming', 'paused', 'past'];

type Row =
  | { type: 'section'; key: string; group: ReminderGroup }
  | { type: 'empty'; key: string }
  | { type: 'reminder'; key: string; reminder: Reminder };

/** Every reminder, grouped as upcoming / paused / past, with switch, edit and delete. */
export default function ManageRemindersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const reminders = useReminders();
  const preparations = usePreparationSummaries();
  const catalog = useCatalog();
  const controller = useReminderController({
    preparationId: null,
    getPreparationId: () => Promise.reject(new Error('Not used here')),
  });
  const [editing, setEditing] = useState<Reminder | null>(null);
  const now = new Date();

  const prepById = useMemo(
    () =>
      new Map(preparations.status === 'ready' ? preparations.summaries.map((p) => [p.id, p]) : []),
    [preparations],
  );
  const pujaById = useMemo(() => new Map(catalog.pujas.map((p) => [p.id, p])), [catalog.pujas]);

  const headingOf = (reminder: Reminder): string => {
    const prep = prepById.get(reminder.preparationId);
    const puja = prep ? pujaById.get(prep.pujaId) : undefined;
    const name = puja ? localize(puja.name, language) : t('reminders.manage.unknownPuja');
    return prep?.title ? `${name}, ${prep.title}` : name;
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/preparation'));

  let content;
  if (reminders.status === 'loading' || preparations.status === 'loading') {
    content = <LoadingState />;
  } else if (reminders.status === 'error' || preparations.status === 'error') {
    content = (
      <ErrorState
        onRetry={() => {
          reminders.retry();
          if (preparations.status === 'error') preparations.reload();
        }}
      />
    );
  } else if (reminders.data.length === 0) {
    content = (
      <EmptyState
        icon="bell-outline"
        title={t('reminders.manage.emptyTitle')}
        body={t('reminders.manage.emptyBody')}
        action={{
          label: t('reminders.manage.openPreparation'),
          onPress: () => router.navigate('/preparation'),
        }}
      />
    );
  } else {
    const groups = groupReminders(reminders.data, now);
    const rows: Row[] = GROUPS.flatMap((group) => [
      { type: 'section' as const, key: `s:${group}`, group },
      ...(groups[group].length === 0
        ? [{ type: 'empty' as const, key: `e:${group}` }]
        : groups[group].map((reminder) => ({
            type: 'reminder' as const,
            key: reminder.id,
            reminder,
          }))),
    ]);
    content = (
      <FlatList
        testID="reminders-list"
        data={rows}
        keyExtractor={(row) => row.key}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        windowSize={7}
        renderItem={({ item: row }) => {
          if (row.type === 'section') {
            return (
              <View style={styles.sectionHeader}>
                <SectionHeader
                  title={`${t(`reminders.manage.${row.group}`)} (${groups[row.group].length})`}
                />
              </View>
            );
          }
          if (row.type === 'empty') {
            return (
              <AppText color="textSecondary" variant="bodySmall">
                {t('reminders.manage.groupEmpty')}
              </AppText>
            );
          }
          return (
            <ReminderRow
              reminder={row.reminder}
              language={language}
              now={now}
              heading={headingOf(row.reminder)}
              onToggle={(r, enabled) => void controller.toggle(r, enabled)}
              onEdit={setEditing}
              onDelete={controller.askDelete}
            />
          );
        }}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton
          testID="reminders-back"
          icon="arrow-left"
          color="text"
          accessibilityLabel={t('a11y.goBack')}
          onPress={goBack}
        />
      </View>
      <View style={styles.titleBlock}>
        <AppText variant="title" accessibilityRole="header">
          {t('reminders.manage.title')}
        </AppText>
        <Card tone="alt" testID="battery-note">
          <AppText variant="bodySmall">{t('reminders.batteryNote')}</AppText>
        </Card>
        {!notificationsEnabled ? (
          <Card tone="alt" testID="notifications-off-note">
            <AppText variant="bodySmall">{t('settings.notifications.offNote')}</AppText>
          </Card>
        ) : null}
      </View>
      <View style={styles.flex}>{content}</View>

      <ReminderDialogs
        dialog={controller.dialog}
        onClose={controller.closeDialog}
        onConfirmDelete={(reminder) => void controller.confirmDelete(reminder)}
      />
      <ReminderSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? headingOf(editing) : ''}
        pujaId={editing ? (prepById.get(editing.preparationId)?.pujaId ?? null) : null}
        preparationId={editing?.preparationId ?? null}
        getPreparationId={async () => {
          if (!editing) throw new Error('No reminder');
          return editing.preparationId;
        }}
        editReminderId={editing?.id ?? null}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  bar: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  titleBlock: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sectionHeader: { marginTop: spacing.sm },
  separator: { height: spacing.sm },
});
