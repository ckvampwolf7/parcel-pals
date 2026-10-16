import type { TrackingProvider } from './types';
import { mockProvider } from './mock';
import { liveProvider } from './live';

export type { TrackRequest, TrackingProvider } from './types';
export { mockProvider } from './mock';
export { liveProvider, setLiveApiKey } from './live';
export { createTrackerDeliveryProvider, mapTrackerDeliveryResponse, mapTdStatus, type TrackerDeliveryOptions } from './trackerDelivery';

let override: TrackingProvider | undefined;
let current: TrackingProvider = mockProvider;

/** The provider the store should use. Defaults to the deterministic mock. */
export function getProvider(): TrackingProvider {
  return current;
}

/** Swap the provider (e.g. a real API behind a proxy). Pass undefined to restore the mock. */
export function setProvider(p: TrackingProvider | undefined): void {
  current = p ?? mockProvider;
  override = p;
}

/**
 * Provider for one parcel: demo parcels use the simulator, real parcels use live carrier data.
 * A provider installed with setProvider() (tests) overrides both.
 */
export function getProviderFor(req: { demo?: boolean }): TrackingProvider {
  if (override) return override;
  return req.demo ? mockProvider : liveProvider;
}
