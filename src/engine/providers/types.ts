import type { TrackingSnapshot } from '@/types';

export interface TrackRequest {
  trackingNumber: string;
  carrierId: string;
  /** ISO time the parcel was added (SIMULATION time — see store) — the mock provider anchors its plan to this. */
  createdAt: string;
  demo?: boolean;
}

export interface TrackingProvider {
  id: string;
  /** `now` is the current SIMULATION time (see createSimClock). Must be deterministic for (req, now). */
  track(req: TrackRequest, now: Date): Promise<TrackingSnapshot>;
}
