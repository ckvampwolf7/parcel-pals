/**
 * SKELETON real provider for Delivery Tracker (https://tracker.delivery, GraphQL API).
 * NOT used by default (getProvider() returns the mock). Never call it from the browser with a secret:
 * route requests through your own proxy (`endpoint`) that adds the credentials. See docs/engine.md.
 */
import type { Checkpoint, StatusTag, TrackingSnapshot } from '@/types';
import type { TrackingProvider } from './types';
import { statusFromCarrierText } from '../statusText';
import { hashString } from '../prng';

export interface TrackerDeliveryOptions {
  /** Your proxy endpoint that forwards to https://apis.tracker.delivery/graphql with auth headers. */
  endpoint: string;
  fetchImpl?: typeof fetch;
  /** Map our carrier ids to tracker.delivery ids where they differ (ours follow their naming already). */
  carrierIdMap?: Record<string, string>;
}

const QUERY = `query Track($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    lastEvent { time status { code } description }
    events(last: 50) { edges { node { time status { code name } description location { name } } } }
  }
}`;

interface TdEvent { time: string; status: { code: string; name?: string }; description?: string; location?: { name?: string } }
interface TdResponse { data?: { track?: { events?: { edges: Array<{ node: TdEvent }> } } }; errors?: Array<{ message: string }> }

/** tracker.delivery TrackEventStatusCode → our StatusTag (from memory; verify against their schema). */
export function mapTdStatus(code: string, text: string): StatusTag {
  switch (code) {
    case 'INFORMATION_RECEIVED': return 'info_received';
    case 'AT_PICKUP': case 'IN_TRANSIT': return statusFromCarrierText(text) === 'customs' ? 'customs' : 'in_transit';
    case 'OUT_FOR_DELIVERY': return 'out_for_delivery';
    case 'ATTEMPT_FAIL': return 'attempt_fail';
    case 'DELIVERED': return 'delivered';
    case 'AVAILABLE_FOR_PICKUP': return 'available_for_pickup';
    case 'EXCEPTION': return 'exception';
    default: return statusFromCarrierText(text);
  }
}

/** Pure mapping (unit-testable without network). */
export function mapTrackerDeliveryResponse(res: TdResponse, now: Date, key: string): TrackingSnapshot {
  const nodes = (res.data?.track?.events?.edges ?? []).map((e) => e.node).sort((a, b) => a.time.localeCompare(b.time));
  const checkpoints: Checkpoint[] = nodes.map((n) => {
    const text = n.description || n.status.name || n.status.code;
    const loc = n.location?.name ?? '';
    return {
      id: `td-${hashString(`${key}|${n.time}|${n.status.code}|${text}`).toString(36)}`,
      time: new Date(n.time).toISOString(),
      status: mapTdStatus(n.status.code, text),
      location: { ko: loc, en: loc },
      message: { ko: text, en: text },
    };
  });
  const status = checkpoints.at(-1)?.status ?? 'pending';
  const order: StatusTag[] = ['pending', 'info_received', 'in_transit', 'customs', 'out_for_delivery', 'delivered'];
  const stageIdx = Math.max(0, order.indexOf(status === 'available_for_pickup' || status === 'attempt_fail' ? 'out_for_delivery' : status));
  const stops = [
    { id: 'origin', kind: 'origin' as const, name: { ko: '판매자', en: 'Seller' }, modeToNext: 'truck' as const },
    { id: 'hub', kind: 'hub' as const, name: { ko: '허브', en: 'Hub' }, modeToNext: 'truck' as const },
    { id: 'local', kind: 'local' as const, name: { ko: '배송 센터', en: 'Delivery station' }, modeToNext: 'bike' as const },
    { id: 'home', kind: 'destination' as const, name: { ko: '우리 집', en: 'Home' } },
  ];
  const stopIdx = Math.min(3, [0, 0, 1, 1, 2, 3][stageIdx] ?? 0);
  return {
    status, checkpoints, stops, progress: stopIdx / 3, currentStopIndex: stopIdx,
    currentMode: stopIdx >= 2 ? 'bike' : 'truck', updatedAt: now.toISOString(),
  };
}

export function createTrackerDeliveryProvider(opts: TrackerDeliveryOptions): TrackingProvider {
  const f = opts.fetchImpl ?? fetch;
  return {
    id: 'tracker.delivery',
    async track(req, now) {
      const carrierId = opts.carrierIdMap?.[req.carrierId] ?? req.carrierId;
      const r = await f(opts.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { carrierId, trackingNumber: req.trackingNumber } }),
      });
      if (!r.ok) throw new Error(`engine.error.http_${r.status}`);
      const json = (await r.json()) as TdResponse;
      if (json.errors?.length) throw new Error(json.errors[0].message);
      return mapTrackerDeliveryResponse(json, now, `${req.carrierId}|${req.trackingNumber}`);
    },
  };
}
