/** Deterministic simulated carrier (default provider). No network. */
import type { TrackingProvider } from './types';
import { snapshotAt } from '../simulator';

export const mockProvider: TrackingProvider = {
  id: 'mock',
  async track(req, now) {
    return snapshotAt({ trackingNumber: req.trackingNumber, carrierId: req.carrierId, createdAt: req.createdAt }, now);
  },
};
