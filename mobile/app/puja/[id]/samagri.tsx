import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ButtonRow, buttonRowItem } from '@/components/ButtonRow';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChecklistRow } from '@/components/ChecklistRow';
import type { RowDetail } from '@/components/ChecklistRow';
import { Dialog } from '@/components/Dialog';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { ReminderSheet } from '@/components/ReminderSheet';
import { ReviewBadge } from '@/components/ReviewBadge';
import { ShareChecklistDialog } from '@/components/ShareChecklistDialog';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDatabase } from '@/db/DatabaseProvider';
import {
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_NOTE_LENGTH,
  addCustomItem,
  deleteCustomItem,
  ensureDefaultPreparation,
  forgetItem,
  resetChecklist,
  setItemChecked,
  updateCustomItem,
} from '@/db/repositories';
import { usePujaPreparation, useTouchOnOpen } from '@/hooks/usePreparation';
import type { RemovedItem } from '@/hooks/usePreparation';
import { localize } from '@/i18n/localeMap';
import { writeAndRefresh } from '@/store/preparationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { notify } from '@/utils/notify';
import { useTheme } from '@/theme';
import { iconSize, minTouchTarget, spacing } from '@/theme/tokens';
import { buildEntries, entryKey } from '@/utils/checklistEntries';
import type { Entry } from '@/utils/checklistEntries';
import {
  SECTION_ORDER,
  computeProgress,
  countFor,
  filterEntries,
  groupBySection,
} from '@/utils/preparationProgress';
import type { ChecklistFilter, SectionKey } from '@/utils/preparationProgress';

/** Above this many characters a row's details are folded behind "Show more". */
const LONG_ROW = 140;

type Row =
  | {
      type: 'section';
      key: string;
      section: SectionKey;
      checked: number;
      total: number;
      collapsed: boolean;
    }
  | { type: 'entry'; key: string; entry: Entry }
  | { type: 'removedHeader'; key: string }
  | { type: 'removed'; key: string; item: RemovedItem }
  | { type: 'message'; key: string; kind: 'none' | 'noMatch' | 'noCustom' };

type Dialogs =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'edit'; entry: Extract<Entry, { kind: 'custom' }> }
  | { kind: 'delete'; entry: Extract<Entry, { kind: 'custom' }> }
  | { kind: 'reset' }
  | { kind: 'remind' }
  | { kind: 'share' };

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default function SamagriScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const params = useLocalSearchParams<{
    id?: string | string[];
    prep?: string | string[];
    focus?: string | string[];
  }>();
  const pujaId = first(params.id);
  const focusId = first(params.focus);

  // The preparation in use. Null until the user's first action creates the default one.
  const [prepId, setPrepId] = useState<string | null>(first(params.prep) ?? null);
  const data = usePujaPreparation(pujaId, prepId);

  const [filter, setFilter] = useState<ChecklistFilter>('all');
  const [uncheckedOnly, setUncheckedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<SectionKey>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<Dialogs>({ kind: 'none' });
  const [highlight, setHighlight] = useState<string | undefined>(focusId);
  const [fieldName, setFieldName] = useState('');
  const [fieldNote, setFieldNote] = useState('');
  const [nameError, setNameError] = useState(false);

  const listRef = useRef<FlatList<Row>>(null);
  const focusScrolled = useRef(false);

  const ready = data.status === 'ready' ? data : null;
  const state = ready?.state ?? null;
  const puja = ready?.puja ?? null;

  // Opening an existing checklist makes it the most recently used one. Nothing is created here.
  useTouchOnOpen(state?.preparation.id ?? null);

  // The highlight from "open this item" fades after a moment.
  useEffect(() => {
    if (!focusId) return;
    const timer = setTimeout(() => setHighlight(undefined), 3500);
    return () => clearTimeout(timer);
  }, [focusId]);

  const entries = useMemo(() => (puja ? buildEntries(puja.samagri, state) : []), [puja, state]);
  const progress = useMemo(
    () =>
      computeProgress({
        samagri: puja?.samagri ?? [],
        customIds: state?.customItems.map((c) => c.id) ?? [],
        checkedSamagriIds: state?.checkedSamagriIds ?? [],
        checkedCustomIds: state?.checkedCustomIds ?? [],
      }),
    [puja, state],
  );

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const visible = filterEntries(entries, filter, uncheckedOnly);
    if (entries.length === 0 && filter === 'all') {
      list.push({ type: 'message', key: 'none', kind: 'none' });
    } else if (visible.length === 0) {
      const customOnly = filter === 'CUSTOM' && !entries.some((e) => e.kind === 'custom');
      list.push({
        type: 'message',
        key: 'nomatch',
        kind: customOnly ? 'noCustom' : 'noMatch',
      });
    }
    for (const group of groupBySection(visible)) {
      const count = countFor(progress, group.section);
      const isCollapsed = collapsed.has(group.section);
      list.push({
        type: 'section',
        key: `section:${group.section}`,
        section: group.section,
        checked: count.checked,
        total: count.total,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        for (const entry of group.items) {
          list.push({ type: 'entry', key: entryKey(entry), entry });
        }
      }
    }
    if (ready && ready.removed.length > 0) {
      list.push({ type: 'removedHeader', key: 'removed-header' });
      for (const item of ready.removed) {
        list.push({ type: 'removed', key: `removed:${item.id}`, item });
      }
    }
    return list;
  }, [entries, filter, uncheckedOnly, collapsed, progress, ready]);

  // "Open this item" from the vidhi: scroll to it once the list is on screen.
  useEffect(() => {
    if (!focusId || focusScrolled.current || !puja) return;
    const index = rows.findIndex((r) => r.key === `samagri:${focusId}`);
    if (index < 0) return;
    focusScrolled.current = true;
    const timer = setTimeout(
      () => listRef.current?.scrollToIndex({ index, viewPosition: 0.15, animated: true }),
      50,
    );
    return () => clearTimeout(timer);
  }, [focusId, puja, rows]);

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/')),
    [router],
  );

  /** The preparation to write to: the one in use, or the default created now (first real action). */
  const withPreparation = useCallback(
    async (write: (preparationId: string) => Promise<unknown>) => {
      if (!pujaId) return;
      await writeAndRefresh(async () => {
        const id = state?.preparation.id ?? (await ensureDefaultPreparation(db, pujaId)).id;
        setPrepId(id);
        await write(id);
      });
    },
    [db, pujaId, state],
  );

  /** The preparation for a reminder: the one in use, or the default created now (first save only). */
  const getPreparationId = useCallback(async (): Promise<string> => {
    if (state) return state.preparation.id;
    if (!pujaId) throw new Error('No puja');
    return writeAndRefresh(async () => {
      const id = (await ensureDefaultPreparation(db, pujaId)).id;
      setPrepId(id);
      return id;
    });
  }, [db, pujaId, state]);

  const entryByKey = useCallback(
    (key: string) => entries.find((e) => entryKey(e) === key),
    [entries],
  );

  const onToggle = useCallback(
    (key: string) => {
      const entry = entryByKey(key);
      if (!entry) return;
      void withPreparation((id) => setItemChecked(db, id, entry.kind, entry.ref, !entry.checked));
    },
    [db, entryByKey, withPreparation],
  );

  const onToggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSection = useCallback((section: SectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const openAdd = () => {
    setFieldName('');
    setFieldNote('');
    setNameError(false);
    setDialog({ kind: 'add' });
  };
  const onEdit = useCallback(
    (key: string) => {
      const entry = entryByKey(key);
      if (!entry || entry.kind !== 'custom') return;
      setFieldName(entry.custom.name);
      setFieldNote(entry.custom.note ?? '');
      setNameError(false);
      setDialog({ kind: 'edit', entry });
    },
    [entryByKey],
  );
  const onDelete = useCallback(
    (key: string) => {
      const entry = entryByKey(key);
      if (entry && entry.kind === 'custom') setDialog({ kind: 'delete', entry });
    },
    [entryByKey],
  );

  const closeDialog = () => setDialog({ kind: 'none' });

  const saveItem = async () => {
    if (fieldName.trim() === '') {
      setNameError(true);
      return;
    }
    const current = dialog;
    closeDialog();
    if (current.kind === 'add') {
      await withPreparation((id) => addCustomItem(db, id, { name: fieldName, note: fieldNote }));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete('CUSTOM');
        return next;
      });
    } else if (current.kind === 'edit') {
      const itemId = current.entry.ref;
      await writeAndRefresh(() =>
        updateCustomItem(db, itemId, { name: fieldName, note: fieldNote }),
      );
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== 'delete') return;
    const itemId = dialog.entry.ref;
    closeDialog();
    await writeAndRefresh(() => deleteCustomItem(db, itemId));
    notify(t('feedback.itemDeleted'));
  };

  const confirmReset = async () => {
    const id = state?.preparation.id;
    closeDialog();
    if (id) {
      await writeAndRefresh(() => resetChecklist(db, id));
      notify(t('feedback.checklistReset'));
    }
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    switch (row.type) {
      case 'section':
        return (
          <SectionHeader
            title={t(`checklist.section.${row.section}`)}
            checked={row.checked}
            total={row.total}
            collapsed={row.collapsed}
            onPress={() => toggleSection(row.section)}
            testID={`section-${row.section}`}
          />
        );
      case 'entry': {
        const { entry } = row;
        if (entry.kind === 'custom') {
          return (
            <ChecklistRow
              rowKey={row.key}
              name={entry.custom.name}
              summary={entry.custom.note ?? undefined}
              checked={entry.checked}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        }
        const { item } = entry;
        const summary = localize(item.purpose, language);
        const details: RowDetail[] = [];
        if (item.quantityGuidance) {
          details.push({
            label: t('checklist.quantity'),
            text: localize(item.quantityGuidance, language),
          });
        }
        if (item.preparationNote) {
          details.push({
            label: t('checklist.preparationNote'),
            text: localize(item.preparationNote, language),
          });
        }
        if (item.regionalNote) {
          details.push({
            label: t('checklist.regionalNote'),
            text: localize(item.regionalNote, language),
          });
        }
        const length = summary.length + details.reduce((sum, d) => sum + d.text.length, 0);
        return (
          <ChecklistRow
            rowKey={row.key}
            name={localize(item.name, language)}
            summary={summary}
            details={details}
            checked={entry.checked}
            collapsible={length > LONG_ROW}
            expanded={expanded.has(row.key)}
            onToggleExpanded={onToggleExpanded}
            onToggle={onToggle}
            highlighted={highlight === item.samagriId}
          />
        );
      }
      case 'removedHeader':
        return (
          <View style={styles.removedHeader} testID="removed-section">
            <AppText variant="subheading" accessibilityRole="header">
              {t('checklist.removedTitle')}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary">
              {t('checklist.removedBody')}
            </AppText>
          </View>
        );
      case 'removed': {
        const name = row.item.name
          ? localize(row.item.name, language)
          : t('checklist.removedUnknown');
        return (
          <View
            testID={`removed-${row.item.id}`}
            style={[
              styles.removedRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.flex}>
              <AppText variant="subheading" color="textSecondary">
                {name}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('checklist.removedItem')}
              </AppText>
            </View>
            <IconButton
              testID={`forget-${row.item.id}`}
              icon="close"
              color="textSecondary"
              accessibilityLabel={t('checklist.removeLeftover', { name })}
              onPress={() => {
                const id = state?.preparation.id;
                if (id) void writeAndRefresh(() => forgetItem(db, id, row.item.id));
              }}
            />
          </View>
        );
      }
      case 'message': {
        if (row.kind === 'none') {
          return (
            <Card testID="empty-samagri" style={styles.messageCard}>
              <AppText variant="subheading" accessibilityRole="header">
                {t('checklist.emptyTitle')}
              </AppText>
              <AppText color="textSecondary">{t('checklist.emptyBody')}</AppText>
            </Card>
          );
        }
        return (
          <Card testID="empty-filter" style={styles.messageCard}>
            <AppText variant="subheading" accessibilityRole="header">
              {t('checklist.noMatchTitle')}
            </AppText>
            <AppText color="textSecondary">
              {row.kind === 'noCustom' ? t('checklist.noCustomBody') : t('checklist.noMatchBody')}
            </AppText>
            {row.kind === 'noMatch' ? (
              <Button
                variant="outline"
                label={t('checklist.clearFilters')}
                onPress={() => {
                  setFilter('all');
                  setUncheckedOnly(false);
                }}
              />
            ) : null}
          </Card>
        );
      }
    }
  };

  let body;
  if (data.status === 'loading') {
    body = <LoadingState />;
  } else if (data.status === 'error') {
    body = <ErrorState onRetry={data.reload} />;
  } else if (data.status === 'notFound' || !puja) {
    body = (
      <ErrorState
        title={t('checklist.notFoundTitle')}
        body={t('checklist.notFoundBody')}
        actionLabel={t('checklist.openLibrary')}
        onRetry={() => router.navigate('/library')}
      />
    );
  } else {
    const name = localize(puja.name, language);
    const required = progress.required;
    const header = (
      <View style={styles.header}>
        <Card testID="progress-card" style={styles.progressCard}>
          <ProgressBar
            testID="overall-bar"
            value={
              progress.overall.total === 0 ? 0 : progress.overall.checked / progress.overall.total
            }
            label={t('checklist.progressLabel')}
            valueText={t('checklist.overall', progress.overall)}
          />
          <AppText testID="overall-text">{t('checklist.overall', progress.overall)}</AppText>
          <AppText variant="bodySmall" color="textSecondary" testID="counts-text">
            {[
              t('checklist.checkedCount', { count: progress.overall.checked }),
              t('checklist.leftCount', {
                count: progress.overall.total - progress.overall.checked,
              }),
            ].join(' · ')}
          </AppText>
          <View style={[styles.requiredBox, { backgroundColor: colors.surfaceAlt }]}>
            <MaterialCommunityIcons
              name={
                required.total > 0 && required.checked === required.total
                  ? 'check-circle'
                  : 'clipboard-list-outline'
              }
              size={iconSize.md}
              color={colors.primary}
              importantForAccessibility="no"
            />
            <View style={styles.flex}>
              <AppText variant="subheading" testID="required-text">
                {required.total === 0
                  ? t('checklist.requiredNone')
                  : t('checklist.requiredProgress', required)}
              </AppText>
              {required.total > 0 && required.checked === required.total ? (
                <AppText variant="bodySmall" color="textSecondary">
                  {t('checklist.requiredComplete')}
                </AppText>
              ) : null}
            </View>
          </View>
          {state?.preparation.title ? (
            <AppText variant="caption" color="goldText">
              {t('checklist.preparationLabel', { title: state.preparation.title })}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary">
            {t('checklist.autosaveHint')}
          </AppText>
          {puja.reviewStatus !== 'expert_verified' ? (
            <ReviewBadge status={puja.reviewStatus} testID="review-badge" />
          ) : null}
        </Card>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('checklist.filterLabel')}
          style={styles.chips}
        >
          {(['all', ...SECTION_ORDER] as ChecklistFilter[]).map((value) => (
            <Chip
              key={value}
              testID={`filter-${value}`}
              label={t(`checklist.filter.${value}`)}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip
            testID="filter-unchecked"
            role="checkbox"
            label={t('checklist.uncheckedOnly')}
            selected={uncheckedOnly}
            onPress={() => setUncheckedOnly((v) => !v)}
          />
        </View>

        <ButtonRow testID="samagri-actions">
          <Button
            testID="add-item"
            variant="outline"
            icon="plus"
            label={t('checklist.addItem')}
            onPress={openAdd}
            style={buttonRowItem}
          />
          <Button
            testID="reset-checklist"
            variant="outline"
            icon="restart"
            label={t('checklist.reset')}
            disabled={
              !state ||
              (state.checkedSamagriIds.length === 0 && state.checkedCustomIds.length === 0)
            }
            onPress={() => setDialog({ kind: 'reset' })}
            style={buttonRowItem}
          />
        </ButtonRow>
      </View>
    );

    const footer = (
      <Card tone="alt" testID="disclaimer" style={styles.footer}>
        <AppText variant="subheading" accessibilityRole="header">
          {t('settings.disclaimer.title')}
        </AppText>
        <AppText>{t('settings.disclaimer.body')}</AppText>
      </Card>
    );

    body = (
      <>
        <View style={styles.titleBlock}>
          <AppText variant="title" numberOfLines={2} testID="samagri-title">
            {t('checklist.title')}
          </AppText>
          <AppText color="textSecondary" numberOfLines={2}>
            {name}
          </AppText>
        </View>
        <FlatList
          ref={listRef}
          testID="samagri-list"
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          style={styles.flex}
          initialNumToRender={14}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(
              () => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.15 }),
              100,
            );
          }}
        />
      </>
    );
  }

  const editing = dialog.kind === 'add' || dialog.kind === 'edit';
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton
          testID="samagri-back"
          icon="arrow-left"
          color="text"
          accessibilityLabel={t('a11y.goBack')}
          onPress={goBack}
        />
        {puja ? (
          <View style={styles.barActions}>
            <Pressable
              testID="remind-me"
              accessibilityRole="button"
              accessibilityLabel={t('reminders.remindMeFor', {
                name: localize(puja.name, language),
              })}
              onPress={() => setDialog({ kind: 'remind' })}
              android_ripple={{ color: colors.pressed }}
              style={({ pressed }) => [
                styles.remindButton,
                {
                  borderColor: colors.primary,
                  backgroundColor: pressed ? colors.pressed : 'transparent',
                },
              ]}
            >
              <MaterialCommunityIcons
                name="bell-plus-outline"
                size={iconSize.md}
                color={colors.primary}
                importantForAccessibility="no"
              />
              <AppText variant="bodySmall" color="primary" style={styles.remindLabel}>
                {t('reminders.remindMe')}
              </AppText>
            </Pressable>
            <IconButton
              testID="share-checklist"
              icon="share-variant-outline"
              color="primary"
              accessibilityLabel={t('share.actionFor', { name: localize(puja.name, language) })}
              onPress={() => setDialog({ kind: 'share' })}
            />
          </View>
        ) : null}
      </View>
      {body}

      {puja ? (
        <>
          <ReminderSheet
            visible={dialog.kind === 'remind'}
            onClose={closeDialog}
            title={[localize(puja.name, language), state?.preparation.title]
              .filter(Boolean)
              .join(', ')}
            pujaId={puja.id}
            preparationId={state?.preparation.id ?? null}
            getPreparationId={getPreparationId}
          />
          <ShareChecklistDialog
            visible={dialog.kind === 'share'}
            onClose={closeDialog}
            pujaName={puja.name}
            label={state?.preparation.title ?? null}
            entries={entries}
          />
        </>
      ) : null}

      <Dialog
        testID="item-dialog"
        visible={editing}
        title={dialog.kind === 'edit' ? t('checklist.editTitle') : t('checklist.addTitle')}
        onClose={closeDialog}
        actions={[
          {
            label: t('common.save'),
            variant: 'primary',
            testID: 'item-save',
            onPress: () => void saveItem(),
          },
          { label: t('common.cancel'), testID: 'item-cancel', onPress: closeDialog },
        ]}
      >
        <TextField
          testID="item-name"
          label={t('checklist.itemName')}
          value={fieldName}
          maxLength={MAX_ITEM_NAME_LENGTH}
          autoFocus
          onChangeText={(text) => {
            setFieldName(text);
            if (text.trim() !== '') setNameError(false);
          }}
          error={nameError ? t('checklist.itemNameRequired') : undefined}
        />
        <TextField
          testID="item-note"
          label={t('checklist.itemNote')}
          value={fieldNote}
          maxLength={MAX_ITEM_NOTE_LENGTH}
          multiline
          onChangeText={setFieldNote}
        />
      </Dialog>

      <Dialog
        testID="delete-dialog"
        visible={dialog.kind === 'delete'}
        title={t('checklist.deleteTitle')}
        message={
          dialog.kind === 'delete'
            ? t('checklist.deleteBody', { name: dialog.entry.custom.name })
            : undefined
        }
        onClose={closeDialog}
        actions={[
          {
            label: t('checklist.deleteConfirm'),
            variant: 'primary',
            testID: 'delete-confirm',
            onPress: () => void confirmDelete(),
          },
          { label: t('common.cancel'), testID: 'delete-cancel', onPress: closeDialog },
        ]}
      />

      <Dialog
        testID="reset-dialog"
        visible={dialog.kind === 'reset'}
        title={t('checklist.resetTitle')}
        message={t('checklist.resetBody')}
        onClose={closeDialog}
        actions={[
          {
            label: t('checklist.resetConfirm'),
            variant: 'primary',
            testID: 'reset-confirm',
            onPress: () => void confirmReset(),
          },
          { label: t('common.cancel'), testID: 'reset-cancel', onPress: closeDialog },
        ]}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function SectionHeader({
  title,
  checked,
  total,
  collapsed,
  onPress,
  testID,
}: {
  title: string;
  checked: number;
  total: number;
  collapsed: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('checklist.sectionLabel', { name: title, checked, total })}
      accessibilityHint={
        collapsed
          ? t('checklist.expandSection', { name: title })
          : t('checklist.collapseSection', { name: title })
      }
      accessibilityState={{ expanded: !collapsed }}
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.sectionHeader,
        { borderBottomColor: colors.gold },
        pressed && { backgroundColor: colors.pressed },
      ]}
    >
      <AppText variant="heading" style={styles.flex}>
        {title}
      </AppText>
      <AppText variant="subheading" color="goldText" testID={`${testID}-count`}>
        {t('checklist.sectionCount', { checked, total })}
      </AppText>
      <MaterialCommunityIcons
        name={collapsed ? 'chevron-down' : 'chevron-up'}
        size={iconSize.md}
        color={colors.primary}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  barActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  remindButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1.5,
    flexShrink: 1,
  },
  remindLabel: { flexShrink: 1, textAlign: 'center' },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  titleBlock: {
    paddingHorizontal: spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.xxs,
    paddingBottom: spacing.xs,
  },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  progressCard: { gap: spacing.xs },
  requiredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    padding: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingTop: spacing.sm,
    borderBottomWidth: 1.5,
    marginTop: spacing.xs,
  },
  separator: { height: spacing.xs },
  messageCard: { gap: spacing.xs },
  removedHeader: { gap: spacing.xxs, marginTop: spacing.md },
  removedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingLeft: spacing.sm,
    minHeight: minTouchTarget,
  },
  footer: { marginTop: spacing.lg },
});
