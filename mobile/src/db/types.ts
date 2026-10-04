/** Domain types returned by repositories. User-visible text stays as locale maps (resolved in the UI). */
import type { LocaleMap } from '@/i18n/localeMap';

export type AltNames = Record<string, string[]>;

export type Classification = 'REQUIRED' | 'COMMON' | 'OPTIONAL';
export type ReviewStatus = 'ai_drafted' | 'cross_checked' | 'expert_verified';
export type DateCertainty = 'confirmed' | 'provisional' | 'varies_by_region';
export type EntityStatus = 'active' | 'deprecated';
export type Region =
  'north' | 'east' | 'south' | 'west' | 'central' | 'north_east' | 'tribal_regional' | 'pan_india';
export type PujaCategory = 'festival' | 'vrat' | 'household' | 'life_cycle' | 'regional' | 'tribal';

export type PujaSummary = {
  id: string;
  festivalId?: string;
  name: LocaleMap;
  alternateNames?: AltNames;
  category: PujaCategory;
  regions: Region[];
  summary: LocaleMap;
  reviewStatus: ReviewStatus;
  status: EntityStatus;
};

export type PujaSamagriItem = {
  samagriId: string;
  name: LocaleMap;
  description?: LocaleMap;
  classification: Classification;
  purpose: LocaleMap;
  quantityGuidance?: LocaleMap;
  preparationNote?: LocaleMap;
  regionalNote?: LocaleMap;
  sortOrder: number;
};

export type VidhiStep = {
  id: string;
  stepNumber: number;
  title: LocaleMap;
  description: LocaleMap;
  relatedSamagriIds: string[];
  isOptional: boolean;
  importantNote?: LocaleMap;
};

export type RegionalVariation = {
  id: string;
  regions: Region[];
  title: LocaleMap;
  description: LocaleMap;
  affectsStepIds: string[];
  affectsSamagriIds: string[];
};

export type ChecklistTemplateItem = {
  id: string;
  text: LocaleMap;
  daysBefore: number;
};

export type PujaDetail = PujaSummary & {
  significance: LocaleMap;
  sourceNote: LocaleMap;
  /** Absent means "use the standard disclaimer from the locale files". */
  disclaimer?: LocaleMap;
  contentVersion: number;
  samagri: PujaSamagriItem[];
  steps: VidhiStep[];
  variations: RegionalVariation[];
  checklist: ChecklistTemplateItem[];
};

export type CalendarDate = {
  id: string;
  festivalId: string;
  year: number;
  /** ISO YYYY-MM-DD, exactly as bundled and verified. Never computed. */
  date: string;
  endDate?: string;
  certainty: DateCertainty;
  regionNote?: LocaleMap;
  source: string;
};

export type Festival = {
  id: string;
  name: LocaleMap;
  alternateNames?: AltNames;
  description: LocaleMap;
  significance: LocaleMap;
  regions: Region[];
  status: EntityStatus;
};

/** A festival with its bundled dates. Empty `dates` means "date not available" for the requested year. */
export type FestivalWithDates = Festival & { dates: CalendarDate[] };

export type SearchEntityType = 'puja' | 'festival' | 'samagri';

export type SearchResult = {
  entityType: SearchEntityType;
  entityId: string;
  name: LocaleMap;
  /** 1 = best match. */
  rank: number;
};

export type ContentInfo = {
  contentVersion: number | null;
  schemaVersion: number | null;
  pujaCount: number;
  seededAt: number | null;
};

/** Shape of mobile/assets/puja_data/content.json, written by scripts/export_content.py. */
export type ContentBundle = {
  schemaVersion: number;
  contentVersion: number;
  checksum: string;
  languages: string[];
  festivals: BundleFestival[];
  pujas: BundlePuja[];
  samagri: BundleSamagri[];
  calendar: { year: number; entries: BundleCalendarEntry[] }[];
};

export type BundleFestival = Festival & { alternateNames?: AltNames; pujaIds: string[] };
export type BundleSamagri = {
  id: string;
  name: LocaleMap;
  alternateNames?: AltNames;
  description?: LocaleMap;
  status: EntityStatus;
};
export type BundlePuja = {
  id: string;
  festivalId?: string;
  name: LocaleMap;
  alternateNames?: AltNames;
  category: PujaCategory;
  regions: Region[];
  summary: LocaleMap;
  significance: LocaleMap;
  samagri: {
    samagriId: string;
    classification: Classification;
    purpose: LocaleMap;
    quantityGuidance?: LocaleMap;
    preparationNote?: LocaleMap;
    regionalNote?: LocaleMap;
    sortOrder: number;
  }[];
  steps: VidhiStep[];
  variations: RegionalVariation[];
  preparationChecklist?: ChecklistTemplateItem[];
  disclaimer?: LocaleMap;
  reviewStatus: ReviewStatus;
  sourceNote: LocaleMap;
  contentVersion: number;
  status: EntityStatus;
};
export type BundleCalendarEntry = {
  id: string;
  festivalId: string;
  date: string;
  endDate?: string;
  certainty: DateCertainty;
  regionNote?: LocaleMap;
  source: string;
};
