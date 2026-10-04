import { useTranslation } from 'react-i18next';

import { IconButton } from './IconButton';

type Props = { pujaId: string; name: string; saved: boolean; onToggle: (pujaId: string) => void };

/** Heart toggle for a puja; the accessible label says what pressing it will do. */
export function FavoriteButton({ pujaId, name, saved, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <IconButton
      testID={`favorite-${pujaId}`}
      icon={saved ? 'heart' : 'heart-outline'}
      selected={saved}
      accessibilityLabel={
        saved ? t('a11y.favoriteRemove', { name }) : t('a11y.favoriteAdd', { name })
      }
      onPress={() => onToggle(pujaId)}
    />
  );
}
