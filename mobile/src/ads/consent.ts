/**
 * A thin wrapper around the UMP (User Messaging Platform) consent flow, so the rest of the app
 * never touches `react-native-google-mobile-ads` directly for consent.
 *
 * Fail-closed: if consent information cannot be obtained (offline, SDK error, timeout), ads are
 * never requested and the app keeps running normally.
 */
import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  type AdsConsentInfo,
} from './nativeAdsModule';

export interface ConsentState {
  /** Whether the app may now request ads. False until consent gathering succeeds and allows it. */
  canRequestAds: boolean;
  /** Whether Settings must show the "Ad privacy choices" row. */
  privacyOptionsRequired: boolean;
}

export const INITIAL_CONSENT_STATE: ConsentState = {
  canRequestAds: false,
  privacyOptionsRequired: false,
};

let state: ConsentState = INITIAL_CONSENT_STATE;
type Listener = (state: ConsentState) => void;
let listeners: Listener[] = [];

function toState(info: AdsConsentInfo): ConsentState {
  return {
    canRequestAds: info.canRequestAds === true,
    privacyOptionsRequired:
      info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
}

function setState(next: ConsentState) {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getConsentState(): ConsentState {
  return state;
}

export function subscribeConsent(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Requests consent info and shows the consent form if one is required. Resolves once a
 * `ConsentState` is known. Never throws: any failure (offline, timeout, SDK error) resolves to
 * the fail-closed state (`canRequestAds: false`), so the caller can always proceed safely.
 */
export async function gatherConsent(): Promise<ConsentState> {
  try {
    const info = await AdsConsent.gatherConsent();
    const next = toState(info);
    setState(next);
    return next;
  } catch {
    setState(INITIAL_CONSENT_STATE);
    return INITIAL_CONSENT_STATE;
  }
}

/** Opens the UMP privacy options form. Only call this when `privacyOptionsRequired` is true. */
export async function showPrivacyOptions(): Promise<void> {
  try {
    const info = await AdsConsent.showPrivacyOptionsForm();
    setState(toState(info));
  } catch {
    // The form could not be shown (offline, no form configured, SDK error); nothing to do.
  }
}

/**
 * Test-only: resets the module-level state between tests. Listeners are left alone: AdsManager
 * subscribes once at import time for the lifetime of the process, and clearing it here would
 * silently break that production wiring for the rest of the test file.
 */
export function __resetConsentForTests(): void {
  state = INITIAL_CONSENT_STATE;
}
