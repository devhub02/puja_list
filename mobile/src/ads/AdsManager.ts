/**
 * Initializes the Google Mobile Ads SDK, but only after consent allows it, and only once.
 * Every call is wrapped so an SDK failure can never crash or hang the app.
 */
import { mobileAds, MaxAdContentRating } from './nativeAdsModule';
import { gatherConsent, getConsentState, subscribeConsent } from './consent';

/**
 * Maximum ad content rating. `PG` is the strictest rating that AdMob still serves meaningful
 * inventory for in practice (the `G` tier has very little demand on AdMob and would often show no
 * ad at all); the app is general-audience, not child-directed, so `PG` is a safe, conservative
 * choice that still lets the ad slots show something most of the time.
 */
const REQUEST_CONFIGURATION = {
  maxAdContentRating: MaxAdContentRating.PG,
  tagForChildDirectedTreatment: false,
  tagForUnderAgeOfConsent: false,
};

let initialized = false;
let initializing = false;
type Listener = () => void;
let listeners: Listener[] = [];

export function isAdsInitialized(): boolean {
  return initialized;
}

export function subscribeAdsReady(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** Initializes the SDK if consent currently allows ads and it has not been initialized yet. */
export async function initAdsIfAllowed(): Promise<void> {
  if (initialized || initializing) return;
  if (!getConsentState().canRequestAds) return;
  initializing = true;
  try {
    await mobileAds().setRequestConfiguration(REQUEST_CONFIGURATION);
    await mobileAds().initialize();
    initialized = true;
    for (const listener of listeners) listener();
  } catch {
    // The SDK failed to initialize (offline, Play Services missing, etc). Ads simply stay off;
    // nothing else in the app depends on this succeeding.
  } finally {
    initializing = false;
  }
}

/**
 * Call once, after the first frame, without blocking it: gathers consent, then initializes the
 * SDK if consent allows ads. Safe to call more than once (both steps are idempotent).
 */
export async function startAdsFlow(): Promise<void> {
  try {
    await gatherConsent();
    await initAdsIfAllowed();
  } catch {
    // gatherConsent and initAdsIfAllowed already fail closed; this is an extra safety net.
  }
}

// If consent changes later (e.g. the user updates their choice), try to init again.
subscribeConsent(() => {
  void initAdsIfAllowed();
});

/** Test-only: resets module-level state between tests. */
export function __resetAdsManagerForTests(): void {
  initialized = false;
  initializing = false;
  listeners = [];
}
