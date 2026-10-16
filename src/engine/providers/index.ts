import type { TrackingProvider } from './types';
import { mockProvider } from './mock';

export type { TrackRequest, TrackingProvider } from './types';
export { mockProvider } from './mock';
export { createTrackerDeliveryProvider, mapTrackerDeliveryResponse, mapTdStatus, type TrackerDeliveryOptions } from './trackerDelivery';

let current: TrackingProvider = mockProvider;

/** The provider the store should use. Defaults to the deterministic mock. */
export function getProvider(): TrackingProvider {
  return current;
}

/** Swap the provider (e.g. a real API behind a proxy). Pass undefined to restore the mock. */
export function setProvider(p: TrackingProvider | undefined): void {
  current = p ?? mockProvider;
}
