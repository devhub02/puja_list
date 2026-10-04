/**
 * The ONE place that maps content ids to bundled artwork (Metro needs static require paths).
 * Puja image -> category image -> null (callers draw a vector icon). A missing entry never throws.
 * File naming: assets/images/pujas/puja-<puja id without the "puja_" prefix, "_" as "-">.webp and
 * assets/images/categories/category-<category id>.webp.
 */
import type { ImageSourcePropType } from 'react-native';

const pujaImages: Record<string, ImageSourcePropType> = {
  puja_bhai_dooj: require('../../assets/images/pujas/puja-bhai-dooj.webp'),
  puja_chhath: require('../../assets/images/pujas/puja-chhath.webp'),
  puja_diwali_lakshmi_puja: require('../../assets/images/pujas/puja-diwali-lakshmi-puja.webp'),
  puja_ganesh_chaturthi: require('../../assets/images/pujas/puja-ganesh-chaturthi.webp'),
  puja_govardhan: require('../../assets/images/pujas/puja-govardhan.webp'),
  puja_hanuman_puja: require('../../assets/images/pujas/puja-hanuman-puja.webp'),
  puja_hartalika_teej: require('../../assets/images/pujas/puja-hartalika-teej.webp'),
  puja_janmashtami: require('../../assets/images/pujas/puja-janmashtami.webp'),
  puja_jitiya: require('../../assets/images/pujas/puja-jitiya.webp'),
  puja_karwa_chauth: require('../../assets/images/pujas/puja-karwa-chauth.webp'),
  puja_maha_shivratri: require('../../assets/images/pujas/puja-maha-shivratri.webp'),
  puja_navratri_durga_puja: require('../../assets/images/pujas/puja-navratri-durga-puja.webp'),
  puja_raksha_bandhan: require('../../assets/images/pujas/puja-raksha-bandhan.webp'),
  puja_saraswati_puja: require('../../assets/images/pujas/puja-saraswati-puja.webp'),
  puja_satyanarayan_puja: require('../../assets/images/pujas/puja-satyanarayan-puja.webp'),
  puja_vishwakarma: require('../../assets/images/pujas/puja-vishwakarma.webp'),
};

/** Only categories with artwork are listed; the others (festival, life_cycle, tribal) use the icon fallback. */
const categoryImages: Record<string, ImageSourcePropType> = {
  household: require('../../assets/images/categories/category-household.webp'),
  regional: require('../../assets/images/categories/category-regional.webp'),
  vrat: require('../../assets/images/categories/category-vrat.webp'),
};

const has = (map: Record<string, ImageSourcePropType>, key: string | undefined) =>
  key !== undefined && Object.prototype.hasOwnProperty.call(map, key);

export function getCategoryImage(categoryId: string | undefined): ImageSourcePropType | null {
  return has(categoryImages, categoryId) ? categoryImages[categoryId as string] : null;
}

/** Puja artwork, else its category artwork, else null. */
export function getPujaImage(pujaId: string, categoryId?: string): ImageSourcePropType | null {
  if (has(pujaImages, pujaId)) return pujaImages[pujaId];
  return getCategoryImage(categoryId);
}

/** App icon artwork, shown as the logo on Home. */
export const appIconImage: ImageSourcePropType = require('../../assets/images/brand/app-icon.png');
