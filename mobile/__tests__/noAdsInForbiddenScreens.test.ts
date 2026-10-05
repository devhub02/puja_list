import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CLAUDE.md "Ads rules" forbids AdSlot on these screens/components. Rendering every one of them
 * needs a seeded database and heavy fixtures that already exist per-screen in other test files
 * (vidhiScreen, preparationTab, reminderScreens, settingsScreen, calendarScreen, ...); instead of
 * duplicating all of that setup, this is a static source check: none of these files may import
 * `AdSlot` at all, which is a stronger guarantee than "not currently rendered".
 */
const FORBIDDEN_FILES = [
  'app/puja/[id]/vidhi.tsx',
  'app/puja/[id]/samagri.tsx',
  'app/puja/[id]/index.tsx',
  'app/(tabs)/preparation.tsx',
  'app/(tabs)/settings.tsx',
  'app/(tabs)/calendar.tsx',
  'app/festival/[id].tsx',
  'app/reminders.tsx',
  'src/components/ReminderSheet.tsx',
  'src/components/ReminderDialogs.tsx',
  'src/components/Dialog.tsx',
  'src/components/ResetLocalDataDialog.tsx',
];

describe('no AdSlot in forbidden screens', () => {
  for (const file of FORBIDDEN_FILES) {
    it(`${file} does not import AdSlot`, () => {
      const text = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(text).not.toMatch(/AdSlot/);
    });
  }
});
