import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { ChecklistRow } from '@/components/ChecklistRow';
import { Chip } from '@/components/Chip';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { PreparationCard } from '@/components/PreparationCard';
import { ReminderSheet } from '@/components/ReminderSheet';
import { SharePreparationDialog } from '@/components/SharePreparationDialog';
import { Button } from '@/components/Button';
import { PujaCard } from '@/components/PujaCard';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDatabase } from '@/db/DatabaseProvider';
import {
  MAX_TITLE_LENGTH,
  clearCompletedCustomItems,
  deletePreparation,
  duplicatePreparation,
  renamePreparation,
  setItemChecked,
} from '@/db/repositories';
import type { PreparationSummary } from '@/db/repositories';
import type { PujaSummary } from '@/db/types';
import { useCatalog } from '@/hooks/useCatalog';
import { usePreparationSummaries, usePujaPreparation } from '@/hooks/usePreparation';
import { useUserState } from '@/hooks/useUserState';
import { formatShortDate } from '@/i18n/format';
import { localize } from '@/i18n/localeMap';
import { reconcileAndRefresh } from '@/notifications/runtime';
import { writeAndRefresh } from '@/store/preparationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { notify } from '@/utils/notify';
import { useTheme } from '@/theme';
import { minTouchTarget, spacing } from '@/theme/tokens';
import { buildEntries, entryKey } from '@/utils/checklistEntries';
import { buildShoppingList, isChecklistComplete } from '@/utils/preparationProgress';

type ViewMode = 'checklists' | 'shopping';

type Action =
  | { kind: 'none' }
  | { kind: 'sheet'; prep: PreparationSummary }
  | { kind: 'remind'; prep: PreparationSummary }
  | { kind: 'share'; prep: PreparationSummary }
  | { kind: 'rename'; prep: PreparationSummary }
  | { kind: 'duplicate'; prep: PreparationSummary }
  | { kind: 'clear'; prep: PreparationSummary }
  | { kind: 'delete'; prep: PreparationSummary };

const RECENT_COUNT = 5;

type Row =
  | { type: 'section'; key: string; title: string; description?: string }
  | { type: 'card'; key: string; prep: PreparationSummary }
  | { type: 'recent'; key: string; prep: PreparationSummary }
  | { type: 'saved'; key: string; puja: PujaSummary }
  | { type: 'text'; key: string; text: string }
  | { type: 'empty'; key: string };

export default function PreparationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const catalog = useCatalog();
  const prepared = usePreparationSummaries();
  const { savedIds, toggleSaved } = useUserState();

  const [view, setView] = useState<ViewMode>('checklists');
  const [shoppingId, setShoppingId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>({ kind: 'none' });
  const [label, setLabel] = useState('');

  const pujaById = useMemo(() => new Map(catalog.pujas.map((p) => [p.id, p])), [catalog.pujas]);
  const nameOf = (prep: PreparationSummary): string | null => {
    const puja = pujaById.get(prep.pujaId);
    return puja ? localize(puja.name, language) : null;
  };
  const labelOf = (prep: PreparationSummary): string => {
    const name = nameOf(prep) ?? t('preparation.pujaUnavailable');
    return prep.title ? `${name}, ${prep.title}` : name;
  };

  const openChecklist = (id: string) => {
    const prep = prepared.status === 'ready' ? prepared.summaries.find((p) => p.id === id) : null;
    if (prep) {
      router.push({ pathname: '/puja/[id]/samagri', params: { id: prep.pujaId, prep: prep.id } });
    }
  };
  const openVidhi = (id: string) => {
    const prep = prepared.status === 'ready' ? prepared.summaries.find((p) => p.id === id) : null;
    if (prep) {
      router.push({ pathname: '/puja/[id]/vidhi', params: { id: prep.pujaId, prep: prep.id } });
    }
  };
  const openPuja = (id: string) => router.push({ pathname: '/puja/[id]', params: { id } });
  const openLibrary = () => router.navigate('/library');
  const find = (id: string) =>
    prepared.status === 'ready' ? prepared.summaries.find((p) => p.id === id) : undefined;
  const openSheet = (id: string) => {
    const prep = find(id);
    if (prep) setAction({ kind: 'sheet', prep });
  };
  const openRemind = (id: string) => {
    const prep = find(id);
    if (prep) setAction({ kind: 'remind', prep });
  };
  const close = () => setAction({ kind: 'none' });

  const header = (
    <View style={styles.header}>
      <AppText variant="title">{t('preparation.title')}</AppText>
      <Button
        testID="manage-reminders"
        variant="outline"
        icon="bell-outline"
        label={t('reminders.manage.title')}
        onPress={() => router.push('/reminders')}
      />
      <SegmentedControl
        accessibilityLabel={t('preparation.viewLabel')}
        testIDPrefix="view"
        value={view}
        onChange={setView}
        options={[
          { value: 'checklists', label: t('preparation.viewChecklists') },
          { value: 'shopping', label: t('preparation.viewShopping') },
        ]}
      />
    </View>
  );

  let content;
  if (prepared.status === 'loading' || catalog.status === 'loading') {
    content = (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={header}
        ListFooterComponent={<LoadingState />}
        contentContainerStyle={styles.content}
      />
    );
  } else if (prepared.status === 'error' || catalog.status === 'error') {
    content = (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={header}
        ListFooterComponent={
          <ErrorState
            onRetry={() => {
              prepared.reload();
              catalog.retry();
            }}
          />
        }
        contentContainerStyle={styles.content}
      />
    );
  } else if (view === 'shopping') {
    const selected =
      prepared.summaries.find((p) => p.id === shoppingId) ?? prepared.summaries[0] ?? null;
    content = (
      <ShoppingList
        header={header}
        summaries={prepared.summaries}
        selected={selected}
        onSelect={setShoppingId}
        labelOf={labelOf}
        onOpenLibrary={openLibrary}
      />
    );
  } else {
    const summaries = prepared.summaries;
    const rows: Row[] = [];
    if (summaries.length === 0) {
      rows.push({ type: 'empty', key: 'empty' });
    } else {
      const current = summaries.filter((p) => !isChecklistComplete(p.progress));
      rows.push({
        type: 'section',
        key: 'h-current',
        title: t('preparation.currentTitle'),
        description: t('preparation.currentDescription'),
      });
      if (current.length === 0) {
        rows.push({ type: 'text', key: 'current-empty', text: t('preparation.currentEmpty') });
      }
      for (const prep of current) rows.push({ type: 'card', key: `card:${prep.id}`, prep });
    }
    rows.push({ type: 'section', key: 'h-saved', title: t('preparation.savedTitle') });
    const saved = savedIds.map((id) => pujaById.get(id)).filter((p) => p !== undefined);
    if (saved.length === 0) {
      rows.push({ type: 'text', key: 'saved-empty', text: t('preparation.savedEmpty') });
    }
    for (const puja of saved) rows.push({ type: 'saved', key: `saved:${puja.id}`, puja });
    if (summaries.length > 0) {
      rows.push({ type: 'section', key: 'h-recent', title: t('preparation.recentTitle') });
      for (const prep of summaries.slice(0, RECENT_COUNT)) {
        rows.push({ type: 'recent', key: `recent:${prep.id}`, prep });
      }
    }

    const renderRow = ({ item: row }: { item: Row }) => {
      switch (row.type) {
        case 'section':
          return <SectionHeader title={row.title} description={row.description} />;
        case 'card':
          return (
            <PreparationCard
              summary={row.prep}
              pujaName={nameOf(row.prep)}
              language={language}
              onOpenChecklist={openChecklist}
              onOpenVidhi={openVidhi}
              onMore={openSheet}
              onRemind={openRemind}
            />
          );
        case 'recent': {
          const available = nameOf(row.prep) !== null;
          return (
            <Pressable
              testID={`recent-${row.prep.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${t('preparation.openChecklist')}: ${labelOf(row.prep)}`}
              disabled={!available}
              onPress={() => openChecklist(row.prep.id)}
              android_ripple={{ color: colors.pressed }}
              style={({ pressed }) => [
                styles.recent,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.pressed : colors.surface,
                },
              ]}
            >
              <View style={styles.flex}>
                <AppText variant="subheading" numberOfLines={1}>
                  {nameOf(row.prep) ?? t('preparation.pujaUnavailable')}
                </AppText>
                {row.prep.title ? (
                  <AppText variant="caption" color="goldText" numberOfLines={1}>
                    {row.prep.title}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" color="textSecondary">
                {formatShortDate(row.prep.lastOpenedAt, language)}
              </AppText>
            </Pressable>
          );
        }
        case 'saved':
          return (
            <PujaCard
              puja={row.puja}
              language={language}
              saved
              onOpen={openPuja}
              onToggleSaved={(id) => void toggleSaved(db, id)}
            />
          );
        case 'text':
          return (
            <AppText color="textSecondary" testID={row.key}>
              {row.text}
            </AppText>
          );
        case 'empty':
          return (
            <EmptyState
              icon="clipboard-check-multiple-outline"
              title={t('preparation.emptyTitle')}
              body={t('preparation.emptyBody')}
              action={{ label: t('preparation.openLibrary'), onPress: openLibrary }}
            />
          );
      }
    };

    content = (
      <FlatList
        testID="preparation-list"
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        windowSize={7}
      />
    );
  }

  const prep = action.kind === 'none' ? null : action.prep;
  const closeThen = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {content}

      <ReminderSheet
        visible={action.kind === 'remind'}
        onClose={close}
        title={prep ? labelOf(prep) : ''}
        pujaId={prep?.pujaId ?? null}
        preparationId={prep?.id ?? null}
        getPreparationId={async () => {
          if (!prep) throw new Error('No preparation');
          return prep.id;
        }}
      />
      <SharePreparationDialog
        preparationId={action.kind === 'share' ? action.prep.id : null}
        onClose={close}
      />

      <Dialog
        testID="actions-dialog"
        visible={action.kind === 'sheet'}
        title={prep ? labelOf(prep) : t('preparation.actionsTitle')}
        onClose={close}
        actions={[
          {
            label: t('preparation.rename'),
            icon: 'pencil-outline',
            testID: 'action-rename',
            onPress: () => {
              if (prep) {
                setLabel(prep.title ?? '');
                setAction({ kind: 'rename', prep });
              }
            },
          },
          {
            label: t('share.action'),
            icon: 'share-variant-outline',
            testID: 'action-share',
            onPress: () => prep && setAction({ kind: 'share', prep }),
          },
          {
            label: t('preparation.duplicate'),
            icon: 'content-copy',
            testID: 'action-duplicate',
            onPress: () => {
              if (prep) {
                setLabel('');
                setAction({ kind: 'duplicate', prep });
              }
            },
          },
          ...(prep && prep.progress.custom.checked > 0
            ? [
                {
                  label: t('preparation.clearCompleted'),
                  icon: 'broom' as const,
                  testID: 'action-clear',
                  onPress: () => setAction({ kind: 'clear', prep }),
                },
              ]
            : []),
          {
            label: t('preparation.deleteAction'),
            icon: 'trash-can-outline',
            testID: 'action-delete',
            onPress: () => prep && setAction({ kind: 'delete', prep }),
          },
          { label: t('common.close'), testID: 'action-close', onPress: close },
        ]}
      />

      <Dialog
        testID="rename-dialog"
        visible={action.kind === 'rename'}
        title={t('preparation.renameTitle')}
        message={t('preparation.labelHelp')}
        onClose={close}
        actions={[
          {
            label: t('common.save'),
            variant: 'primary',
            testID: 'rename-save',
            onPress: closeThen(() => {
              if (prep) {
                void writeAndRefresh(() => renamePreparation(db, prep.id, label)).then(() =>
                  notify(t('feedback.preparationRenamed')),
                );
              }
            }),
          },
          { label: t('common.cancel'), testID: 'rename-cancel', onPress: close },
        ]}
      >
        <TextField
          testID="label-input"
          label={t('preparation.labelField')}
          value={label}
          maxLength={MAX_TITLE_LENGTH}
          autoFocus
          onChangeText={setLabel}
        />
      </Dialog>

      <Dialog
        testID="duplicate-dialog"
        visible={action.kind === 'duplicate'}
        title={t('preparation.duplicateTitle')}
        message={t('preparation.duplicateBody')}
        onClose={close}
        actions={[
          {
            label: t('preparation.duplicateConfirm'),
            variant: 'primary',
            testID: 'duplicate-confirm',
            onPress: closeThen(() => {
              if (prep) {
                void writeAndRefresh(() =>
                  duplicatePreparation(db, prep.id, { title: label }),
                ).then(() => notify(t('feedback.preparationCopied')));
              }
            }),
          },
          { label: t('common.cancel'), testID: 'duplicate-cancel', onPress: close },
        ]}
      >
        <TextField
          testID="duplicate-label"
          label={t('preparation.labelField')}
          value={label}
          maxLength={MAX_TITLE_LENGTH}
          autoFocus
          onChangeText={setLabel}
        />
      </Dialog>

      <Dialog
        testID="clear-dialog"
        visible={action.kind === 'clear'}
        title={t('preparation.clearCompletedTitle')}
        message={
          prep ? t('preparation.clearCompletedBody', { count: prep.progress.custom.checked }) : ''
        }
        onClose={close}
        actions={[
          {
            label: t('preparation.clearCompletedConfirm'),
            variant: 'primary',
            testID: 'clear-confirm',
            onPress: closeThen(() => {
              if (prep) {
                void writeAndRefresh(() => clearCompletedCustomItems(db, prep.id)).then((count) =>
                  notify(t('feedback.customCleared', { count })),
                );
              }
            }),
          },
          { label: t('common.cancel'), testID: 'clear-cancel', onPress: close },
        ]}
      />

      <Dialog
        testID="delete-prep-dialog"
        visible={action.kind === 'delete'}
        title={t('preparation.deleteTitle')}
        message={t('preparation.deleteBody')}
        onClose={close}
        actions={[
          {
            label: t('preparation.deleteConfirm'),
            variant: 'primary',
            testID: 'delete-prep-confirm',
            onPress: closeThen(() => {
              if (prep) {
                void writeAndRefresh(() => deletePreparation(db, prep.id))
                  // Its reminders went with it; take their OS notifications away too.
                  .then(() => reconcileAndRefresh(db))
                  .then(() => notify(t('feedback.preparationDeleted')));
              }
            }),
          },
          { label: t('common.cancel'), testID: 'delete-prep-cancel', onPress: close },
        ]}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/** Unchecked items of one preparation, grouped (required first), that can be ticked off. */
function ShoppingList({
  header,
  summaries,
  selected,
  onSelect,
  labelOf,
  onOpenLibrary,
}: {
  header: ReactElement;
  summaries: PreparationSummary[];
  selected: PreparationSummary | null;
  onSelect: (id: string) => void;
  labelOf: (prep: PreparationSummary) => string;
  onOpenLibrary: () => void;
}) {
  const { t } = useTranslation();
  const db = useDatabase();
  const language = useSettingsStore((s) => s.language);
  const data = usePujaPreparation(selected?.pujaId, selected?.id);

  const groups = useMemo(() => {
    if (data.status !== 'ready' || !data.state) return [];
    return buildShoppingList(buildEntries(data.puja.samagri, data.state));
  }, [data]);
  const left = groups.reduce((sum, g) => sum + g.items.length, 0);

  const toolbar = (
    <View style={styles.shoppingHeader}>
      {header}
      {summaries.length > 1 ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('preparation.shoppingChoose')}
          style={styles.chips}
        >
          {summaries.map((prep) => (
            <Chip
              key={prep.id}
              testID={`shop-choose-${prep.id}`}
              label={labelOf(prep)}
              selected={prep.id === selected?.id}
              onPress={() => onSelect(prep.id)}
            />
          ))}
        </View>
      ) : null}
      {selected && data.status === 'ready' && data.state ? (
        <AppText variant="subheading" testID="shopping-left">
          {t('preparation.shoppingLeft', { count: left })}
        </AppText>
      ) : null}
    </View>
  );

  let message: ReactElement | null = null;
  if (!selected) {
    message = (
      <EmptyState
        icon="cart-outline"
        title={t('preparation.shoppingEmptyTitle')}
        body={t('preparation.shoppingEmptyBody')}
        action={{ label: t('preparation.openLibrary'), onPress: onOpenLibrary }}
      />
    );
  } else if (data.status === 'loading') {
    message = <LoadingState />;
  } else if (data.status === 'error') {
    message = <ErrorState onRetry={data.reload} />;
  } else if (data.status === 'notFound') {
    message = (
      <AppText color="textSecondary" testID="shopping-unavailable">
        {t('preparation.shoppingUnavailable')}
      </AppText>
    );
  } else if (groups.length === 0) {
    message = (
      <EmptyState
        icon="check-circle-outline"
        title={t('preparation.shoppingDoneTitle')}
        body={t('preparation.shoppingDoneBody')}
      />
    );
  }

  type ShopRow =
    | { type: 'section'; key: string; title: string }
    | { type: 'item'; key: string; entry: ReturnType<typeof buildEntries>[number] };
  const rows: ShopRow[] = groups.flatMap((group) => [
    {
      type: 'section' as const,
      key: `s:${group.section}`,
      title: t(`checklist.section.${group.section}`),
    },
    ...group.items.map((entry) => ({ type: 'item' as const, key: entryKey(entry), entry })),
  ]);

  return (
    <FlatList
      testID="shopping-list"
      data={rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={toolbar}
      ListFooterComponent={message}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      initialNumToRender={14}
      windowSize={9}
      renderItem={({ item: row }) => {
        if (row.type === 'section') {
          return (
            <AppText variant="heading" style={styles.shopSection}>
              {row.title}
            </AppText>
          );
        }
        const { entry } = row;
        const name =
          entry.kind === 'custom' ? entry.custom.name : localize(entry.item.name, language);
        const summary =
          entry.kind === 'custom'
            ? (entry.custom.note ?? undefined)
            : entry.item.quantityGuidance
              ? localize(entry.item.quantityGuidance, language)
              : undefined;
        return (
          <ChecklistRow
            compact
            rowKey={row.key}
            name={name}
            summary={summary}
            checked={false}
            onToggle={() => {
              const id = selected?.id;
              if (id) {
                void writeAndRefresh(() => setItemChecked(db, id, entry.kind, entry.ref, true));
              }
            }}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  shoppingHeader: { gap: spacing.sm, paddingBottom: spacing.sm },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  separator: { height: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  shopSection: { marginTop: spacing.sm },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
