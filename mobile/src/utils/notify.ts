import { AccessibilityInfo, Platform, ToastAndroid } from 'react-native';

/**
 * Brief confirmation after something changed ("Checklist reset"), so success is never silent.
 * Android shows a short toast (TalkBack reads it aloud); elsewhere the message is announced to screen readers.
 */
export function notify(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else AccessibilityInfo.announceForAccessibility(message);
}
