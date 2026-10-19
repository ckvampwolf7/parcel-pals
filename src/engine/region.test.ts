// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { Parcel } from '@/types';
import {
  autoCharacter, buildLiveSnapshot, carriersForPicker, detectCarriers, detectRegion, extractFromText, getCarrier,
  isDomesticCarrier, isHoliday, isRestDay, nextStepLine, normalizeTrackingNumber, setUserRegion, speechSituation,
  trackingUrlFor, usesKoreanPipeline, v1ToEvents, validateTrackingNumber,
} from '@/engine';
import { makeS10 } from './carriers';

afterEach(() => setUserRegion('KR'));

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('region detection', () => {
  it('time zone wins, then language', () => {
    expect(detectRegion({ timeZone: 'America/Los_Angeles', languages: ['ko-KR'] })).toBe('US');
    expect(detectRegion({ timeZone: 'America/New_York' })).toBe('US');
    expect(detectRegion({ timeZone: 'Pacific/Honolulu' })).toBe('US');
    expect(detectRegion({ timeZone: 'Asia/Seoul', languages: ['en-US'] })).toBe('KR');
    expect(detectRegion({ timeZone: 'Europe/Berlin', languages: ['en-US'] })).toBe('US');
    expect(detectRegion({ timeZone: 'Europe/Berlin', languages: ['de-DE'] })).toBe('KR');
    expect(detectRegion({})).toBe('KR');
  });
});

describe('US federal holidays', () => {
  it('knows the 2026 calendar, with weekend observance', () => {
    const us2026 = [[1, 1], [1, 19], [2, 16], [5, 25], [6, 19], [7, 3], [9, 7], [10, 12], [11, 11], [11, 26], [12, 25]];
    for (const [m, d] of us2026) expect(isHoliday(local(2026, m, d), 'US'), `${m}/${d}`).toBe(true);
    expect(isHoliday(local(2026, 7, 4), 'US')).toBe(false); // Saturday → observed Friday 7/3
    expect(isHoliday(local(2021, 12, 31), 'US')).toBe(true); // New Year 2022 fell on a Saturday
    expect(isHoliday(local(2026, 9, 25), 'US')).toBe(false); // Chuseok is Korean only
    expect(isHoliday(local(2026, 9, 25))).toBe(true);
    expect(isRestDay(local(2026, 10, 18), 'US')).toBe(true); // Sunday
    expect(isRestDay(local(2026, 10, 19), 'US')).toBe(false);
  });
});

describe('domestic carriers follow the region', () => {
  it('KR: Korean carriers; US: FedEx/UPS/USPS/Amazon', () => {
    expect(isDomesticCarrier('kr.cjlogistics', 'KR')).toBe(true);
    expect(isDomesticCarrier('us.fedex', 'KR')).toBe(false);
    expect(isDomesticCarrier('kr.epost.ems', 'KR')).toBe(false);
    for (const id of ['us.fedex', 'us.ups', 'us.usps', 'us.amazon']) expect(isDomesticCarrier(id, 'US')).toBe(true);
    expect(isDomesticCarrier('kr.cjlogistics', 'US')).toBe(false);
    expect(isDomesticCarrier('dev.track.dummy', 'US')).toBe(true);
    expect(usesKoreanPipeline('kr.hanjin')).toBe(true);
    expect(usesKoreanPipeline('us.usps')).toBe(false);
  });
  it('auto character and the carrier picker put the home country first', () => {
    expect(autoCharacter(getCarrier('us.fedex'), 'US')).toBe('truck');
    expect(autoCharacter(getCarrier('us.fedex'), 'KR')).toBe('plane');
    expect(autoCharacter(getCarrier('kr.cjlogistics'), 'KR')).toBe('truck');
    const us = carriersForPicker('US');
    expect(us.domestic.map((c) => c.id).sort()).toEqual(['us.amazon', 'us.fedex', 'us.ups', 'us.usps']);
    expect(us.other.some((c) => c.id === 'kr.cjlogistics')).toBe(true);
    expect(carriersForPicker('KR').domestic[0].id).toBe('kr.cjlogistics');
    expect([...us.domestic, ...us.other].some((c) => c.id.startsWith('dev.'))).toBe(false);
  });
  it('US carriers have tracking pages', () => {
    for (const id of ['us.fedex', 'us.ups', 'us.usps', 'us.amazon']) expect(trackingUrlFor(id, 'X1')).toMatch(/^https:\/\/.*X1/);
  });
});

describe('US tracking numbers', () => {
  const top = (n: string, region: 'KR' | 'US' = 'US') => detectCarriers(n, { region })[0]?.carrier.id;
  it('bare 12 digits: FedEx first in the US even without a valid check digit, Korean carriers first in Korea', () => {
    expect(top('516139538184', 'US')).toBe('us.fedex');
    expect(top('516139538184', 'KR')).toMatch(/^kr\./);
    expect(top('516139538183', 'US')).toBe('us.fedex');
    // the store's default region applies when none is passed
    setUserRegion('US');
    expect(detectCarriers('516139538184')[0].carrier.id).toBe('us.fedex');
  });
  it('USPS, FedEx Ground/SSCC, UPS, Amazon, DHL', () => {
    expect(top('9400100000000000000000')).toBe('us.usps');
    expect(top('9205590164917312751089')).toBe('us.usps');
    expect(top(makeS10('EA', '12345678', 'US'))).toBe('us.usps');
    expect(top('961234567890123')).toBe('us.fedex');
    expect(top('00123456789012345678')).toBe('us.fedex');
    expect(top('1Z999AA10123456784')).toBe('us.ups');
    expect(top('TBA123456789012')).toBe('us.amazon');
    expect(top('1234567890')).toBe('de.dhl');
  });
  it('USPS barcode scans with "420" + ZIP are trimmed to the tracking number', () => {
    expect(normalizeTrackingNumber('420 90210 9400 1000 0000 0000 0000 00')).toBe('9400100000000000000000');
    expect(normalizeTrackingNumber('420902101234 9400100000000000000000')).toBe('9400100000000000000000');
    expect(validateTrackingNumber('420902101234 9400100000000000000000')).toEqual({ ok: true });
  });
  it('extracts numbers from US emails and texts, skipping phone numbers', () => {
    setUserRegion('US');
    const usps = extractFromText('Your package is on its way!\nUSPS Tracking number: 9400 1000 0000 0000 0000 00\nQuestions? Call 800-275-8777.');
    expect(usps[0]).toMatchObject({ trackingNumber: '9400100000000000000000', carrierId: 'us.usps' });
    expect(usps.some((x) => x.trackingNumber === '8002758777')).toBe(false);
    const ups = extractFromText('Order #112-3456789-1234567 shipped via UPS. Tracking: 1Z999AA10123456784');
    expect(ups[0]).toMatchObject({ trackingNumber: '1Z999AA10123456784', carrierId: 'us.ups' });
    const fedex = extractFromText('FedEx tracking number 5161 3953 8183 — delivery by Tue');
    expect(fedex[0]).toMatchObject({ trackingNumber: '516139538183', carrierId: 'us.fedex' });
    const amz = extractFromText('Shipped with Amazon Logistics. Tracking ID: TBA123456789012');
    expect(amz[0]).toMatchObject({ trackingNumber: 'TBA123456789012', carrierId: 'us.amazon' });
  });
});

describe('live US parcels for a US user', () => {
  const trace = (loc2: string) => ({
    progresses: [
      { time: '2026-11-23T09:00:00-08:00', status: { id: 'at_pickup', text: 'Picked up' }, location: { name: 'LOS ANGELES, CA' }, description: 'Picked up' },
      { time: '2026-11-24T21:00:00-06:00', status: { id: 'in_transit', text: 'In transit' }, location: { name: loc2 }, description: 'Arrived at FedEx hub' },
    ],
  }) as unknown as Parameters<typeof v1ToEvents>[0];
  const parcelAt = (now: Date, carrierId = 'us.fedex') => {
    const snapshot = buildLiveSnapshot(v1ToEvents(trace('MEMPHIS, TN')), { carrierId, trackingNumber: '516139538183', now });
    // parked at the hub (not between stops) so rest days / nights can show
    const parked = { ...snapshot, progress: snapshot.currentStopIndex / (snapshot.stops.length - 1) };
    return { id: 'p', trackingNumber: '516139538183', carrierId, nickname: 'Shoes', character: 'truck', createdAt: now.toISOString(), archived: false, snapshot: parked, unread: 0 } as Parcel;
  };

  it('FedEx is domestic: short ETA window and domestic stale threshold', () => {
    const now = new Date('2026-11-25T18:00:00Z');
    const us = buildLiveSnapshot(v1ToEvents(trace('MEMPHIS, TN')), { carrierId: 'us.fedex', trackingNumber: '1', now, region: 'US' });
    const kr = buildLiveSnapshot(v1ToEvents(trace('MEMPHIS, TN')), { carrierId: 'us.fedex', trackingNumber: '1', now, region: 'KR' });
    const days = (iso: string) => (Date.parse(iso) - now.getTime()) / 864e5;
    expect(days(us.eta!.latest)).toBeLessThan(4);
    expect(us.eta!.confidence).toBeLessThan(0.4);
    expect(days(kr.eta!.latest)).toBeGreaterThan(6); // abroad for a Korean user
    const later = new Date(Date.parse('2026-11-25T03:00:00Z') + 50 * 3.6e6);
    expect(buildLiveSnapshot(v1ToEvents(trace('MEMPHIS, TN')), { carrierId: 'us.fedex', trackingNumber: '1', now: later, region: 'US' }).stale).toBe(true);
    expect(buildLiveSnapshot(v1ToEvents(trace('MEMPHIS, TN')), { carrierId: 'us.fedex', trackingNumber: '1', now: later, region: 'KR' }).stale).toBe(false);
  });

  it('US holidays (not Korean ones) pause a US parcel for a US user', () => {
    setUserRegion('US');
    const thanksgiving = local(2026, 11, 26, 12);
    const p = parcelAt(thanksgiving);
    expect(speechSituation(p, thanksgiving)).toBe('restDay');
    expect(nextStepLine(p, 'en', thanksgiving)).toMatch(/federal holiday.*Friday/);
    expect(nextStepLine(p, 'ko', thanksgiving)).not.toMatch(/허브/);
    const chuseok = local(2026, 9, 25, 12);
    expect(speechSituation(parcelAt(chuseok), chuseok)).not.toBe('restDay');
    // A Korean user's FedEx parcel abroad ignores rest days entirely.
    setUserRegion('KR');
    expect(speechSituation(p, thanksgiving)).not.toBe('restDay');
  });
});
