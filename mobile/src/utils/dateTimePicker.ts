/**
 * The system date and time pickers (Android dialogs from `@react-native-community/datetimepicker`, which works
 * in Expo Go). Kept behind two small promise functions so screens and tests do not touch the native picker.
 */
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { localIsoDate, parseIso } from './dateUtils';
import { formatTime } from './reminderTime';

/** Opens the date picker. Resolves a `YYYY-MM-DD` date, or null when the user dismissed it. */
export function pickDate(initialIso: string | null, minimum: Date): Promise<string | null> {
  return new Promise((resolve) => {
    const parsed = initialIso ? parseIso(initialIso) : null;
    const value = parsed ? new Date(parsed.year, parsed.month - 1, parsed.day) : new Date(minimum);
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate: minimum,
      onChange: (event, date) => {
        resolve(event.type === 'set' && date ? localIsoDate(date) : null);
      },
    });
  });
}

/** Opens the time picker. Resolves `HH:mm`, or null when dismissed. */
export function pickTime(initial: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    const value = new Date();
    if (initial) {
      value.setHours(Number(initial.slice(0, 2)), Number(initial.slice(3, 5)), 0, 0);
    } else {
      value.setHours(8, 0, 0, 0);
    }
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        resolve(
          event.type === 'set' && date ? formatTime(date.getHours(), date.getMinutes()) : null,
        );
      },
    });
  });
}
