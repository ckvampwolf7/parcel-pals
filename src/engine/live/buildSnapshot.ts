/**
 * Real carrier events → TrackingSnapshot.
 * Unlike the simulator there is no planned route: stops are built from the places the parcel has actually
 * visited, followed by the destination. Progress and ETA are derived honestly from the latest event; we never
 * invent movement or precise times the carrier didn't give us.
 */
import type { Checkpoint, Eta, RouteStop, StatusTag, StopKind, TrackingSnapshot, TransportMode } from '@/types';
import { hashString } from '../prng';
import { classifyCarrierText, termToStatus } from '../statusText';
import { getCarrier } from '../carriers';

/** One event as returned by a live API (v1 or v2), normalized. */
export interface LiveEvent {
  time: string; //          ISO with offset
  code?: string; //         v1 status id (in_transit…) or v2 status code (IN_TRANSIT…)
  text: string; //          short carrier status text, e.g. "간선상차"
  description?: string; //  long carrier text
  location?: string;
}

const CODE: Record<string, StatusTag> = {
  information_received: 'info_received', INFORMATION_RECEIVED: 'info_received',
  at_pickup: 'in_transit', AT_PICKUP: 'in_transit',
  in_transit: 'in_transit', IN_TRANSIT: 'in_transit',
  out_for_delivery: 'out_for_delivery', OUT_FOR_DELIVERY: 'out_for_delivery',
  attempt_fail: 'attempt_fail', ATTEMPT_FAIL: 'attempt_fail',
  delivered: 'delivered', DELIVERED: 'delivered',
  available_for_pickup: 'available_for_pickup', AVAILABLE_FOR_PICKUP: 'available_for_pickup',
  exception: 'exception', EXCEPTION: 'exception',
};

/** Status for one live event: the API's code, refined by the carrier wording where the code is generic. */
export function liveEventStatus(e: LiveEvent): StatusTag {
  const term = classifyCarrierText(e.text) ?? (e.description ? classifyCarrierText(e.description) : undefined);
  const byCode = e.code ? CODE[e.code] : undefined;
  if (!byCode) return termToStatus(term);
  if (byCode === 'in_transit' || byCode === 'info_received') {
    const t = termToStatus(term);
    if (t === 'customs' || t === 'exception' || t === 'available_for_pickup' || t === 'attempt_fail') return t;
    if (byCode === 'info_received' && term === undefined) return 'info_received';
  }
  return byCode;
}

function stopKindFor(name: string, status: StatusTag): StopKind {
  if (/공항|AIRPORT|ICN|GATEWAY/i.test(name)) return 'airport';
  if (status === 'customs' || /세관|통관|CUSTOMS/i.test(name)) return 'customs';
  if (/HUB|허브|터미널|물류센터|센터|SORT|FACILITY|AMP/i.test(name)) return 'hub';
  return 'local';
}

/** Stage → progress when we know nothing about places. */
const STAGE_PROGRESS: Partial<Record<StatusTag, number>> = { info_received: 0.1, in_transit: 0.45, customs: 0.55, exception: 0.5 };

const DOMESTIC_HOME = { ko: '우리 집', en: 'Home' };

export interface BuildContext {
  carrierId: string;
  trackingNumber: string;
  /** real "now" */
  now: Date;
  /** delivered time if the API reports it separately */
  deliveredAt?: string | null;
}

/** Build a snapshot from live events (any order). Returns a pending snapshot when there are no events. */
export function buildLiveSnapshot(events: LiveEvent[], ctx: BuildContext): TrackingSnapshot {
  const key = `${ctx.carrierId}|${ctx.trackingNumber}`;
  const sorted = events
    .filter((e) => e && e.time && !Number.isNaN(Date.parse(e.time)))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  const intl = getCarrier(ctx.carrierId)?.scope === 'international';
  const checkpoints: Checkpoint[] = [];
  const stops: RouteStop[] = [];
  const seen = new Map<string, number>();

  // Origin: the first place we hear about (or a generic "seller").
  const firstLoc = sorted.find((e) => e.location?.trim())?.location?.trim();
  stops.push({ id: 'origin', kind: 'origin', name: firstLoc ? { ko: firstLoc, en: firstLoc } : { ko: '보내는 곳', en: 'Sender' }, modeToNext: 'truck' });
  if (firstLoc) seen.set(firstLoc, 0);

  // Content-based ids (stable when the carrier back-fills older events); identical events get a counter.
  const used = new Map<string, number>();
  const liveId = (content: string) => {
    const base = `live-${hashString(content).toString(36)}`;
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
  sorted.forEach((e) => {
    const status = liveEventStatus(e);
    const loc = e.location?.trim() ?? '';
    let stopIndex: number | undefined;
    if (loc) {
      if (!seen.has(loc)) {
        stops.push({ id: `s${stops.length}`, kind: stopKindFor(loc, status), name: { ko: loc, en: loc }, modeToNext: 'truck' });
        seen.set(loc, stops.length - 1);
      }
      stopIndex = seen.get(loc);
    }
    const text = e.text?.trim() || e.description?.trim() || e.code || '';
    checkpoints.push({
      id: liveId(`${key}|${e.time}|${e.code ?? ''}|${text}|${loc}`),
      time: new Date(e.time).toISOString(),
      status,
      location: { ko: loc, en: loc },
      message: { ko: text, en: text },
      ...(e.description && e.description.trim() !== text ? { detail: e.description.trim() } : {}),
      ...(stopIndex !== undefined ? { stopIndex } : {}),
    });
  });

  const last = checkpoints.at(-1);
  const status: StatusTag = last?.status ?? 'pending';

  // Destination
  const pickupPlace = status === 'available_for_pickup' && last?.location.ko ? last.location : undefined;
  stops.push({ id: 'dest', kind: 'destination', name: pickupPlace ?? DOMESTIC_HOME });
  // Air leg hint for international parcels: the leg leaving an airport flies.
  stops.forEach((s, i) => { if (intl && s.kind === 'airport' && i < stops.length - 1) s.modeToNext = 'plane'; });
  if (stops.length >= 2) stops[stops.length - 2].modeToNext = status === 'out_for_delivery' ? 'bike' : stops[stops.length - 2].modeToNext;

  // Where are we?
  const lastIdx = Math.max(0, ...checkpoints.map((c) => c.stopIndex ?? 0));
  const atIdx = last?.stopIndex ?? lastIdx;
  const n = stops.length;
  let currentStopIndex = Math.min(atIdx, n - 2);
  let progress: number;
  if (status === 'delivered') { currentStopIndex = n - 1; progress = 1; }
  else if (status === 'pending') { currentStopIndex = 0; progress = 0; }
  else if (status === 'out_for_delivery' || status === 'attempt_fail') progress = Math.min(0.95, (n - 2 + 0.5) / (n - 1));
  else if (status === 'available_for_pickup') { currentStopIndex = n - 1; progress = 1; }
  else if (n <= 2) progress = STAGE_PROGRESS[status] ?? 0.4; // carrier gave no places: show the stage instead
  else progress = Math.max(currentStopIndex / (n - 1), STAGE_PROGRESS[status] === 0.1 ? 0.05 : 0);

  const currentMode: TransportMode =
    status === 'out_for_delivery' ? 'bike'
      : stops[currentStopIndex]?.modeToNext ?? 'truck';

  const nowMs = ctx.now.getTime();
  const lastMs = last ? Date.parse(last.time) : undefined;
  const ageH = lastMs !== undefined ? (nowMs - lastMs) / 3.6e6 : 0;
  const stale = status !== 'delivered' && status !== 'pending' && status !== 'available_for_pickup'
    && ageH > (status === 'customs' ? 96 : intl ? 72 : 36);

  return {
    status,
    checkpoints,
    stops,
    progress: Math.max(0, Math.min(1, progress)),
    currentStopIndex,
    currentMode,
    eta: estimateEta(status, intl, ctx.now, lastMs),
    stale,
    ...(pickupPlace ? { pickup: { place: pickupPlace, kind: /편의점|GS|CU|세븐|이마트24|점포/.test(pickupPlace.ko) ? 'convenience_store' : /우체국/.test(pickupPlace.ko) ? 'post_office' : /함|locker/i.test(pickupPlace.ko) ? 'locker' : 'branch' } as const } : {}),
    updatedAt: ctx.now.toISOString(),
    source: 'live',
    liveStatus: 'ok',
  };
}

/** Coarse, honest ETA window (low confidence) — only where the stage makes it meaningful. */
function estimateEta(status: StatusTag, intl: boolean, now: Date, lastMs?: number): Eta | undefined {
  const day = (d: Date, addDays: number, h: number) => { const x = new Date(d); x.setDate(x.getDate() + addDays); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  switch (status) {
    case 'out_for_delivery':
      return { earliest: now.toISOString(), latest: day(now, 0, 21), confidence: 0.8 };
    case 'in_transit': {
      if (intl) return { earliest: day(now, 2, 9), latest: day(now, 7, 21), confidence: 0.2 };
      // Domestic parcels usually arrive the day after the last hub move.
      const base = lastMs ? new Date(Math.max(lastMs, now.getTime() - 24 * 3.6e6)) : now;
      return { earliest: day(base, 1, 9), latest: day(base, 2, 21), confidence: 0.4 };
    }
    case 'customs':
      return { earliest: day(now, 2, 9), latest: day(now, 7, 21), confidence: 0.2 };
    case 'info_received':
      return intl ? undefined : { earliest: day(now, 1, 9), latest: day(now, 3, 21), confidence: 0.25 };
    default:
      return undefined;
  }
}

/** Snapshot for "no data yet" / unsupported / invalid cases. */
export function emptyLiveSnapshot(ctx: BuildContext, liveStatus: 'not_found' | 'invalid' | 'unsupported', liveMessage?: string): TrackingSnapshot {
  return {
    status: 'pending',
    checkpoints: [],
    stops: [
      { id: 'origin', kind: 'origin', name: { ko: '보내는 곳', en: 'Sender' }, modeToNext: 'truck' },
      { id: 'dest', kind: 'destination', name: DOMESTIC_HOME },
    ],
    progress: 0,
    currentStopIndex: 0,
    currentMode: 'truck',
    updatedAt: ctx.now.toISOString(),
    source: 'live',
    liveStatus,
    ...(liveMessage ? { liveMessage } : {}),
  };
}
