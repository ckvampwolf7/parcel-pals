import { isRestDay, mockProvider, planFor, scenarioFor, snapshotAt, checkpointCode, moodFor, withMod7ForTest } from './testkit';
import { computeStale } from './simulator';
import type { TrackingSnapshot } from '@/types';

const H = 3.6e6;
// Created Tue 2026-10-13 10:00 local — TZ-independent because we build it with local Date fields.
const T0 = new Date(2026, 9, 13, 10, 0).getTime();
const req = (trackingNumber: string, carrierId: string, createdAt = T0) => ({ trackingNumber, carrierId, createdAt: new Date(createdAt).toISOString() });
const snap = (r: ReturnType<typeof req>, t: number) => snapshotAt(r, new Date(t));
const cjNumbers = (n: number) => Array.from({ length: n }, (_, i) => withMod7ForTest(String(64012300000 + i * 7919)));
const lpNumbers = (n: number) => Array.from({ length: n }, (_, i) => 'LP' + String(10000000000000 + i * 104729).padStart(14, '0'));
const completion = (r: ReturnType<typeof req>) => { const e = planFor(r).actual.events; return e[e.length - 1].time; };

describe('determinism & stability', () => {
  it('same input → identical snapshots', () => {
    const r = req('640123456136', 'kr.cjlogistics');
    for (const h of [0.1, 5, 20, 40]) expect(snap(r, T0 + h * H)).toEqual(snap({ ...r }, T0 + h * H));
  });
  it('checkpoints are chronological, ids stable and grow as a prefix', () => {
    for (const r of [req('640123456136', 'kr.cjlogistics'), req('LP00512345678918', 'cn.cainiao'), req('1Z999AA10123456784', 'us.ups')]) {
      let prev: TrackingSnapshot | null = null;
      for (let t = T0; t < T0 + 14 * 24 * H; t += 2 * H) {
        const s = snap(r, t);
        const times = s.checkpoints.map((c) => Date.parse(c.time));
        expect([...times].sort((a, b) => a - b)).toEqual(times);
        expect(new Set(s.checkpoints.map((c) => c.id)).size).toBe(s.checkpoints.length);
        if (prev) expect(s.checkpoints.slice(0, prev.checkpoints.length).map((c) => c.id)).toEqual(prev.checkpoints.map((c) => c.id));
        prev = s;
      }
    }
  });
  it('checkpoint ids carry the event code', () => {
    const s = snap(req('640123456136', 'kr.cjlogistics'), T0 + 10 * 24 * H);
    expect(checkpointCode(s.checkpoints[0].id)?.code).toBe('received');
    expect(checkpointCode(s.checkpoints.at(-1)!.id)?.code).toBe('delivered');
    expect(checkpointCode('td-abc')).toBeUndefined();
  });
  it('mock provider matches snapshotAt', async () => {
    const r = req('640123456136', 'kr.cjlogistics');
    expect(await mockProvider.track(r, new Date(T0 + 7 * H))).toEqual(snap(r, T0 + 7 * H));
  });
});

describe('progress & timing', () => {
  it('pending before the first scan (5–30 sim minutes after adding)', () => {
    const r = req('640123456136', 'kr.cjlogistics');
    const s = snap(r, T0 + 2 * 60e3);
    expect(s.status).toBe('pending');
    expect(s.checkpoints).toHaveLength(0);
    expect(s.progress).toBe(0);
    const first = planFor(r).actual.events[0].time - T0;
    expect(first).toBeGreaterThanOrEqual(5 * 60e3);
    expect(first).toBeLessThanOrEqual(30 * 60e3);
  });
  it('progress is monotonic, continuous, and ends at 1 when delivered', () => {
    for (const r of [...cjNumbers(15).map((n) => req(n, 'kr.cjlogistics')), ...lpNumbers(8).map((n) => req(n, 'cn.cainiao'))]) {
      let last = 0;
      let maxJump = 0;
      const end = completion(r);
      for (let t = T0; t <= end + H; t += 10 * 60e3) {
        const s = snap(r, t);
        expect(s.progress).toBeGreaterThanOrEqual(last - 1e-9);
        maxJump = Math.max(maxJump, s.progress - last);
        last = s.progress;
        if (s.status !== 'delivered' && s.eta) expect(Date.parse(s.eta.latest)).toBeGreaterThanOrEqual(t);
      }
      expect(last).toBe(1);
      expect(maxJump).toBeLessThan(0.2); // smooth, no teleporting
      expect(snap(r, end + H).status).toBe('delivered');
    }
  });
  it('domestic takes ~1–3 days (longer only on delays/rest days); international ~5–12 days', () => {
    for (const n of cjNumbers(80)) {
      const r = req(n, 'kr.cjlogistics');
      const sc = scenarioFor(n, 'kr.cjlogistics');
      const days = (completion(r) - T0) / (24 * H);
      expect(days).toBeGreaterThan(0.4);
      expect(days).toBeLessThan(sc.delay || sc.attemptFail || sc.pickup ? 6 : 4);
    }
    for (const n of lpNumbers(60)) {
      const days = (completion(req(n, 'cn.cainiao')) - T0) / (24 * H);
      expect(days).toBeGreaterThan(3);
      expect(days).toBeLessThan(14);
    }
  });
  it('hubs rest on Sundays/holidays: no pickups, departures, customs decisions or deliveries', () => {
    const NO_REST = new Set(['pickup', 'depart', 'out_for_delivery', 'delivered', 'attempt_fail', 'customs_declared', 'customs_cleared', 'handover']);
    const reqs = [...cjNumbers(40).map((n) => req(n, 'kr.cjlogistics')), ...lpNumbers(30).map((n) => req(n, 'cn.cainiao'))];
    for (const created of [T0, T0 + 4 * 24 * H, new Date(2026, 9, 2, 9).getTime() /* before 개천절/추석 substitute */]) {
      for (const r0 of reqs) {
        const r = { ...r0, createdAt: new Date(created).toISOString() };
        const plan = planFor(r).actual;
        const customsIdx = plan.stops.findIndex((s) => s.kind === 'customs');
        for (const e of plan.events) {
          const inKorea = customsIdx < 0 || e.stopIndex >= customsIdx;
          if (NO_REST.has(e.code) && inKorea) expect(isRestDay(new Date(e.time))).toBe(false);
        }
      }
    }
  });
  it('domestic rhythm: pickups late afternoon/evening, out-for-delivery in the morning, deliveries by evening', () => {
    for (const n of cjNumbers(40)) {
      for (const e of planFor(req(n, 'kr.cjlogistics')).actual.events) {
        const h = new Date(e.time).getHours() + new Date(e.time).getMinutes() / 60;
        if (e.code === 'pickup') expect(h >= 15 && h <= 19.5).toBe(true);
        if (e.code === 'out_for_delivery') expect(h >= 7 && h <= 10).toBe(true);
        if (e.code === 'delivered') expect(h >= 9 && h <= 19.5).toBe(true);
      }
    }
  });
  it('international journey uses plane then truck, with customs and a new domestic number on handoff', () => {
    const r = req('LP00512345678918', 'cn.cainiao');
    const plan = planFor(r).actual;
    expect(plan.stops.map((s) => s.kind)).toEqual(['origin', 'airport', 'airport', 'customs', 'hub', 'local', 'destination']);
    const flight = plan.segments.find((s) => s.mode === 'plane')!;
    const mid = snap(r, (flight.depart + flight.arrive) / 2);
    expect(mid.currentMode).toBe('plane');
    expect(moodFor(mid)).toBe('moving');
    const customs = plan.events.find((e) => e.code === 'customs_in')!;
    expect(snap(r, customs.time + 60e3).status).toBe('customs');
    const handover = plan.events.find((e) => e.code === 'handover')!;
    expect(snap(r, handover.time - 60e3).handoff).toBeUndefined();
    const after = snap(r, handover.time + 60e3);
    expect(after.handoff).toBeDefined();
    expect(after.handoff!.trackingNumber).not.toBe('LP00512345678918');
    expect(after.handoff!.carrierId).toMatch(/^kr\./);
    expect(after.currentMode).toBe('truck');
  });
});

describe('scenarios', () => {
  const all = [...cjNumbers(400).map((n) => [n, 'kr.cjlogistics'] as const), ...lpNumbers(200).map((n) => [n, 'cn.cainiao'] as const)];
  const scenarios = all.map(([n, c]) => ({ n, c, s: scenarioFor(n, c) }));
  it('rates are roughly 1/6 delays, 1/12 failed attempts, 1/20 pickups', () => {
    const rate = (f: (x: (typeof scenarios)[number]) => boolean) => scenarios.filter(f).length / scenarios.length;
    expect(rate((x) => !!x.s.delay)).toBeGreaterThan(0.1);
    expect(rate((x) => !!x.s.delay)).toBeLessThan(0.25);
    expect(rate((x) => x.s.attemptFail)).toBeGreaterThan(0.04);
    expect(rate((x) => x.s.attemptFail)).toBeLessThan(0.13);
    expect(rate((x) => !!x.s.pickup)).toBeGreaterThan(0.015);
    expect(rate((x) => !!x.s.pickup)).toBeLessThan(0.1);
  });
  it('delay: flagged with a reason while behind, ETA slips, a delay checkpoint explains it', () => {
    const d = scenarios.find((x) => x.s.delay && x.c === 'kr.cjlogistics')!;
    const r = req(d.n, d.c);
    const { actual } = planFor(r);
    const notice = actual.delayNoticeAt!;
    expect(notice).toBeDefined();
    const before = snap(r, notice - 60e3);
    const after = snap(r, notice + 60e3);
    expect(before.delayed).toBeFalsy();
    expect(after.delayed).toBe(true);
    expect(after.delayReason).toBe(d.s.delay);
    expect(Date.parse(after.eta!.latest)).toBeGreaterThan(Date.parse(before.eta!.latest));
    expect(checkpointCode(after.checkpoints.at(-1)!.id)).toEqual({ code: 'delay', detail: d.s.delay });
    expect(moodFor(after)).toBe('worried');
    expect(snap(r, completion(r) + H).delayed).toBeFalsy();
  });
  it('customs inspection delay is reachable for international parcels', () => {
    expect(scenarios.some((x) => x.c === 'cn.cainiao' && x.s.delay === 'customs_inspection')).toBe(true);
  });
  it('attempt failed, then redelivered the next working day', () => {
    const a = scenarios.find((x) => x.s.attemptFail)!;
    const r = req(a.n, a.c);
    const ev = planFor(r).actual.events;
    const fail = ev.find((e) => e.code === 'attempt_fail')!;
    const s = snap(r, fail.time + 60e3);
    expect(s.status).toBe('attempt_fail');
    expect(moodFor(s)).toBe('worried');
    const done = ev.at(-1)!;
    expect(done.code).toBe('delivered');
    expect(done.time - fail.time).toBeGreaterThan(8 * H);
  });
  it('pickup at a store/locker sets snapshot.pickup and is not "delivered" until collected', () => {
    const p = scenarios.find((x) => x.s.pickup)!;
    const r = req(p.n, p.c);
    const ev = planFor(r).actual.events;
    const ready = ev.find((e) => e.code === 'pickup_ready')!;
    const s = snap(r, ready.time + 60e3);
    expect(s.status).toBe('available_for_pickup');
    expect(s.pickup?.kind).toBe(p.s.pickup);
    expect(s.pickup?.place.ko).toBeTruthy();
    expect(snap(r, ev.at(-1)!.time + 60e3).status).toBe('delivered');
  });
  it('convenience-store carrier always ends at a store', () => {
    expect(scenarioFor('3612345678', 'kr.cvsnet').pickup).toBe('convenience_store');
  });
  it('ETA window narrows as delivery approaches', () => {
    const r = req('640123456136', 'kr.cjlogistics');
    const ev = planFor(r).actual.events;
    const width = (t: number) => { const e = snap(r, t).eta!; return Date.parse(e.latest) - Date.parse(e.earliest); };
    const ofd = ev.find((e) => e.code === 'out_for_delivery')!.time;
    expect(width(ofd + 60e3)).toBeLessThan(width(ev[0].time + 60e3));
    expect(width(ofd + 60e3)).toBeLessThanOrEqual(5 * H);
  });
  it('stale after a long quiet stretch (working hours only)', () => {
    const mon = new Date(2026, 9, 12, 10).getTime();
    expect(computeStale('in_transit', mon, mon + 10 * H)).toBe(false);
    expect(computeStale('in_transit', mon, mon + 30 * H)).toBe(true);
    const sat = new Date(2026, 9, 17, 20).getTime(); // Sat 20:00 → Mon 08:00: Sunday doesn't count
    expect(computeStale('in_transit', sat, new Date(2026, 9, 19, 8).getTime())).toBe(false);
    expect(computeStale('customs', mon, mon + 80 * H)).toBe(true);
  });
  it('scaffold smoke: epoch-anchored parcel has checkpoints after 10h', async () => {
    const s = await mockProvider.track({ trackingNumber: 'X', carrierId: 'kr.cjlogistics', createdAt: new Date(0).toISOString() }, new Date(10 * H));
    expect(s.checkpoints.length).toBeGreaterThan(0);
  });
});
