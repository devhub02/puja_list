/**
 * TEST FIXTURE, not real content. A puja shaped to exercise the Samagri and Vidhi screens:
 * 2 required, 2 commonly used, 3 optional items (one with long notes), 5 steps (a safety note, an optional
 * step, an important note, related samagri), plus a puja with no samagri and no steps.
 */
import type { ContentBundle } from '@/db/types';

import { makeFixtureBundle } from './contentFixture';

const fixture = (text: string) => ({ en: `${text} (fixture)`, hi: `${text} (परीक्षण)` });

export const RICH_ID = 'puja_test_rich';
export const EMPTY_ID = 'puja_test_empty';

export function makePreparationBundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  const base = makeFixtureBundle();
  const ids = ['r1', 'r2', 'c1', 'c2', 'o1', 'o2', 'o3'];
  return {
    ...base,
    samagri: [
      ...base.samagri,
      ...ids.map((id) => ({
        id: `sm_${id}`,
        name: fixture(`Item ${id}`),
        status: 'active' as const,
      })),
    ],
    pujas: [
      ...base.pujas,
      {
        id: RICH_ID,
        name: fixture('Rich Puja'),
        category: 'household',
        regions: ['pan_india'],
        summary: { en: 'TEST FIXTURE, not real content.' },
        significance: { en: 'TEST FIXTURE, not real content.' },
        samagri: [
          { id: 'r1', c: 'REQUIRED' },
          { id: 'r2', c: 'REQUIRED' },
          { id: 'c1', c: 'COMMON' },
          { id: 'c2', c: 'COMMON' },
          { id: 'o1', c: 'OPTIONAL' },
          { id: 'o2', c: 'OPTIONAL' },
          { id: 'o3', c: 'OPTIONAL' },
        ].map(({ id, c }, i) => ({
          samagriId: `sm_${id}`,
          classification: c as 'REQUIRED' | 'COMMON' | 'OPTIONAL',
          purpose: fixture(`Purpose of ${id}`),
          ...(id === 'r1' ? { quantityGuidance: { en: 'As needed' } } : {}),
          ...(id === 'o1'
            ? {
                quantityGuidance: { en: 'Quantity per family custom' },
                preparationNote: {
                  en: 'A long preparation note that goes on and on to make this row long enough to fold behind show more.',
                },
                regionalNote: { en: 'Followed in some regions only, not everywhere.' },
              }
            : {}),
          sortOrder: i + 1,
        })),
        steps: [
          {
            id: 'step_rich_1',
            stepNumber: 1,
            title: { en: 'Prepare the space', hi: 'स्थान तैयार करें' },
            description: { en: 'Step one description.', hi: 'चरण एक का विवरण।' },
            relatedSamagriIds: ['sm_r1', 'sm_o1'],
            isOptional: false,
          },
          {
            id: 'step_rich_2',
            stepNumber: 2,
            title: { en: 'Safety Note: open flame' },
            description: { en: 'Keep the lamp away from curtains.' },
            relatedSamagriIds: [],
            isOptional: false,
          },
          {
            id: 'step_rich_3',
            stepNumber: 3,
            title: { en: 'Optional offering' },
            description: { en: 'Step three description.' },
            relatedSamagriIds: ['sm_c1'],
            isOptional: true,
            importantNote: { en: 'Recitation as per family tradition or pandit.' },
          },
          {
            id: 'step_rich_4',
            stepNumber: 4,
            title: { en: 'Main offering' },
            description: { en: 'Step four description.' },
            relatedSamagriIds: [],
            isOptional: false,
          },
          {
            id: 'step_rich_5',
            stepNumber: 5,
            title: { en: 'Closing' },
            description: { en: 'Step five description.' },
            relatedSamagriIds: [],
            isOptional: false,
          },
        ],
        variations: [],
        reviewStatus: 'ai_drafted',
        sourceNote: { en: 'TEST FIXTURE, not real content.' },
        contentVersion: 1,
        status: 'active',
      },
      {
        id: EMPTY_ID,
        name: fixture('Empty Puja'),
        category: 'vrat',
        regions: ['south'],
        summary: { en: 'TEST FIXTURE, not real content.' },
        significance: { en: 'TEST FIXTURE, not real content.' },
        samagri: [],
        steps: [],
        variations: [],
        reviewStatus: 'expert_verified',
        sourceNote: { en: 'TEST FIXTURE, not real content.' },
        contentVersion: 1,
        status: 'active',
      },
    ],
    ...overrides,
  };
}
