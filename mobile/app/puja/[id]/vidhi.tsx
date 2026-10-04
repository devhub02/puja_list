import { MaterialCommunityIcons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextSizeControl } from '@/components/TextSizeControl';
import { useDatabase } from '@/db/DatabaseProvider';
import {
  ensureDefaultPreparation,
  markVidhiCompleted,
  restartVidhi,
  saveVidhiPosition,
} from '@/db/repositories';
import { usePujaPreparation, useTouchOnOpen } from '@/hooks/usePreparation';
import { localize } from '@/i18n/localeMap';
import { writeAndRefresh } from '@/store/preparationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { iconSize, radius, spacing } from '@/theme/tokens';
import { extractSafetyNotes } from '@/utils/pujaDisplay';

const KEEP_AWAKE_TAG = 'vidhi-reader';

type Stage = { kind: 'safety' } | { kind: 'step'; index: number } | { kind: 'done' };

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default function VidhiScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const params = useLocalSearchParams<{ id?: string | string[]; prep?: string | string[] }>();
  const pujaId = first(params.id);

  const [prepId, setPrepId] = useState<string | null>(first(params.prep) ?? null);
  const data = usePujaPreparation(pujaId, prepId);
  const [stageState, setStageState] = useState<Stage | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const ready = data.status === 'ready' ? data : null;
  const state = ready?.state ?? null;
  const steps = useMemo(() => ready?.puja.steps ?? [], [ready]);
  const safety = useMemo(() => extractSafetyNotes(steps), [steps]);

  useTouchOnOpen(state?.preparation.id ?? null);

  // Keep the screen awake while reading. Released when leaving. Never allowed to break the screen.
  useEffect(() => {
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, []);

  // Where to start: finished -> the Completed screen; saved position -> that step; otherwise the safety
  // notes (when the puja has any) or step 1. Worked out once from the first answer; after that only the
  // user's taps move the reader (adjusting state while rendering is React's pattern for this).
  const [initialStage, setInitialStage] = useState<Stage | null>(null);
  if (initialStage === null && ready) {
    const vidhi = ready.vidhi;
    const saved = vidhi ? steps.findIndex((s) => s.stepNumber === vidhi.lastStepNumber) : -1;
    setInitialStage(
      steps.length > 0 && vidhi?.completedAt != null
        ? { kind: 'done' }
        : saved > 0
          ? { kind: 'step', index: saved }
          : steps.length > 0 && safety.length > 0
            ? { kind: 'safety' }
            : { kind: 'step', index: 0 },
    );
  }
  const stage = stageState ?? initialStage;

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/')),
    [router],
  );

  /** The preparation to write to: the one in use, or the default created now. */
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

  const showStep = (index: number) => {
    setStageState({ kind: 'step', index });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Saved as you read. The first preparation is created when you move past step 1, not before.
    if (state || index > 0) {
      const stepNumber = steps[index].stepNumber;
      void withPreparation((id) => saveVidhiPosition(db, id, stepNumber));
    }
  };

  const finish = () => {
    setStageState({ kind: 'done' });
    const last = steps[steps.length - 1].stepNumber;
    void withPreparation((id) => markVidhiCompleted(db, id, last));
  };

  const restart = () => {
    setStageState({ kind: 'step', index: 0 });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const id = state?.preparation.id;
    if (id) void writeAndRefresh(() => restartVidhi(db, id));
  };

  const openSamagri = (samagriId?: string) => {
    if (!pujaId) return;
    const id = state?.preparation.id;
    router.push({
      pathname: '/puja/[id]/samagri',
      params: {
        id: pujaId,
        ...(id ? { prep: id } : {}),
        ...(samagriId ? { focus: samagriId } : {}),
      },
    });
  };

  const safetyCard = (
    <View style={styles.safetyList}>
      {safety.map((note) => (
        <View key={note.id} style={styles.note}>
          <AppText variant="subheading">{localize(note.title, language)}</AppText>
          <AppText>{localize(note.description, language)}</AppText>
        </View>
      ))}
    </View>
  );

  let body;
  let footer = null;
  let headerExtra = null;

  if (data.status === 'loading' || (data.status === 'ready' && stage === null)) {
    body = <LoadingState />;
  } else if (data.status === 'error') {
    body = <ErrorState onRetry={data.reload} />;
  } else if (data.status === 'notFound' || !ready || stage === null) {
    body = (
      <ErrorState
        title={t('checklist.notFoundTitle')}
        body={t('checklist.notFoundBody')}
        actionLabel={t('checklist.openLibrary')}
        onRetry={() => router.navigate('/library')}
      />
    );
  } else if (steps.length === 0) {
    body = (
      <EmptyState
        icon="book-open-variant"
        title={t('vidhi.noSteps')}
        body={t('vidhi.noStepsBody')}
      />
    );
  } else {
    const total = steps.length;
    const index = stage.kind === 'step' ? stage.index : stage.kind === 'done' ? total : 0;
    const shown = Math.min(Math.max(index + 1, 1), total);
    headerExtra = (
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <AppText variant="subheading" color="heading" testID="step-counter" style={styles.flex}>
            {stage.kind === 'safety'
              ? t('vidhi.safetyTitle')
              : stage.kind === 'done'
                ? t('vidhi.completedTitle')
                : t('vidhi.stepOf', { n: shown, total })}
          </AppText>
          <TextSizeControl />
        </View>
        <ProgressBar
          testID="reading-progress"
          value={stage.kind === 'step' ? shown / total : stage.kind === 'done' ? 1 : 0}
          label={t('vidhi.progressLabel')}
          valueText={
            stage.kind === 'done'
              ? t('vidhi.completedTitle')
              : t('vidhi.stepOf', { n: stage.kind === 'step' ? shown : 0, total })
          }
        />
      </View>
    );

    if (stage.kind === 'safety') {
      body = (
        <Card
          tone="alt"
          testID="safety-intro"
          style={[styles.safetyCard, { borderColor: colors.primary }]}
        >
          <View style={styles.row}>
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={iconSize.lg}
              color={colors.primary}
              importantForAccessibility="no"
            />
            <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
              {t('vidhi.safetyTitle')}
            </AppText>
          </View>
          <AppText color="textSecondary">{t('vidhi.safetyIntro')}</AppText>
          {safetyCard}
          <Button
            testID="safety-start"
            label={t('vidhi.safetyStart')}
            onPress={() => showStep(0)}
          />
        </Card>
      );
    } else if (stage.kind === 'done') {
      body = (
        <View style={styles.doneBlock} testID="completed">
          <EmptyState
            icon="check-decagram"
            title={t('vidhi.completedTitle')}
            body={t('vidhi.completedBody', { count: total })}
            action={{ label: t('vidhi.restart'), onPress: restart }}
          />
          <Button
            testID="open-checklist"
            variant="outline"
            icon="basket-outline"
            label={t('vidhi.openChecklist')}
            onPress={() => openSamagri()}
          />
          <Button
            testID="back-to-puja"
            variant="outline"
            icon="arrow-left"
            label={t('vidhi.backToPuja')}
            onPress={goBack}
          />
        </View>
      );
    } else {
      const step = steps[stage.index];
      const title = localize(step.title, language);
      const related = step.relatedSamagriIds
        .map((id) => ready.puja.samagri.find((s) => s.samagriId === id))
        .filter((s) => s !== undefined);
      const last = stage.index === total - 1;
      body = (
        <View style={styles.reader} testID={`step-${step.stepNumber}`}>
          <AppText
            variant="heading"
            testID="step-title"
            accessibilityLabel={t('vidhi.stepLabel', { n: shown, total, title })}
          >
            {title}
          </AppText>
          {step.isOptional ? (
            <View
              testID="optional-marker"
              accessible
              style={[
                styles.pill,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.gold },
              ]}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={iconSize.sm}
                color={colors.goldText}
                importantForAccessibility="no"
              />
              <AppText variant="bodySmall" color="goldText">
                {t('vidhi.optionalStep')}
              </AppText>
            </View>
          ) : null}
          <AppText testID="step-description">{localize(step.description, language)}</AppText>
          {step.importantNote ? (
            <Card
              tone="alt"
              testID="important-note"
              style={[styles.important, { borderColor: colors.primary }]}
            >
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={iconSize.md}
                  color={colors.primary}
                  importantForAccessibility="no"
                />
                <AppText variant="subheading" accessibilityRole="header">
                  {t('vidhi.important')}
                </AppText>
              </View>
              <AppText>{localize(step.importantNote, language)}</AppText>
            </Card>
          ) : null}
          {related.length > 0 ? (
            <View style={styles.relatedBlock} testID="related-samagri">
              <AppText variant="subheading" accessibilityRole="header">
                {t('vidhi.relatedSamagri')}
              </AppText>
              <View style={styles.chips}>
                {related.map((item) => {
                  const name = localize(item.name, language);
                  return (
                    <Chip
                      key={item.samagriId}
                      testID={`related-${item.samagriId}`}
                      role="button"
                      label={name}
                      selected={false}
                      onPress={() => openSamagri(item.samagriId)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      );
      footer = (
        <View
          style={[
            styles.nav,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.xs) + spacing.xs,
            },
          ]}
        >
          <View style={styles.flex}>
            <Button
              testID="prev-step"
              variant="outline"
              icon="chevron-left"
              label={t('vidhi.previous')}
              disabled={stage.index === 0}
              onPress={() => showStep(stage.index - 1)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              testID="next-step"
              icon={last ? 'check' : 'chevron-right'}
              label={last ? t('vidhi.finish') : t('vidhi.next')}
              onPress={() => (last ? finish() : showStep(stage.index + 1))}
            />
          </View>
        </View>
      );
    }
  }

  const title = ready ? localize(ready.puja.name, language) : t('vidhi.title');
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton
          testID="vidhi-back"
          icon="arrow-left"
          color="text"
          accessibilityLabel={t('a11y.goBack')}
          onPress={goBack}
        />
        <View style={styles.flex}>
          <AppText variant="caption" color="goldText">
            {t('vidhi.title')}
          </AppText>
          <AppText variant="subheading" numberOfLines={1} testID="vidhi-puja-name">
            {title}
          </AppText>
        </View>
        {safety.length > 0 ? (
          <IconButton
            testID="open-safety"
            icon="shield-alert-outline"
            accessibilityLabel={t('vidhi.safetyOpen')}
            onPress={() => setSafetyOpen(true)}
          />
        ) : null}
      </View>
      {headerExtra}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
      {footer}

      <Dialog
        testID="safety-dialog"
        visible={safetyOpen}
        title={t('vidhi.safetyTitle')}
        onClose={() => setSafetyOpen(false)}
        actions={[
          {
            label: t('common.close'),
            variant: 'primary',
            testID: 'safety-close',
            onPress: () => setSafetyOpen(false),
          },
        ]}
      >
        {safetyCard}
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  progress: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  reader: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  important: { borderWidth: 1.5, gap: spacing.xs },
  relatedBlock: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  safetyCard: { borderWidth: 1.5, gap: spacing.sm },
  safetyList: { gap: spacing.sm },
  note: { gap: spacing.xxs },
  doneBlock: { gap: spacing.sm },
  nav: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
