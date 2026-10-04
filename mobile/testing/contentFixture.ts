/**
 * TEST FIXTURE, not real content.
 * Made-up entries that exist only to exercise seeding, repositories and search. Names such as "Lakshmi"
 * are used because search needs realistic spellings; no vidhi, samagri guidance or significance here is
 * authoritative, and none of this is shipped (it lives in testing/, not in content/ or assets/).
 */
import type { ContentBundle } from '@/db/types';

export function makeFixtureBundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    schemaVersion: 2,
    contentVersion: 1,
    checksum: 'sha256:fixture-1',
    languages: ['en', 'hi'],
    festivals: [
      {
        id: 'fest_test_lamps',
        name: { en: 'Test Festival of Lamps', hi: 'परीक्षण दीप पर्व' },
        alternateNames: { en: ['Test Deepavali'], hi: ['परीक्षण दीपावली'] },
        shortDescription: {
          en: 'TEST FIXTURE, not real content.',
          hi: 'परीक्षण, असली सामग्री नहीं।',
        },
        regions: ['pan_india'],
        states: [{ en: 'Test State', hi: 'परीक्षण राज्य' }],
        category: 'deity_festival',
        dateType: 'lunar',
        observanceDescription: {
          en: 'TEST FIXTURE: check a local panchang for the exact date.',
          hi: 'परीक्षण: सही तिथि के लिए स्थानीय पंचांग देखें।',
        },
        linkedPujaIds: ['puja_test_lakshmi'],
        reviewStatus: 'ai_drafted',
        sourceNote: { en: 'TEST FIXTURE, not real content.', hi: 'परीक्षण, असली सामग्री नहीं।' },
        status: 'active',
      },
      {
        id: 'fest_test_old',
        name: { en: 'Test Retired Festival', hi: 'परीक्षण पुराना पर्व' },
        shortDescription: {
          en: 'TEST FIXTURE, not real content.',
          hi: 'परीक्षण, असली सामग्री नहीं।',
        },
        regions: ['north'],
        category: 'harvest_seasonal',
        dateType: 'solar',
        linkedPujaIds: [],
        reviewStatus: 'ai_drafted',
        sourceNote: { en: 'TEST FIXTURE, not real content.', hi: 'परीक्षण, असली सामग्री नहीं।' },
        status: 'deprecated',
      },
    ],
    samagri: [
      {
        id: 'sm_test_lamp',
        name: { en: 'Test Lamp', hi: 'परीक्षण दीपक' },
        alternateNames: { en: ['Test Diya'], hi: ['परीक्षण दिया'] },
        status: 'active',
      },
      {
        id: 'sm_test_flower',
        name: { en: 'Test Flowers', hi: 'परीक्षण फूल' },
        description: { en: 'TEST FIXTURE, not real content.' },
        status: 'active',
      },
      { id: 'sm_test_unused', name: { en: 'Test Unused Item' }, status: 'active' },
    ],
    pujas: [
      {
        id: 'puja_test_lakshmi',
        festivalId: 'fest_test_lamps',
        name: { en: 'Lakshmi Puja (test)', hi: 'लक्ष्मी पूजा (परीक्षण)' },
        alternateNames: {
          en: ['Laxmi Pujan', 'Lakshmi Pooja'],
          hi: ['लक्ष्मी पूजन', 'लक्षमी पूजा'],
        },
        category: 'festival',
        regions: ['pan_india'],
        summary: { en: 'TEST FIXTURE, not real content.' },
        significance: { en: 'TEST FIXTURE, not real content.' },
        samagri: [
          {
            samagriId: 'sm_test_flower',
            classification: 'COMMON',
            purpose: { en: 'fixture' },
            quantityGuidance: { en: 'as needed' },
            sortOrder: 2,
          },
          {
            samagriId: 'sm_test_lamp',
            classification: 'REQUIRED',
            purpose: { en: 'fixture' },
            sortOrder: 1,
          },
        ],
        steps: [
          {
            id: 'step_test_lakshmi_2',
            stepNumber: 2,
            title: { en: 'Fixture step two' },
            description: { en: 'fixture' },
            relatedSamagriIds: [],
            isOptional: true,
          },
          {
            id: 'step_test_lakshmi_1',
            stepNumber: 1,
            title: { en: 'Fixture step one', hi: 'परीक्षण चरण एक' },
            description: { en: 'fixture' },
            relatedSamagriIds: ['sm_test_lamp'],
            isOptional: false,
            importantNote: { en: 'fixture note' },
          },
        ],
        variations: [
          {
            id: 'var_test_lakshmi_1',
            regions: ['east'],
            title: { en: 'Fixture variation' },
            description: { en: 'fixture' },
            affectsStepIds: ['step_test_lakshmi_2'],
            affectsSamagriIds: [],
          },
        ],
        preparationChecklist: [
          { id: 'chk_test_lakshmi_late', text: { en: 'fixture late' }, daysBefore: 1 },
          { id: 'chk_test_lakshmi_early', text: { en: 'fixture early' }, daysBefore: 7 },
        ],
        reviewStatus: 'ai_drafted',
        sourceNote: { en: 'TEST FIXTURE, not real content.' },
        contentVersion: 1,
        status: 'active',
      },
      {
        id: 'puja_test_vrat',
        name: { en: 'Test Weekly Vrat' },
        category: 'vrat',
        regions: ['south'],
        summary: { en: 'TEST FIXTURE, not real content.' },
        significance: { en: 'TEST FIXTURE, not real content.' },
        samagri: [
          {
            samagriId: 'sm_test_flower',
            classification: 'OPTIONAL',
            purpose: { en: 'fixture' },
            sortOrder: 1,
          },
        ],
        steps: [],
        variations: [],
        reviewStatus: 'expert_verified',
        sourceNote: { en: 'TEST FIXTURE, not real content.' },
        contentVersion: 1,
        status: 'active',
      },
      {
        id: 'puja_test_retired',
        name: { en: 'Lakshmi Retired Puja (test)' },
        category: 'household',
        regions: ['west'],
        summary: { en: 'TEST FIXTURE, not real content.' },
        significance: { en: 'TEST FIXTURE, not real content.' },
        samagri: [],
        steps: [],
        variations: [],
        reviewStatus: 'cross_checked',
        sourceNote: { en: 'TEST FIXTURE, not real content.' },
        contentVersion: 1,
        status: 'deprecated',
      },
    ],
    calendar: [
      {
        year: 2031,
        entries: [
          {
            id: 'cal_test_2031_lamps',
            festivalId: 'fest_test_lamps',
            date: '2031-10-30',
            endDate: '2031-11-02',
            certainty: 'provisional',
            regionNote: { en: 'fixture' },
            source: 'TEST FIXTURE',
          },
        ],
      },
    ],
    ...overrides,
  };
}
