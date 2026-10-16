/** Real carrier data via Delivery Tracker (see ../live/client.ts). `now` is REAL time for live parcels. */
import type { TrackingProvider } from './types';
import { trackLive } from '../live/client';

let apiKey: string | undefined;
/** Set by the store from settings.trackerApiKey. */
export function setLiveApiKey(key: string | undefined): void { apiKey = key?.trim() || undefined; }

export const liveProvider: TrackingProvider = {
  id: 'live',
  track(req, now) {
    return trackLive({ carrierId: req.carrierId, trackingNumber: req.trackingNumber }, { apiKey, now });
  },
};
