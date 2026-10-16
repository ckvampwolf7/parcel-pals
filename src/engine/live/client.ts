/**
 * Live tracking via Delivery Tracker (https://tracker.delivery). Both APIs allow browser calls (CORS *).
 *  - v2 GraphQL (official): needs "CLIENT_ID:CLIENT_SECRET" from the tracker.delivery console (Free plan keys
 *    expire every 21 days). Used first when a key is configured.
 *  - v1 REST (classic, deprecated but still served): no key. Used as the default and as the fallback.
 * Errors that mean "no data for this number" become snapshots with liveStatus; transport failures throw.
 */
import type { TrackingSnapshot } from '@/types';
import { buildLiveSnapshot, emptyLiveSnapshot, type LiveEvent } from './buildSnapshot';
import { liveCarrierId } from './carrierMap';

const V1 = 'https://apis.tracker.delivery/carriers';
const V2 = 'https://apis.tracker.delivery/graphql';
const TIMEOUT_MS = 15000;

/** The service could not be reached or answered with a server error. Retry later. */
export class LiveTrackingError extends Error {
  constructor(public kind: 'network' | 'timeout' | 'server' | 'auth' | 'rate_limit', message?: string) {
    super(message ?? `live:${kind}`);
    this.name = 'LiveTrackingError';
  }
}

export interface LiveRequest { carrierId: string; trackingNumber: string }
export interface LiveOptions { apiKey?: string; fetchImpl?: typeof fetch; now?: Date }

async function fetchWithTimeout(f: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctl?.abort(), TIMEOUT_MS);
  try {
    return await f(url, { ...init, signal: ctl?.signal });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw new LiveTrackingError('timeout');
    throw new LiveTrackingError('network', e instanceof Error ? e.message : undefined);
  } finally {
    clearTimeout(timer);
  }
}

// ───────────── v1 (no key) ─────────────

interface V1Progress { time: string; status?: { id?: string; text?: string }; location?: { name?: string } | null; description?: string }
interface V1Response { progresses?: V1Progress[]; to?: { time?: string | null }; message?: string }

export function v1ToEvents(res: V1Response): LiveEvent[] {
  return (res.progresses ?? []).map((p) => ({
    time: p.time,
    code: p.status?.id,
    text: p.status?.text ?? '',
    description: p.description,
    location: p.location?.name ?? undefined,
  }));
}

export async function trackV1(req: LiveRequest, opts: LiveOptions = {}): Promise<TrackingSnapshot> {
  const f = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const ctx = { carrierId: req.carrierId, trackingNumber: req.trackingNumber, now };
  const id = liveCarrierId(req.carrierId);
  if (!id) return emptyLiveSnapshot(ctx, 'unsupported');
  const res = await fetchWithTimeout(f, `${V1}/${encodeURIComponent(id)}/tracks/${encodeURIComponent(req.trackingNumber)}`);
  let body: V1Response = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (res.status === 404) return emptyLiveSnapshot(ctx, 'not_found');
  if (res.status === 400) return emptyLiveSnapshot(ctx, 'invalid', body.message);
  if (res.status === 429) throw new LiveTrackingError('rate_limit');
  if (!res.ok) throw new LiveTrackingError('server', `v1 ${res.status}`);
  const snap = buildLiveSnapshot(v1ToEvents(body), { ...ctx, deliveredAt: body.to?.time });
  return snap;
}

// ───────────── v2 (API key) ─────────────

const QUERY = `query Track($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    events(last: 100) { edges { node { time status { code name } description location { name } } } }
  }
}`;

interface V2Node { time: string; status?: { code?: string; name?: string }; description?: string; location?: { name?: string } | null }
interface V2Response {
  data?: { track?: { events?: { edges?: Array<{ node: V2Node }> } } | null };
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export function v2ToEvents(res: V2Response): LiveEvent[] {
  return (res.data?.track?.events?.edges ?? []).map(({ node }) => ({
    time: node.time,
    code: node.status?.code,
    text: node.status?.name || node.description || '',
    description: node.description,
    location: node.location?.name ?? undefined,
  }));
}

export async function trackV2(req: LiveRequest, opts: LiveOptions & { apiKey: string }): Promise<TrackingSnapshot> {
  const f = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const ctx = { carrierId: req.carrierId, trackingNumber: req.trackingNumber, now };
  const id = liveCarrierId(req.carrierId);
  if (!id) return emptyLiveSnapshot(ctx, 'unsupported');
  const res = await fetchWithTimeout(f, V2, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `TRACKQL-API-KEY ${opts.apiKey.trim()}` },
    body: JSON.stringify({ query: QUERY, variables: { carrierId: id, trackingNumber: req.trackingNumber } }),
  });
  if (res.status === 401 || res.status === 403) throw new LiveTrackingError('auth');
  if (res.status === 429) throw new LiveTrackingError('rate_limit');
  let body: V2Response = {};
  try { body = await res.json(); } catch { if (!res.ok) throw new LiveTrackingError('server', `v2 ${res.status}`); }
  const code = body.errors?.[0]?.extensions?.code;
  if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') throw new LiveTrackingError('auth');
  if (code === 'NOT_FOUND') return emptyLiveSnapshot(ctx, 'not_found');
  if (code === 'BAD_REQUEST') return emptyLiveSnapshot(ctx, 'invalid', body.errors?.[0]?.message);
  if (code === 'TOO_MANY_REQUESTS' || code === 'RATE_LIMITED') throw new LiveTrackingError('rate_limit');
  if (body.errors?.length || !res.ok) throw new LiveTrackingError('server', body.errors?.[0]?.message ?? `v2 ${res.status}`);
  if (!body.data?.track) return emptyLiveSnapshot(ctx, 'not_found');
  return buildLiveSnapshot(v2ToEvents(body), ctx);
}

/** v2 when a key is set (falling back to v1 on auth/server failure), else v1. */
export async function trackLive(req: LiveRequest, opts: LiveOptions = {}): Promise<TrackingSnapshot> {
  if (opts.apiKey?.includes(':')) {
    try {
      return await trackV2(req, { ...opts, apiKey: opts.apiKey });
    } catch (e) {
      if (!(e instanceof LiveTrackingError) || e.kind === 'rate_limit') throw e;
      // auth / server / network trouble on v2 → try the classic API before giving up
    }
  }
  return trackV1(req, opts);
}
