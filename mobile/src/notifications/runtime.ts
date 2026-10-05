/**
 * Connects the reminder logic to the running app: the installed scheduler, the clock, the global switch and
 * the translated notification text. Everything with a decision in it lives in `reminderService`.
 */
import { getPreparation, getPuja } from '@/db/repositories';
import type { SqlDb } from '@/db/sqlDb';
import i18n from '@/i18n';
import { localize } from '@/i18n/localeMap';
import { useReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePreparationStore } from '@/store/preparationStore';

import { reconcileReminders } from './reminderService';
import type { NotificationContent, ReminderDeps } from './reminderService';
import { getNotificationScheduler, hasNotificationScheduler } from './scheduler';
import type { ChannelDefinition } from './scheduler';

/** Channel name and description in the selected language (fallback English). */
export function channelDefinition(): ChannelDefinition {
  const t = i18n.getFixedT(useSettingsStore.getState().language);
  return { name: t('reminders.channelName'), description: t('reminders.channelDescription') };
}

/**
 * Title = the puja's name, body = one generic line. Nothing else: no label, no mantra, no invented text.
 * The language is the one selected when the reminder is scheduled; a puja that no longer exists gets a
 * generic title.
 */
export async function buildNotificationContent(
  db: SqlDb,
  preparationId: string,
): Promise<NotificationContent> {
  const language = useSettingsStore.getState().language;
  const t = i18n.getFixedT(language);
  const preparation = await getPreparation(db, preparationId);
  const puja = preparation ? await getPuja(db, preparation.pujaId) : null;
  return {
    title: puja ? localize(puja.name, language) : t('reminders.notificationFallbackTitle'),
    body: t('reminders.notificationBody'),
  };
}

export function createReminderDeps(db: SqlDb): ReminderDeps {
  return {
    db,
    scheduler: getNotificationScheduler(),
    now: () => new Date(),
    isEnabled: () => useSettingsStore.getState().notificationsEnabled,
    content: (preparationId) => buildNotificationContent(db, preparationId),
  };
}

/** Reconciles and tells the reminder screens to re-read. Never throws (a failure is logged). */
export async function reconcileAndRefresh(db: SqlDb): Promise<void> {
  try {
    if (hasNotificationScheduler()) await reconcileReminders(createReminderDeps(db));
  } catch (error) {
    console.error('Reminder reconcile failed', error);
  } finally {
    useReminderStore.getState().bump();
    // A past reminder newly marked done changes nothing in preparations, but cards show reminder counts.
    usePreparationStore.getState().bump();
  }
}
