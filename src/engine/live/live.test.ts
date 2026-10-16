// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  LiveTrackingError, buildLiveSnapshot, dummyTrackingNumber, getProviderFor, liveCarrierId, liveEventStatus,
  mockProvider, liveProvider, trackLive, trackV1, v1ToEvents,
} from '@/engine';

/** Example response from https://tracker.delivery/docs/api-versioning/v1 (CJ대한통운). */
const CJ_V1 = {
  carrier: { id: 'kr.cjlogistics', name: 'CJ대한통운', tel: '+8215881255' },
  from: { name: null, time: '2024-04-24T15:26:13+09:00' },
  to: { name: null, time: '2024-04-25T17:19:20+09:00' },
  progresses: [
    { time: '2024-04-24T15:26:13+09:00', status: { id: 'at_pickup', text: '집화처리' }, location: { name: '경기고양신삼송' }, description: '보내시는 고객님으로부터 상품을 인수받았습니다' },
    { time: '2024-04-24T17:15:37+09:00', status: { id: 'in_transit', text: 'SM입고' }, location: { name: '덕양AMP' }, description: '배송지역으로 상품이 이동중입니다.' },
    { time: '2024-04-25T06:28:42+09:00', status: { id: 'in_transit', text: '간선상차' }, location: { name: '대전HUB' }, description: '배송지역으로 상품이 이동중입니다.' },
    { time: '2024-04-25T09:17:56+09:00', status: { id: 'out_for_delivery', text: '배송출발' }, location: { name: '충북보은' }, description: '고객님의 상품을 배송할 예정입니다.(17~19시)' },
    { time: '2024-04-25T17:19:20+09:00', status: { id: 'delivered', text: '배송완료' }, location: { name: '충북보은' }, description: '고객님의 상품이 배송완료 되었습니다.' },
  ],
  state: { id: 'delivered', text: '배송완료' },
};

const ctx = { carrierId: 'kr.cjlogistics', trackingNumber: '123456789012', now: new Date('2024-04-25T12:00:00+09:00') };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('buildLiveSnapshot (v1 CJ example)', () => {
  it('maps a full delivered trace', () => {
    const s = buildLiveSnapshot(v1ToEvents(CJ_V1), ctx);
    expect(s.source).toBe('live');
    expect(s.liveStatus).toBe('ok');
    expect(s.status).toBe('delivered');
    expect(s.progress).toBe(1);
    expect(s.checkpoints.map((c) => c.message.ko)).toEqual(['집화처리', 'SM입고', '간선상차', '배송출발', '배송완료']);
    expect(s.checkpoints[3].detail).toContain('17~19시');
    expect(s.stops.map((x) => x.name.ko)).toEqual(['경기고양신삼송', '덕양AMP', '대전HUB', '충북보은', '우리 집']);
    expect(s.stops.at(-1)!.kind).toBe('destination');
    expect(s.stops[2].kind).toBe('hub');
  });

  it('mid-journey: out for delivery → last mile, today ETA, never fake progress', () => {
    const partial = { ...CJ_V1, progresses: CJ_V1.progresses.slice(0, 4) };
    const s = buildLiveSnapshot(v1ToEvents(partial), ctx);
    expect(s.status).toBe('out_for_delivery');
    expect(s.currentMode).toBe('bike');
    expect(s.progress).toBeGreaterThan(0.7);
    expect(s.progress).toBeLessThan(1);
    expect(s.eta?.confidence).toBeGreaterThan(0.5);
    const early = buildLiveSnapshot(v1ToEvents({ ...CJ_V1, progresses: CJ_V1.progresses.slice(0, 2) }), ctx);
    expect(early.status).toBe('in_transit');
    expect(early.progress).toBeLessThan(s.progress);
  });

  it('checkpoint ids are content-based (stable when older events are back-filled)', () => {
    const a = buildLiveSnapshot(v1ToEvents({ ...CJ_V1, progresses: CJ_V1.progresses.slice(1) }), ctx);
    const b = buildLiveSnapshot(v1ToEvents(CJ_V1), ctx);
    const ids = new Set(b.checkpoints.map((c) => c.id));
    for (const c of a.checkpoints) expect(ids.has(c.id)).toBe(true);
  });

  it('flags stale traces and builds an empty pending snapshot for no events', () => {
    const late = { ...ctx, now: new Date('2024-04-28T12:00:00+09:00') };
    const s = buildLiveSnapshot(v1ToEvents({ ...CJ_V1, progresses: CJ_V1.progresses.slice(0, 3) }), late);
    expect(s.stale).toBe(true);
    const empty = buildLiveSnapshot([], ctx);
    expect(empty.status).toBe('pending');
    expect(empty.progress).toBe(0);
  });

  it('refines generic codes with carrier wording', () => {
    expect(liveEventStatus({ time: '', code: 'in_transit', text: '통관 진행중' })).toBe('customs');
    expect(liveEventStatus({ time: '', code: 'in_transit', text: '점포도착' })).toBe('available_for_pickup');
    expect(liveEventStatus({ time: '', code: 'in_transit', text: '간선하차' })).toBe('in_transit');
    expect(liveEventStatus({ time: '', text: '배달완료' })).toBe('delivered');
  });
});

describe('trackV1 / trackLive', () => {
  it('ok response → snapshot, and calls the mapped carrier id', async () => {
    const f = vi.fn(async () => json(200, CJ_V1));
    const s = await trackV1({ carrierId: 'kr.cjlogistics', trackingNumber: '123456789012' }, { fetchImpl: f as unknown as typeof fetch, now: ctx.now });
    expect(s.status).toBe('delivered');
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe('https://apis.tracker.delivery/carriers/kr.cjlogistics/tracks/123456789012');
  });

  it('404 → not_found, 400 → invalid with the carrier message, unsupported → no request', async () => {
    const f404 = vi.fn(async () => json(404, { message: 'tracking number not found.' })) as unknown as typeof fetch;
    expect((await trackV1({ carrierId: 'kr.hanjin', trackingNumber: '123456789012' }, { fetchImpl: f404 })).liveStatus).toBe('not_found');
    const f400 = vi.fn(async () => json(400, { message: '운송장 번호는 10자리 혹은 12자리입니다.' })) as unknown as typeof fetch;
    const bad = await trackV1({ carrierId: 'kr.cjlogistics', trackingNumber: '12' }, { fetchImpl: f400 });
    expect(bad.liveStatus).toBe('invalid');
    expect(bad.liveMessage).toContain('10자리');
    const never = vi.fn();
    const un = await trackV1({ carrierId: 'cn.yunexpress', trackingNumber: 'YT1' }, { fetchImpl: never as unknown as typeof fetch });
    expect(un.liveStatus).toBe('unsupported');
    expect(never).not.toHaveBeenCalled();
  });

  it('server and network failures throw LiveTrackingError', async () => {
    const f500 = (async () => json(502, {})) as unknown as typeof fetch;
    await expect(trackV1({ carrierId: 'kr.lotte', trackingNumber: '123456789012' }, { fetchImpl: f500 })).rejects.toMatchObject({ kind: 'server' });
    const fNet = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(trackV1({ carrierId: 'kr.lotte', trackingNumber: '123456789012' }, { fetchImpl: fNet })).rejects.toBeInstanceOf(LiveTrackingError);
  });

  it('with an API key: uses v2, and falls back to v1 when the key is rejected', async () => {
    const v2ok = {
      data: { track: { events: { edges: CJ_V1.progresses.map((p) => ({ node: { time: p.time, status: { code: p.status.id.toUpperCase(), name: p.status.text }, description: p.description, location: p.location } })) } } },
    };
    const f = vi.fn(async (url: string) => (url.endsWith('/graphql') ? json(200, v2ok) : json(500, {}))) as unknown as typeof fetch;
    const s = await trackLive({ carrierId: 'kr.cjlogistics', trackingNumber: '123456789012' }, { apiKey: 'id:secret', fetchImpl: f, now: ctx.now });
    expect(s.status).toBe('delivered');
    const init = (vi.mocked(f).mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe('TRACKQL-API-KEY id:secret');

    const g = vi.fn(async (url: string) => (url.endsWith('/graphql') ? json(200, { errors: [{ message: 'nope', extensions: { code: 'UNAUTHENTICATED' } }] }) : json(200, CJ_V1))) as unknown as typeof fetch;
    const fb = await trackLive({ carrierId: 'kr.cjlogistics', trackingNumber: '123456789012' }, { apiKey: 'id:bad', fetchImpl: g, now: ctx.now });
    expect(fb.status).toBe('delivered');
    expect(vi.mocked(g).mock.calls).toHaveLength(2);
  });
});

describe('provider routing & carrier map', () => {
  it('demo parcels use the simulator, real parcels use live data', () => {
    expect(getProviderFor({ demo: true })).toBe(mockProvider);
    expect(getProviderFor({})).toBe(liveProvider);
  });
  it('maps our carrier ids to tracker.delivery ids', () => {
    expect(liveCarrierId('cn.cainiao')).toBe('cn.cainiao.global');
    expect(liveCarrierId('upu.s10')).toBe('un.upu.ems');
    expect(liveCarrierId('us.amazon')).toBeUndefined();
  });
  it('dummy number is on the 3-hour UTC grid', () => {
    expect(dummyTrackingNumber(new Date('2026-10-16T10:20:00Z'))).toBe('2026-10-16T21:00:00Z');
  });
});

describe('real FedEx trace (516139538183, captured 2026-10-16)', () => {
  const FEDEX = {
    progresses: [
      { time: '2026-10-14T11:35:00-05:00', status: { id: 'information_received', text: 'Label created' }, location: { name: null }, description: 'Shipment information sent to FedEx' },
      { time: '2026-10-14T14:00:00-05:00', status: { id: 'at_pickup', text: 'Picked up' }, location: { name: 'CHICAGO' }, description: 'Picked up' },
      { time: '2026-10-14T20:29:00-05:00', status: { id: 'in_transit', text: 'In transit' }, location: { name: 'CHICAGO' }, description: 'Arrived at FedEx location' },
      { time: '2026-10-14T21:06:18-05:00', status: { id: 'in_transit', text: 'In transit' }, location: { name: 'CHICAGO' }, description: 'Left FedEx origin facility' },
      { time: '2026-10-15T00:47:27-05:00', status: { id: 'in_transit', text: 'Shipment exception' }, location: { name: 'CHICAGO' }, description: 'Shipment exception' },
      { time: '2026-10-16T06:52:58-05:00', status: { id: 'in_transit', text: 'In transit' }, location: { name: 'CHICAGO' }, description: 'Departed FedEx location' },
    ],
  } as unknown as Parameters<typeof v1ToEvents>[0];
  const now = new Date('2026-10-16T23:40:00Z');
  it('maps statuses, null locations, the mid-route exception and the carrier detail', () => {
    const s = buildLiveSnapshot(v1ToEvents(FEDEX), { carrierId: 'us.fedex', trackingNumber: '516139538183', now });
    expect(s.status).toBe('in_transit');
    expect(s.checkpoints.map((c) => c.status)).toEqual(['info_received', 'in_transit', 'in_transit', 'in_transit', 'exception', 'in_transit']);
    expect(s.stops.map((x) => x.name.ko)).toEqual(['CHICAGO', '우리 집']);
    expect(s.checkpoints[5].detail).toBe('Departed FedEx location');
    expect(s.stale).toBe(false);
  });
  it('explains generic "In transit" events from the description', async () => {
    const { explainStatus } = await import('@/engine');
    const s = buildLiveSnapshot(v1ToEvents(FEDEX), { carrierId: 'us.fedex', trackingNumber: '516139538183', now });
    const lines = s.checkpoints.map((c) => explainStatus(c, 'ko'));
    expect(lines[2]).not.toBe(lines[3]); // "Arrived" vs "Left" read differently
  });
  it('FedEx 12-digit check digit is recognised and ranks FedEx first', async () => {
    const { isValidFedex12, detectCarriers } = await import('@/engine');
    expect(isValidFedex12('516139538183')).toBe(true);
    expect(isValidFedex12('516139538184')).toBe(false);
    expect(detectCarriers('516139538183')[0].carrier.id).toBe('us.fedex');
  });
  it('probeCarriers reports which candidates have records', async () => {
    const { probeCarriers } = await import('@/engine');
    const f = (async (url: string) => (url.includes('/us.fedex/') ? json(200, FEDEX) : url.includes('/kr.lotte/') ? json(400, { message: 'bad' }) : json(404, { message: 'nf' }))) as unknown as typeof fetch;
    const r = await probeCarriers('516139538183', ['us.fedex', 'kr.cjlogistics', 'kr.lotte', 'us.amazon'], { fetchImpl: f, now });
    expect(r.map((x) => x.result)).toEqual(['found', 'not_found', 'invalid', 'unsupported']);
    expect(r[0].events).toBe(6);
  });
});
