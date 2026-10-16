/**
 * Deterministic parcel simulation.
 * A PLAN (stops, timed events, movement segments) is built from (trackingNumber, carrierId, createdAt) with seeded
 * PRNG streams; a SNAPSHOT at sim-time `now` is everything in the plan that has happened by `now`.
 * See docs/engine.md for the model.
 */
import type { Checkpoint, Eta, LocalizedText, RouteStop, ShipmentScope, StatusTag, TrackingSnapshot, TransportMode } from '@/types';
import { getCarrier, withMod7 } from './carriers';
import { HOUR, MINUTE, atHour, dayStart, isRestDay, workingHoursBetween } from './calendar';
import { hashString, pick, pickWeighted, rngFor, uniform, type Rng } from './prng';
import {
  AIRPORT_CUSTOMS, DELAY_MSG, HOME, HOME_AREA, INCHEON_AIRPORT, INTL_MSG, MEGA_HUBS, ORIGINS, SEA_ROUTES, SELLER_AREAS,
  WHERE_TEXT, domesticMessage, facility, familyOf, type DeliveredWhere, type Family, type L,
} from './places';

export type EventCode =
  | 'received' | 'pickup' | 'depart' | 'arrive_hub' | 'arrive_local' | 'export_depart' | 'airport_arrive'
  | 'flight_depart' | 'flight_arrive' | 'port_arrive' | 'sail_depart' | 'sail_arrive' | 'customs_in' | 'customs_declared'
  | 'customs_cleared' | 'handover' | 'out_for_delivery' | 'delivered' | 'attempt_fail' | 'pickup_ready' | 'picked_up' | 'delay';

export type DelayReason = 'weather' | 'hub_congestion' | 'customs_inspection' | 'holiday';
export type PickupKind = 'convenience_store' | 'locker' | 'branch' | 'post_office';

export interface PlanEvent {
  code: EventCode;
  detail?: string;
  time: number;
  status: StatusTag;
  stopIndex: number;
  location: LocalizedText;
  message: LocalizedText;
}

export interface Segment { fromPos: number; toPos: number; depart: number; arrive: number; mode: TransportMode }

export interface Scenario {
  delay?: DelayReason;
  attemptFail: boolean;
  pickup?: PickupKind;
  where: DeliveredWhere;
  sea: boolean;
}

export interface Plan {
  scope: ShipmentScope;
  family: Family;
  scenario: Scenario;
  stops: RouteStop[];
  events: PlanEvent[];
  segments: Segment[];
  /** Stage-uncertainty table: [time from which it applies, hours of uncertainty] */
  uncertainty: Array<[number, number]>;
  handoff?: { carrierId: string; trackingNumber: string; time: number };
  pickup?: { place: LocalizedText; kind: PickupKind };
  /** When the delay becomes known (only on delayed plans). */
  delayNoticeAt?: number;
}

export interface PlanRequest { trackingNumber: string; carrierId: string; createdAt: string }

// ───────────────────────── scheduling helpers ─────────────────────────

/**
 * A time ≥ `earliest` inside the daily window [h0, h1) (local hours; h1 may exceed 24).
 * With `rest`, windows starting on Sundays/holidays are skipped (Korean hubs rest).
 */
export function slot(earliest: number, h0: number, h1: number, rng: Rng, rest = true): number {
  for (let k = -1; k < 21; k++) {
    const day = dayStart(earliest, k);
    if (rest && isRestDay(new Date(day))) continue;
    const ws = atHour(day, h0);
    const we = atHour(day, h1);
    if (we <= earliest) continue;
    const s = Math.max(ws, earliest);
    if (s >= we) continue;
    return Math.round(s + Math.pow(rng(), 1.4) * (we - s));
  }
  return earliest;
}

const statusFor = (code: EventCode): StatusTag => {
  switch (code) {
    case 'received': return 'info_received';
    case 'customs_in': case 'customs_declared': case 'customs_cleared': return 'customs';
    case 'out_for_delivery': return 'out_for_delivery';
    case 'delivered': case 'picked_up': return 'delivered';
    case 'attempt_fail': return 'attempt_fail';
    case 'pickup_ready': return 'available_for_pickup';
    default: return 'in_transit';
  }
};

const Lx = (ko: string, en: string): L => ({ ko, en });

// ───────────────────────── scenario ─────────────────────────

export function scenarioFor(trackingNumber: string, carrierId: string): Scenario {
  const carrier = getCarrier(carrierId);
  const scope = carrier?.scope ?? 'domestic';
  const family = familyOf(carrierId, scope);
  const r = rngFor(`${trackingNumber}|${carrierId}|scenario`);
  const delayRoll = r(); const attemptRoll = r(); const pickupRoll = r(); const reasonRoll = r(); const kindRoll = r(); const seaRoll = r();
  let pickup: PickupKind | undefined;
  if (family === 'cvs') pickup = 'convenience_store';
  else if ((family === 'kd' || family === 'daesin') && pickupRoll < 0.6) pickup = 'branch';
  else if (family !== 'coupang' && pickupRoll < 1 / 20) {
    pickup = family === 'epost' || family === 'intl' ? 'post_office' : kindRoll < 0.5 ? 'convenience_store' : 'locker';
  }
  let delay: DelayReason | undefined;
  if (delayRoll < 1 / 6) {
    delay = scope === 'international'
      ? (reasonRoll < 0.45 ? 'customs_inspection' : reasonRoll < 0.75 ? 'weather' : 'hub_congestion')
      : (reasonRoll < 0.55 ? 'hub_congestion' : 'weather');
  }
  const attemptFail = !pickup && family !== 'coupang' && attemptRoll < 1 / 12;
  const where = pickWeighted<DeliveredWhere>(r, family === 'coupang'
    ? [['door', 0.9], ['security', 0.1]]
    : [['door', 0.55], ['security', 0.2], ['locker', 0.15], ['hand', 0.1]]);
  const sea = (carrierId === 'cn.cainiao' || carrierId === 'cn.yunexpress' || carrierId === 'cn.4px') && seaRoll < 0.25;
  return { delay, attemptFail, pickup, where, sea };
}

// ───────────────────────── plan builder ─────────────────────────

interface BuildCtx {
  req: PlanRequest;
  seed: string;
  delays: Partial<Record<EventCode, number>>;
  scenario: Scenario;
}

class Builder {
  events: PlanEvent[] = [];
  segments: Segment[] = [];
  uncertainty: Array<[number, number]> = [];
  handoff?: { carrierId: string; trackingNumber: string; time: number };
  constructor(private ctx: BuildCtx) {}
  rng(step: string): Rng { return rngFor(`${this.ctx.seed}|${step}`); }
  /** extra delay hours injected before a step (delay scenario) */
  extra(code: EventCode): number { return (this.ctx.delays[code] ?? 0) * HOUR; }
  add(code: EventCode, time: number, stopIndex: number, location: L, message: L, detail?: string) {
    this.events.push({ code, detail, time, status: statusFor(code), stopIndex, location, message });
    return time;
  }
  move(fromPos: number, toPos: number, depart: number, arrive: number, mode: TransportMode) {
    this.segments.push({ fromPos, toPos, depart, arrive: Math.max(arrive, depart + MINUTE), mode });
  }
  stage(from: number, hours: number) { this.uncertainty.push([from, hours]); }
}

function domesticNumber(partner: string, seed: string): string {
  const r = rngFor(`${seed}|handoff-number`);
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
  switch (partner) {
    case 'kr.hanjin': return '5' + digits(11);
    case 'kr.epost': return '60' + digits(11);
    case 'kr.lotte': return withMod7('3' + digits(10));
    default: return withMod7('6' + digits(10));
  }
}

/** The domestic last-mile chain shared by domestic and (after customs) international parcels. */
function lastMile(b: Builder, opts: {
  family: Family; start: number; hubIdx: number; hub: L; localIdx: number; local: L; destIdx: number; dest: L;
  scenario: Scenario; arriveHubFromIdx: number; arriveHubDepart: number;
}): void {
  const { family, start, hubIdx, hub, localIdx, local, destIdx, dest, scenario } = opts;
  const msg = (c: Parameters<typeof domesticMessage>[1]) => domesticMessage(family === 'intl' ? 'epost' : family, c);
  // trunk to the mega hub (travel from previous facility)
  const arriveHub = b.add('arrive_hub', start, hubIdx, hub, msg('arrive_hub'));
  b.move(opts.arriveHubFromIdx, hubIdx, opts.arriveHubDepart, arriveHub, 'truck');
  // ~30% miss the night's connection and wait a day at the hub (common in reality: "허브 대기").
  const layover = b.rng('layover')() < 0.3 ? 20 * HOUR : HOUR;
  const departHub = b.add('depart', slot(arriveHub + layover + b.extra('depart'), 1, 5, b.rng('departHub')), hubIdx, hub, msg('depart'));
  b.stage(departHub, 12);
  const arriveLocal = b.add('arrive_local', departHub + uniform(b.rng('arriveLocal'), 1.5, 3) * HOUR, localIdx, local, msg('arrive_local'));
  b.move(hubIdx, localIdx, departHub, arriveLocal, 'truck');
  b.stage(arriveLocal, 8);
  const ofd = b.add('out_for_delivery', slot(arriveLocal + 0.5 * HOUR, 7, 10, b.rng('ofd')), localIdx, local, msg('out_for_delivery'));
  b.stage(ofd, 2.5);
  const finalTime = slot(ofd + 0.75 * HOUR, 9, 19.5, b.rng('deliver'));
  if (scenario.attemptFail) {
    const attempt = b.add('attempt_fail', finalTime, localIdx, dest, msg('attempt_fail'));
    b.move(localIdx, localIdx + 0.7, ofd, attempt, 'bike');
    b.stage(attempt, 10);
    const ofd2 = b.add('out_for_delivery', slot(attempt + 8 * HOUR, 7, 10, b.rng('ofd2')), localIdx, local, msg('out_for_delivery'), 'retry');
    b.stage(ofd2, 2.5);
    const del = b.add('delivered', slot(ofd2 + 0.75 * HOUR, 9, 19.5, b.rng('deliver2')), destIdx, dest, withWhere(msg('delivered'), scenario.where), scenario.where);
    b.move(localIdx + 0.7, destIdx, ofd2, del, 'bike');
  } else if (scenario.pickup) {
    const ready = b.add('pickup_ready', finalTime, destIdx, dest, msg('pickup_ready'), scenario.pickup);
    b.move(localIdx, destIdx, ofd, ready, 'bike');
    b.stage(ready, 0);
    b.add('picked_up', slot(ready + uniform(b.rng('collect'), 3, 26) * HOUR, 9, 21.5, b.rng('collect2'), false), destIdx, dest, msg('picked_up'), 'pickup');
  } else {
    const del = b.add('delivered', finalTime, destIdx, dest, withWhere(msg('delivered'), scenario.where), scenario.where);
    b.move(localIdx, destIdx, ofd, del, 'bike');
  }
}

function withWhere(m: L, where: DeliveredWhere): L {
  const w = WHERE_TEXT[where];
  return { ko: `${m.ko} (${w.ko})`, en: `${m.en} — ${w.en}` };
}

function pickupPlace(kind: PickupKind, family: Family, carrierName: L): L {
  switch (kind) {
    case 'convenience_store': return Lx(`GS25 ${HOME_AREA.ko}역점`, `GS25 ${HOME_AREA.en} Station`);
    case 'locker': return Lx(`${HOME_AREA.ko} 무인택배함`, `${HOME_AREA.en} parcel locker`);
    case 'post_office': return Lx(`${HOME_AREA.ko}우체국`, `${HOME_AREA.en} Post Office`);
    case 'branch': return Lx(`${carrierName.ko} ${HOME_AREA.ko} 영업소`, `${carrierName.en} ${HOME_AREA.en} branch`);
    default: void family; return HOME;
  }
}

function buildDomestic(ctx: BuildCtx, carrierId: string): Plan {
  const b = new Builder(ctx);
  const carrier = getCarrier(carrierId);
  const name = Lx(carrier?.nameKo ?? carrierId, carrier?.nameEn ?? carrierId);
  const family = familyOf(carrierId, 'domestic');
  const sc = ctx.scenario;
  const created = new Date(ctx.req.createdAt).getTime();
  const r = b.rng('places');
  const sellerArea = pick(r, SELLER_AREAS);
  const hub = pick(r, MEGA_HUBS[family]);
  const local = facility(family, HOME_AREA, name);
  const dest = sc.pickup ? pickupPlace(sc.pickup, family, name) : HOME;
  const destKind = 'destination' as const;

  if (family === 'coupang') {
    const stops: RouteStop[] = [
      { id: 'origin', kind: 'origin', name: hub, modeToNext: 'truck' },
      { id: 'local', kind: 'local', name: local, modeToNext: 'bike' },
      { id: 'home', kind: destKind, name: dest },
    ];
    const msg = (c: Parameters<typeof domesticMessage>[1]) => domesticMessage('coupang', c);
    const received = b.add('received', created + uniform(b.rng('received'), 5, 30) * MINUTE, 0, hub, msg('received'));
    b.stage(received, 10);
    const depart = b.add('depart', slot(received + HOUR + b.extra('depart'), 18, 23.5, b.rng('depart'), false), 0, hub, msg('depart'));
    b.stage(depart, 5);
    const arrive = b.add('arrive_local', depart + uniform(b.rng('arrive'), 1.5, 3) * HOUR, 1, local, msg('arrive_local'));
    b.move(0, 1, depart, arrive, 'truck');
    const ofd = b.add('out_for_delivery', slot(arrive + 0.5 * HOUR, 1, 5.5, b.rng('ofd'), false), 1, local, msg('out_for_delivery'));
    b.stage(ofd, 1.5);
    const del = b.add('delivered', ofd + uniform(b.rng('deliver'), 1, 3) * HOUR, 2, dest, withWhere(msg('delivered'), sc.where), sc.where);
    b.move(1, 2, ofd, del, 'bike');
    return finish(b, ctx, { scope: 'domestic', family, stops });
  }

  const branch = facility(family, sellerArea, name);
  const stops: RouteStop[] = [
    { id: 'origin', kind: 'origin', name: Lx(`판매자 · ${sellerArea.ko}`, `Seller · ${sellerArea.en}`), modeToNext: 'truck' },
    { id: 'branch', kind: 'hub', name: branch, modeToNext: 'truck' },
    { id: 'hub', kind: 'hub', name: hub, modeToNext: 'truck' },
    { id: 'local', kind: 'local', name: local, modeToNext: 'bike' },
    { id: 'home', kind: destKind, name: dest },
  ];
  const msg = (c: Parameters<typeof domesticMessage>[1]) => domesticMessage(family, c);
  const received = b.add('received', created + uniform(b.rng('received'), 5, 30) * MINUTE, 0, Lx(sellerArea.ko, sellerArea.en), msg('received'));
  b.stage(received, 30);
  const pickupT = b.add('pickup', slot(received + 70 * MINUTE, 15, 19.5, b.rng('pickup')), 1, branch, msg('pickup'));
  b.move(0, 1, pickupT - uniform(b.rng('pickupTravel'), 30, 60) * MINUTE, pickupT, 'truck');
  b.stage(pickupT, 20);
  const departBranch = b.add('depart', slot(pickupT + HOUR + b.extra('pickup'), 18.5, 22.5, b.rng('departBranch')), 1, branch, msg('depart'));
  b.stage(departBranch, 16);
  const arriveHubAt = departBranch + uniform(b.rng('trunk'), 1.5, 3.5) * HOUR;
  lastMile(b, {
    family, start: arriveHubAt, hubIdx: 2, hub, localIdx: 3, local, destIdx: 4, dest, scenario: sc,
    arriveHubFromIdx: 1, arriveHubDepart: departBranch,
  });
  return finish(b, ctx, { scope: 'domestic', family, stops });
}

const HANDOFF_PARTNERS: Record<string, Array<readonly [string, number]>> = {
  'cn.cainiao': [['kr.cjlogistics', 0.75], ['kr.hanjin', 0.1], ['kr.lotte', 0.1], ['kr.epost', 0.05]],
  'cn.yunexpress': [['kr.hanjin', 0.45], ['kr.cjlogistics', 0.35], ['kr.lotte', 0.2]],
  'cn.4px': [['kr.hanjin', 0.45], ['kr.cjlogistics', 0.35], ['kr.lotte', 0.2]],
  'cn.sf': [['kr.cjlogistics', 0.5], ['kr.hanjin', 0.3], ['kr.lotte', 0.2]],
  'us.amazon': [['kr.cjlogistics', 0.7], ['kr.hanjin', 0.3]],
};
const POSTAL = new Set(['cn.chinapost', 'cn.ems', 'us.usps', 'kr.epost.ems', 'kr.epost.intl', 'upu.s10']);

function originCountry(carrierId: string, trackingNumber: string, r: Rng): string {
  const s10 = /^[A-Z]{2}\d{9}([A-Z]{2})$/.exec(trackingNumber);
  if (s10 && s10[1] !== 'KR' && ORIGINS[s10[1]]) return s10[1];
  const c = getCarrier(carrierId);
  if (carrierId === 'us.ups') return pickWeighted(r, [['US', 0.6], ['DE', 0.2], ['JP', 0.2]]);
  if (carrierId === 'de.dhl') return pickWeighted(r, [['DE', 0.4], ['HK', 0.2], ['JP', 0.2], ['US', 0.1], ['GB', 0.1]]);
  if (c && ORIGINS[c.country]) return c.country;
  return pickWeighted(r, [['US', 0.3], ['JP', 0.3], ['DE', 0.15], ['GB', 0.1], ['AU', 0.15]]);
}

function buildInternational(ctx: BuildCtx, carrierId: string): Plan {
  const b = new Builder(ctx);
  const sc = ctx.scenario;
  const created = new Date(ctx.req.createdAt).getTime();
  const r = b.rng('places');
  const country = originCountry(carrierId, ctx.req.trackingNumber, r);
  const origin = pick(r, ORIGINS[country]);
  const sea = sc.sea ? pick(r, SEA_ROUTES) : undefined;
  const express = familyOf(carrierId, 'international') === 'express';
  const partnerId = POSTAL.has(carrierId) ? 'kr.epost' : express ? carrierId : pickWeighted(r, HANDOFF_PARTNERS[carrierId] ?? [['kr.cjlogistics', 1]]);
  const partner = getCarrier(partnerId);
  const partnerName = Lx(partner?.nameKo ?? partnerId, partner?.nameEn ?? partnerId);
  const dFamily: Family = express ? 'express' : familyOf(partnerId, 'domestic');
  const hub = pick(r, MEGA_HUBS[dFamily]);
  const local = facility(dFamily, HOME_AREA, partnerName);
  const dest = sc.pickup ? pickupPlace(sc.pickup, dFamily, partnerName) : HOME;
  const city = sea ? sea.city : origin.city;
  const cityFacility = Lx(`${city.ko} 물류센터`, `${city.en} logistics center`);
  const depPoint = sea ? sea.port : origin.airport;
  const arrPoint = sea ? sea.arrivalPort : INCHEON_AIRPORT;
  const customs = sea ? sea.customs : AIRPORT_CUSTOMS;
  const stops: RouteStop[] = [
    { id: 'origin', kind: 'origin', name: city, modeToNext: 'truck' },
    { id: 'depart-port', kind: sea ? 'hub' : 'airport', name: depPoint, modeToNext: sea ? 'ship' : 'plane' },
    { id: 'arrive-port', kind: sea ? 'hub' : 'airport', name: arrPoint, modeToNext: 'truck' },
    { id: 'customs', kind: 'customs', name: customs, modeToNext: 'truck' },
    { id: 'hub', kind: 'hub', name: hub, modeToNext: 'truck' },
    { id: 'local', kind: 'local', name: local, modeToNext: 'bike' },
    { id: 'home', kind: 'destination', name: dest },
  ];

  const received = b.add('received', created + uniform(b.rng('received'), 5, 30) * MINUTE, 0, city, INTL_MSG.received);
  b.stage(received, 96);
  const pickupT = b.add('pickup', slot(received + uniform(b.rng('pickupGap'), 2, 20) * HOUR, 8, 22, b.rng('pickup'), false), 0, cityFacility, INTL_MSG.pickup);
  b.stage(pickupT, 84);
  const exportDepart = b.add('export_depart', pickupT + uniform(b.rng('export'), 4, 16) * HOUR, 0, cityFacility, INTL_MSG.export_depart);
  const atPort = b.add(sea ? 'port_arrive' : 'airport_arrive', exportDepart + uniform(b.rng('toAirport'), 1.5, 4) * HOUR, 1, depPoint,
    sea ? INTL_MSG.port_arrive : INTL_MSG.airport_arrive);
  b.move(0, 1, exportDepart, atPort, 'truck');
  const leaveCode: EventCode = sea ? 'sail_depart' : 'flight_depart';
  const leave = b.add(leaveCode, atPort + (uniform(b.rng('wait'), 3, 20) * HOUR) + b.extra(leaveCode), 1, depPoint, sea ? INTL_MSG.sail_depart : INTL_MSG.flight_depart);
  b.stage(leave, 60);
  const travelH = sea ? uniform(b.rng('sail'), sea.sailH[0], sea.sailH[1]) : uniform(b.rng('flight'), origin.flightH[0], origin.flightH[1]);
  const arrive = b.add(sea ? 'sail_arrive' : 'flight_arrive', leave + travelH * HOUR, 2, arrPoint,
    sea ? Lx(`${INTL_MSG.sail_arrive.ko} (${arrPoint.ko})`, `${INTL_MSG.sail_arrive.en} (${arrPoint.en})`) : INTL_MSG.flight_arrive);
  b.move(1, 2, leave, arrive, sea ? 'ship' : 'plane');
  b.stage(arrive, 54);
  const customsIn = b.add('customs_in', arrive + uniform(b.rng('customsIn'), 2, 6) * HOUR, 3, customs, INTL_MSG.customs_in);
  b.move(2, 3, arrive + 0.5 * HOUR, customsIn, 'truck');
  const declared = b.add('customs_declared', slot(customsIn + HOUR, 8, 20, b.rng('declared')), 3, customs, INTL_MSG.customs_declared);
  const cleared = b.add('customs_cleared', slot(declared + uniform(b.rng('clearGap'), 2, 8) * HOUR + b.extra('customs_cleared'), 9, 20, b.rng('cleared')), 3, customs, INTL_MSG.customs_cleared);
  b.stage(cleared, 30);
  const handTime = slot(cleared + uniform(b.rng('handGap'), 1, 4) * HOUR, 10, 21, b.rng('handover'));
  let handover: number;
  if (express) {
    handover = b.add('depart', handTime, 3, customs, domesticMessage('express', 'depart'));
  } else {
    const newNumber = partnerId === 'kr.epost' ? ctx.req.trackingNumber : domesticNumber(partnerId, ctx.seed);
    handover = b.add('handover', handTime, 3, customs,
      Lx(`국내 택배사 인계 (${partnerName.ko})`, `Handed over to ${partnerName.en}`), partnerId);
    if (newNumber !== ctx.req.trackingNumber) b.handoff = { carrierId: partnerId, trackingNumber: newNumber, time: handover };
  }
  b.stage(handover, 24);
  lastMile(b, {
    family: dFamily, start: handover + uniform(b.rng('toHub'), 2, 4) * HOUR + b.extra('arrive_hub'),
    hubIdx: 4, hub, localIdx: 5, local, destIdx: 6, dest, scenario: sc, arriveHubFromIdx: 3, arriveHubDepart: handover,
  });
  return finish(b, ctx, { scope: 'international', family: dFamily, stops });
}

function finish(b: Builder, ctx: BuildCtx, base: { scope: ShipmentScope; family: Family; stops: RouteStop[] }): Plan {
  b.events.sort((x, y) => x.time - y.time);
  b.segments.sort((x, y) => x.depart - y.depart);
  b.uncertainty.sort((x, y) => x[0] - y[0]);
  const sc = ctx.scenario;
  const ready = b.events.find((e) => e.code === 'pickup_ready');
  return {
    ...base,
    scenario: sc,
    events: b.events,
    segments: b.segments,
    uncertainty: b.uncertainty,
    handoff: b.handoff,
    pickup: sc.pickup && ready ? { place: ready.location, kind: sc.pickup } : undefined,
  };
}

/** Which step a delay reason pushes back, and by how many hours. */
function delayInjection(reason: DelayReason, scope: ShipmentScope, r: Rng): Partial<Record<EventCode, number>> {
  if (scope === 'international') {
    if (reason === 'customs_inspection') return { customs_cleared: uniform(r, 24, 44) };
    if (reason === 'weather') return { flight_depart: uniform(r, 14, 30), sail_depart: uniform(r, 14, 30) };
    return { arrive_hub: uniform(r, 14, 26) };
  }
  if (reason === 'weather') return { pickup: uniform(r, 16, 28) };
  return { depart: uniform(r, 14, 30) };
}

export interface PlanPair { actual: Plan; base: Plan }

const cache = new Map<string, PlanPair>();

/** Build (or fetch cached) plan for a parcel. Pure & deterministic. */
export function planFor(req: PlanRequest): PlanPair {
  const key = `${req.trackingNumber}|${req.carrierId}|${req.createdAt}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const carrier = getCarrier(req.carrierId);
  const scope: ShipmentScope = carrier?.scope ?? 'domestic';
  const scenario = scenarioFor(req.trackingNumber, req.carrierId);
  const seed = `${req.trackingNumber}|${req.carrierId}`;
  const build = (delays: Partial<Record<EventCode, number>>) => {
    const ctx: BuildCtx = { req, seed, delays, scenario };
    return scope === 'international' ? buildInternational(ctx, req.carrierId) : buildDomestic(ctx, req.carrierId);
  };
  const base = build({});
  let actual = base;
  if (scenario.delay) {
    const inj = delayInjection(scenario.delay, scope, rngFor(`${seed}|delay`));
    actual = build(inj);
    // Notice = when the delayed step should have happened in the base plan; the delay checkpoint goes there.
    const firstDiff = actual.events.findIndex((e, i) => base.events[i]?.time !== e.time || base.events[i]?.code !== e.code);
    if (firstDiff > 0) {
      const notice = base.events[firstDiff].time;
      const prev = actual.events[firstDiff - 1];
      const at = Math.min(Math.max(notice, prev.time + 10 * MINUTE), actual.events[firstDiff].time - 30 * MINUTE);
      if (at > prev.time) {
        actual.events.splice(firstDiff, 0, {
          code: 'delay', detail: scenario.delay, time: at, status: prev.status, stopIndex: prev.stopIndex,
          location: prev.location, message: DELAY_MSG[scenario.delay],
        });
        actual.delayNoticeAt = at;
      }
    }
  }
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  const pair = { actual, base };
  cache.set(key, pair);
  return pair;
}

// ───────────────────────── snapshot ─────────────────────────

const TERMINAL: EventCode[] = ['delivered', 'attempt_fail', 'pickup_ready', 'picked_up'];

/** Stable checkpoint id: `<slug>-<seq>-<code>[~<detail>]` (the code lets speech know what happened). */
function checkpointId(slug: string, seq: number, e: PlanEvent): string {
  return `${slug}-${seq}-${e.code}${e.detail ? `~${e.detail}` : ''}`;
}

/** Parse the event code (and detail) from a simulated checkpoint id. Real-provider ids return undefined. */
export function checkpointCode(id: string): { code: EventCode; detail?: string } | undefined {
  const m = /-\d+-([a-z_]+)(?:~([a-z_.]+))?$/.exec(id);
  return m ? { code: m[1] as EventCode, detail: m[2] } : undefined;
}

function etaFor(plan: Plan, now: number): Eta | undefined {
  const target = plan.events.find((e) => TERMINAL.includes(e.code) && e.time > now);
  if (!target) return undefined;
  let u = 24;
  for (const [from, h] of plan.uncertainty) if (from <= now) u = h;
  if (u <= 0) u = 1;
  const earliest = Math.max(now, target.time - u * 0.35 * HOUR);
  const latest = Math.max(earliest + 30 * MINUTE, target.time + u * 0.65 * HOUR);
  const confidence = Math.round(Math.min(0.95, Math.max(0.3, 1 - u / 100)) * 100) / 100;
  return { earliest: new Date(earliest).toISOString(), latest: new Date(latest).toISOString(), confidence };
}

/** Hours without a new checkpoint before a stage counts as stale (working hours for in-transit). */
export function computeStale(status: StatusTag, lastTime: number | undefined, now: number): boolean {
  if (lastTime === undefined) return false;
  switch (status) {
    case 'info_received': return workingHoursBetween(lastTime, now) > 48;
    case 'in_transit': return workingHoursBetween(lastTime, now) > 24;
    case 'customs': return (now - lastTime) / HOUR > 72;
    case 'out_for_delivery': return (now - lastTime) / HOUR > 14;
    default: return false;
  }
}

/** Snapshot of a plan at sim time `now`. */
export function snapshotAt(req: PlanRequest, nowDate: Date): TrackingSnapshot {
  const now = nowDate.getTime();
  const { actual: plan, base } = planFor(req);
  const slug = hashString(`${req.trackingNumber}|${req.carrierId}|${req.createdAt}`).toString(36);
  const checkpoints: Checkpoint[] = [];
  plan.events.forEach((e, seq) => {
    if (e.time <= now) {
      checkpoints.push({
        id: checkpointId(slug, seq, e), time: new Date(e.time).toISOString(), status: e.status,
        location: e.location, message: e.message, stopIndex: e.stopIndex,
      });
    }
  });
  const n = plan.stops.length;
  let pos = 0;
  let moving: Segment | undefined;
  for (const s of plan.segments) {
    if (s.arrive <= now) pos = Math.max(pos, s.toPos);
    else if (s.depart <= now) {
      moving = s;
      pos = Math.max(pos, s.fromPos + (s.toPos - s.fromPos) * ((now - s.depart) / (s.arrive - s.depart)));
    }
  }
  const last = checkpoints.at(-1);
  const status: StatusTag = last?.status ?? 'pending';
  if (status === 'delivered') pos = n - 1;
  pos = Math.min(n - 1, Math.max(0, pos));
  const currentStopIndex = Math.min(n - 1, Math.floor(pos + 1e-9));
  const currentMode: TransportMode = moving?.mode ?? plan.stops[currentStopIndex].modeToNext ?? 'bike';

  const delayed = !!plan.delayNoticeAt && now >= plan.delayNoticeAt && status !== 'delivered' && status !== 'available_for_pickup';
  let eta: Eta | undefined;
  if (status === 'delivered' && last) eta = { earliest: last.time, latest: last.time, confidence: 1 };
  else if (status !== 'available_for_pickup') eta = etaFor(plan.delayNoticeAt && now < plan.delayNoticeAt ? base : plan, now);

  const snap: TrackingSnapshot = {
    status,
    checkpoints,
    stops: plan.stops,
    progress: n > 1 ? Math.round((pos / (n - 1)) * 10000) / 10000 : 0,
    currentStopIndex,
    currentMode,
    eta,
    updatedAt: nowDate.toISOString(),
  };
  if (delayed) { snap.delayed = true; snap.delayReason = plan.scenario.delay; }
  if (!moving && computeStale(status, last ? new Date(last.time).getTime() : undefined, now)) snap.stale = true;
  if (plan.handoff && plan.handoff.time <= now) {
    snap.handoff = { carrierId: plan.handoff.carrierId, trackingNumber: plan.handoff.trackingNumber, time: new Date(plan.handoff.time).toISOString() };
  }
  const readyEv = plan.events.find((e) => e.code === 'pickup_ready');
  if (plan.pickup && readyEv && readyEv.time <= now) snap.pickup = plan.pickup;
  return snap;
}

/** Final (delivered/picked-up) time of a plan — handy for tests and demo seeding. */
export function plannedCompletion(req: PlanRequest): number {
  const { actual } = planFor(req);
  return actual.events[actual.events.length - 1].time;
}
