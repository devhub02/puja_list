import { useTranslation } from 'react-i18next';

import { getChecklistState, getPreparation, getPuja } from '@/db/repositories';
import type { PujaDetail } from '@/db/types';
import { useDbQuery } from '@/hooks/useDbQuery';
import { buildEntries } from '@/utils/checklistEntries';
import type { ChecklistState } from '@/db/repositories';

import { Dialog } from './Dialog';
import { ShareChecklistDialog } from './ShareChecklistDialog';

type Loaded = { puja: PujaDetail; state: ChecklistState } | 'unavailable';

/** Share dialog for a preparation chosen from a list: loads its puja and checklist first. */
export function SharePreparationDialog({
  preparationId,
  onClose,
}: {
  preparationId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const query = useDbQuery<Loaded | null>(
    async (db) => {
      if (!preparationId) return null;
      const preparation = await getPreparation(db, preparationId);
      if (!preparation) return 'unavailable';
      const puja = await getPuja(db, preparation.pujaId);
      const state = await getChecklistState(db, preparationId);
      if (!puja || puja.status !== 'active' || !state) return 'unavailable';
      return { puja, state };
    },
    `share:${preparationId ?? ''}`,
  );

  if (!preparationId) return null;
  if (query.status === 'ready' && query.data && query.data !== 'unavailable') {
    const { puja, state } = query.data;
    return (
      <ShareChecklistDialog
        visible
        onClose={onClose}
        pujaName={puja.name}
        label={state.preparation.title}
        entries={buildEntries(puja.samagri, state)}
      />
    );
  }
  const message =
    query.status === 'ready'
      ? t('share.unavailable')
      : query.status === 'error'
        ? t('common.errorBody')
        : t('common.loading');
  return (
    <Dialog
      testID="share-unavailable-dialog"
      visible
      title={t('share.title')}
      message={message}
      onClose={onClose}
      actions={[{ label: t('common.close'), testID: 'share-unavailable-close', onPress: onClose }]}
    />
  );
}
