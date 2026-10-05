/**
 * Installs the real (Expo) scheduler. Called once from the root layout. Importing this file is what pulls
 * `expo-notifications` into the app; tests install a fake scheduler instead and never import it.
 */
import {
  createExpoScheduler,
  createExpoTapSource,
  installForegroundHandler,
} from './expoScheduler';
import { isQuietRoute } from './quietRoute';
import { setNotificationScheduler, setNotificationTapSource } from './scheduler';

export function installNotifications(): void {
  setNotificationScheduler(createExpoScheduler());
  setNotificationTapSource(createExpoTapSource());
  installForegroundHandler(isQuietRoute);
}
