/**
 * ENGINE PUBLIC API — owned by the Engine team.
 * Everything other modules may import from '@/engine' is exported here. Internals live in sibling files.
 * See docs/engine.md.
 */

// carriers & detection
export {
  CARRIERS, getCarrier, carrierName, trackingUrlFor, autoCharacter, normalizeTrackingNumber, validateTrackingNumber,
  detectCarriers, bestCarrierId, isValidS10, isValidUps, isValidMod7, isValidFedex12, s10CheckDigit, upsCheckDigit,
  isDomesticCarrier, usesKoreanPipeline, carriersForPicker, stripUspsZip,
  MIN_TRACKING_LENGTH, MAX_TRACKING_LENGTH, type TrackingValidation,
} from './carriers';
export { extractFromText, extractShopHints, carriersMentioned, type ExtractedNumber, type ShopHints } from './extract';

// providers
export {
  mockProvider, liveProvider, setLiveApiKey, getProviderFor, getProvider, setProvider, createTrackerDeliveryProvider, mapTrackerDeliveryResponse,
  type TrackRequest, type TrackingProvider, type TrackerDeliveryOptions,
} from './providers';
export { classifyCarrierText, statusFromCarrierText, type JargonTerm } from './statusText';

// simulation
export { snapshotAt, planFor, scenarioFor, checkpointCode, type EventCode, type DelayReason, type PickupKind, type Plan } from './simulator';
export { createSimClock, type SimClock, type SimClockState } from './clock';
export { isRestDay, isHoliday, type HolidayCountry } from './calendar';
export { detectRegion, getUserRegion, setUserRegion } from './region';

// presentation
export { statusTone, statusLabel, moodFor, isMoving, STATUS_TAGS, type StatusTone } from './status';
export {
  characterLine, checkpointLine, explainStatus, nextStepLine, describeProgress, speechSituation, checkpointKind, palName,
  isGenericNickname, SPEECH_SITUATIONS, type SpeechSituation,
} from './speech';
export { formatEta, formatSnapshotEta, formatRelative, formatDateTime, formatDate, formatTime, formatTimeWindow } from './format';

// demo
export { demoParcelSeeds, demoCreatedAt, type DemoSeed, type DemoTarget } from './demo';

import type { Locale } from '@/types';
import { t } from '@/i18n';
/** Friendly message for a validation failure reason or 'duplicate'. */
export function validationMessage(reason: 'empty' | 'too_short' | 'too_long' | 'invalid_chars' | 'duplicate', locale: Locale): string {
  return t(`engine.error.${reason}`, undefined, locale);
}

// live tracking (real carrier data via tracker.delivery)
export { trackLive, trackV1, trackV2, v1ToEvents, v2ToEvents, probeCarriers, LiveTrackingError, type LiveRequest, type LiveOptions, type ProbeResult } from './live/client';
export { buildLiveSnapshot, emptyLiveSnapshot, liveEventStatus, type LiveEvent } from './live/buildSnapshot';
export { liveCarrierId, supportsLiveTracking, dummyTrackingNumber } from './live/carrierMap';
