import { act, renderHook } from '@testing-library/react';
import {
  InvalidTrackingNumberError, STORAGE_KEY, __storeTest, actions, findByTrackingNumber, getInbox, getParcels, getSettings,
  subscribe, useParcels,
} from '@/store';
import { createSimClock, getProvider, mockProvider, setProvider, type TrackingProvider } from '@/engine';
import { parsePersisted } from './persist';
import type { AppEvent } from '@/types';

const H = 3.6e6;
const T0 = new Date(2026, 9, 13, 10, 0).getTime(); // Tue 10:00 local
/** Frozen sim clock: time only moves via fastForward. */
function freezeClock(at = T0) {
  __storeTest.setClock(createSimClock({ anchorReal: 0, anchorSim: at, speed: 1 }, () => 0));
}

beforeEach(() => {
  localStorage.clear();
  actions.resetAll();
  freezeClock();
  setProvider(undefined);
});

describe('adding parcels', () => {
  it('adds with normalized number, detected carrier, auto character and a first snapshot', async () => {
    const p = await actions.addParcel({ trackingNumber: '6401-2345-6136' });
    expect(p.trackingNumber).toBe('640123456136');
    expect(p.carrierId).toBe('kr.cjlogistics');
    expect(p.character).toBe('truck');
    expect(p.snapshot?.status).toBe('pending');
    expect(p.nickname).toContain('6136');
    const intl = await actions.addParcel({ trackingNumber: 'LP00512345678918', nickname: '키보드' });
    expect(intl.character).toBe('plane');
    expect(intl.nickname).toBe('키보드');
  });
  it('rejects invalid input', async () => {
    await expect(actions.addParcel({ trackingNumber: '12' })).rejects.toBeInstanceOf(InvalidTrackingNumberError);
    await expect(actions.addParcel({ trackingNumber: '' })).rejects.toMatchObject({ reason: 'empty' });
  });
  it('duplicate tracking number returns the existing parcel (also un-archives it)', async () => {
    const a = await actions.addParcel({ trackingNumber: '640123456136' });
    actions.updateParcel(a.id, { archived: true });
    const b = await actions.addParcel({ trackingNumber: '6401 2345 6136', nickname: 'other' });
    expect(b.id).toBe(a.id);
    expect(b.archived).toBe(false);
    expect(getParcels()).toHaveLength(1);
    expect(findByTrackingNumber('640-123-456-136')?.id).toBe(a.id);
    expect(findByTrackingNumber('999999999999')).toBeUndefined();
  });
});

describe('refresh diffing → unread, inbox, events', () => {
  it('new checkpoints become unread + inbox items; events once per refresh; delivered once', async () => {
    const events: AppEvent[] = [];
    const off = subscribe((e) => events.push(e));
    const p = await actions.addParcel({ trackingNumber: '640123456136', character: 'bunny' });
    expect(events.map((e) => e.type)).toEqual(['parcel-added']);
    await actions.fastForward(3);
    let cur = getParcels()[0];
    const n1 = cur.snapshot!.checkpoints.length;
    expect(n1).toBeGreaterThan(0);
    expect(cur.unread).toBe(n1);
    expect(getInbox()).toHaveLength(n1);
    expect(getInbox()[0].text.ko.length).toBeGreaterThan(3);
    expect(getInbox()[0].text.en.length).toBeGreaterThan(3);
    const updates = events.filter((e) => e.type === 'parcel-updated');
    expect(updates).toHaveLength(1);
    expect(updates[0].type === 'parcel-updated' && updates[0].newCheckpoints).toHaveLength(n1);
    // refreshing again without time passing adds nothing
    await actions.refreshAll();
    expect(events.filter((e) => e.type === 'parcel-updated')).toHaveLength(1);
    // jump to the end: delivered exactly once, inbox has no duplicates
    await actions.fastForward(24 * 6);
    await actions.fastForward(24);
    cur = getParcels()[0];
    expect(cur.snapshot!.status).toBe('delivered');
    expect(events.filter((e) => e.type === 'parcel-delivered')).toHaveLength(1);
    const ids = getInbox().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getInbox()).toHaveLength(cur.snapshot!.checkpoints.length);
    expect(cur.unread).toBe(cur.snapshot!.checkpoints.length);
    // inbox is newest first
    const times = getInbox().map((i) => Date.parse(i.time));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    actions.markSeen(p.id);
    expect(getParcels()[0].unread).toBe(0);
    expect(getInbox().every((i) => i.read)).toBe(true);
    off();
  });
  it('markInboxRead lowers parcel unread counts', async () => {
    await actions.addParcel({ trackingNumber: '640123456136' });
    await actions.fastForward(30);
    const before = getParcels()[0].unread;
    actions.markInboxRead([getInbox()[0].id]);
    expect(getParcels()[0].unread).toBe(before - 1);
    actions.markInboxRead();
    expect(getParcels()[0].unread).toBe(0);
  });
  it('never runs overlapping refreshes for one parcel', async () => {
    let running = 0;
    let maxRunning = 0;
    const slow: TrackingProvider = {
      id: 'slow',
      async track(req, now) {
        running++; maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return mockProvider.track(req, now);
      },
    };
    await actions.addParcel({ trackingNumber: '640123456136' });
    setProvider(slow);
    expect(getProvider().id).toBe('slow');
    await Promise.all([actions.refreshAll(), actions.refreshAll(), actions.refresh(getParcels()[0].id), actions.fastForward(5)]);
    expect(maxRunning).toBe(1);
    expect(getParcels()[0].refreshing).toBe(false);
    // the coalesced follow-up saw the fast-forwarded time
    expect(getParcels()[0].snapshot!.updatedAt).toBe(new Date(T0 + 5 * H).toISOString());
  });
  it('refreshAll with no parcels does not wedge later refreshes (regression)', async () => {
    await actions.refreshAll();
    await actions.addParcel({ trackingNumber: '640123456136' });
    await actions.fastForward(10);
    expect(getParcels()[0].snapshot!.updatedAt).toBe(new Date(T0 + 10 * H).toISOString());
    await actions.refresh('missing-id');
    await actions.refresh('missing-id');
  });
  it('provider errors set parcel.error and emit an error event', async () => {
    await actions.addParcel({ trackingNumber: '640123456136' });
    const events: AppEvent[] = [];
    const off = subscribe((e) => events.push(e));
    setProvider({ id: 'broken', track: async () => { throw new Error('boom'); } });
    await actions.refreshAll();
    expect(getParcels()[0].error).toBe('engine.error.refresh');
    expect(events.some((e) => e.type === 'error')).toBe(true);
    off();
  });
});

describe('demo', () => {
  it('loads 4 demo parcels with stories, once', async () => {
    await actions.loadDemo();
    await actions.loadDemo();
    const ps = getParcels();
    expect(ps).toHaveLength(4);
    expect(ps.every((p) => p.demo && p.snapshot)).toBe(true);
    expect(ps.map((p) => p.character).sort()).toEqual(['bunny', 'plane', 'truck', 'truck']);
    expect(ps.some((p) => p.snapshot!.status === 'delivered')).toBe(true);
    expect(getInbox().length).toBeGreaterThan(0);
    expect(ps[ps.length - 1].snapshot!.status).toBe('delivered'); // delivered sorts last
  });
});

describe('sorting & hook stability', () => {
  it('orders by urgency and keeps a stable array reference while nothing changes', async () => {
    await actions.loadDemo();
    const { result, rerender } = renderHook(() => useParcels());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    const statuses = first.map((p) => p.snapshot!.status);
    expect(statuses.indexOf('delivered')).toBe(statuses.length - 1);
    await act(async () => { await actions.fastForward(1); });
    expect(result.current).not.toBe(first);
    const p = first[0];
    act(() => actions.updateParcel(p.id, { archived: true }));
    expect(result.current.find((x) => x.id === p.id)).toBeUndefined();
    expect(getParcels().at(-1)!.id).toBe(p.id);
  });
});

describe('persistence', () => {
  it('round-trips parcels, settings, inbox and sim clock through localStorage', async () => {
    await actions.addParcel({ trackingNumber: '640123456136', nickname: '운동화' });
    await actions.fastForward(10);
    actions.updateSettings({ locale: 'en', demoSpeed: 120 });
    __storeTest.persistNow();
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(1);
    expect(raw.parcels[0].refreshing).toBeUndefined();
    const before = { parcels: getParcels(), inbox: getInbox() };
    __storeTest.hydrate();
    expect(getParcels().map((p) => p.id)).toEqual(before.parcels.map((p) => p.id));
    expect(getParcels()[0].nickname).toBe('운동화');
    expect(getParcels()[0].snapshot).toEqual(before.parcels[0].snapshot);
    expect(getInbox()).toEqual(before.inbox);
    expect(getSettings()).toMatchObject({ locale: 'en', demoSpeed: 120 });
    expect(__storeTest.getClock().toJSON().speed).toBe(120);
    expect(document.documentElement.lang).toBe('en');
  });
  it('corrupted storage resets gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    __storeTest.hydrate();
    expect(getParcels()).toEqual([]);
    expect(getSettings().demoSpeed).toBe(60);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('future versions are not guessed at; malformed entries are dropped field by field', () => {
    expect(parsePersisted(JSON.stringify({ version: 99, parcels: [] }), getSettings())).toBeNull();
    const parsed = parsePersisted(JSON.stringify({
      parcels: [{ id: 'a', trackingNumber: '640123456136', carrierId: 'kr.cjlogistics', character: 'dragon', unread: -3, snapshot: { nope: 1 }, refreshing: true }, { id: 5 }, null],
      settings: { locale: 'fr', demoSpeed: -1, theme: 'dark' },
      inbox: [{ id: 'x' }],
      clock: { anchorReal: 'a' },
    }), { ...getSettings() })!;
    expect(parsed.parcels).toHaveLength(1);
    expect(parsed.parcels[0]).toMatchObject({ character: 'truck', unread: 0, snapshot: null, archived: false });
    expect(parsed.parcels[0].refreshing).toBeUndefined();
    expect(parsed.settings).toMatchObject({ locale: 'ko', demoSpeed: 60, theme: 'dark' });
    expect(parsed.inbox).toEqual([]);
    expect(parsed.clock).toBeUndefined();
  });
  it('inbox is capped at 200', async () => {
    for (let i = 0; i < 30; i++) await actions.addParcel({ trackingNumber: `LP${String(10000000000000 + i * 104729).padStart(14, '0')}` });
    await actions.fastForward(24 * 12);
    expect(getInbox().length).toBeLessThanOrEqual(200);
    __storeTest.persistNow();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).inbox.length).toBeLessThanOrEqual(200);
  });
  it('resetAll clears storage and state', async () => {
    await actions.addParcel({ trackingNumber: '640123456136' });
    __storeTest.persistNow();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    actions.resetAll();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getParcels()).toEqual([]);
  });
});

describe('settings side effects', () => {
  it('demo speed changes the clock without jumping; invalid values are ignored', () => {
    let real = 1000;
    __storeTest.setClock(createSimClock({ anchorReal: real, anchorSim: T0, speed: 60 }, () => real));
    real += 1000; // 1 s real at 60× = 1 sim minute
    expect(__storeTest.getClock().now().getTime()).toBe(T0 + 60e3);
    actions.updateSettings({ demoSpeed: 600 });
    expect(__storeTest.getClock().now().getTime()).toBe(T0 + 60e3);
    real += 1000;
    expect(__storeTest.getClock().now().getTime()).toBe(T0 + 60e3 + 600e3);
    actions.updateSettings({ demoSpeed: -5 });
    expect(getSettings().demoSpeed).toBe(600);
  });
});
