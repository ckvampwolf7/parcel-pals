/**
 * STORE PUBLIC API — owned by the Engine team.
 * Components import ONLY these names from '@/store'. State lives in memory, persists to localStorage
 * (`parcel-pals:v1`), polls the tracking provider while the page is visible, diffs checkpoints into
 * unread counts / inbox items / events. See docs/engine.md.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AddParcelInput, AppEvent, Checkpoint, InboxItem, Parcel, Settings } from '@/types';
import {
  autoCharacter, carrierName, checkpointLine, createSimClock, demoCreatedAt, demoParcelSeeds, detectCarriers, getCarrier,
  dummyTrackingNumber, getProviderFor, LiveTrackingError, normalizeTrackingNumber, setLiveApiKey, trackLive,
  validateTrackingNumber, type SimClock,
} from '@/engine';
import { setCurrentLocale } from '@/i18n';
import { INBOX_CAP, clearPersisted, loadPersisted, savePersisted } from './persist';
import { sortParcels } from './sort';

export { STORAGE_KEY } from './persist';
export { urgencyRank, sortParcels } from './sort';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'ko',
  defaultCharacter: 'auto',
  notifications: true,
  demoSpeed: 60,
  refreshIntervalSec: 15,
  theme: 'system',
  reduceMotion: 'system',
  onboarded: false,
  liveRefreshMin: 10,
};

/** Live lookups: never more often than this, even for manual refreshes (be kind to the free API). */
const LIVE_MIN_GAP_MS = 30_000;
/** Real "now" for a parcel: demo parcels follow the simulation clock, real parcels the wall clock. */
function nowForParcel(p: Pick<Parcel, 'demo'>): Date { return p.demo ? clock.now() : new Date(); }
/** Should a live parcel be looked up now? */
function liveDue(p: Parcel, force: boolean): boolean {
  if (p.demo) return true;
  const last = p.lastCheckedAt ? Date.parse(p.lastCheckedAt) : 0;
  const since = Date.now() - last;
  if (force) return since >= LIVE_MIN_GAP_MS;
  const s = p.snapshot;
  if (s?.liveStatus === 'unsupported') return false;
  if (s?.status === 'delivered') {
    const doneAt = Date.parse(s.checkpoints.at(-1)?.time ?? s.updatedAt);
    if (Date.now() - doneAt > 24 * 3.6e6) return false; // finished: nothing more will happen
  }
  const minutes = state.settings.liveRefreshMin ?? 10;
  return since >= minutes * 60_000;
}

/** Thrown by actions.addParcel for input that can't be a tracking number. `reason` → t(`engine.error.${reason}`). */
export class InvalidTrackingNumberError extends Error {
  constructor(public reason: 'empty' | 'too_short' | 'too_long' | 'invalid_chars') {
    super(`engine.error.${reason}`);
    this.name = 'InvalidTrackingNumberError';
  }
}

interface State {
  parcels: Parcel[];
  settings: Settings;
  inbox: InboxItem[];
}

let clock: SimClock = createSimClock({ anchorReal: Date.now(), anchorSim: Date.now(), speed: DEFAULT_SETTINGS.demoSpeed });
let state: State = { parcels: [], settings: { ...DEFAULT_SETTINGS }, inbox: [] };
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: AppEvent) => void>();
/** Parcels for which 'parcel-delivered' was already emitted (or that were delivered when first seen). */
const deliveredNotified = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const rerun = new Set<string>();

// ───────────────────────── persistence ─────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let persistenceEnabled = true;

/** Write state to localStorage now (also called on pagehide / when the tab is hidden). */
export function persistNow(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; }
  if (!persistenceEnabled) return;
  // Clock is saved re-anchored to "now": anchorReal = wall time of the save, anchorSim = sim time at the save.
  savePersisted({ version: 1, parcels: state.parcels, settings: state.settings, inbox: state.inbox,
    clock: { anchorReal: Date.now(), anchorSim: clock.now().getTime(), speed: clock.toJSON().speed } });
}
function schedulePersist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = undefined; persistNow(); }, 250);
}

function hydrate() {
  const saved = loadPersisted(DEFAULT_SETTINGS);
  if (saved) {
    state = { parcels: saved.parcels, settings: saved.settings, inbox: saved.inbox };
    // Demo speed only applies while the app is open: time spent closed counts at 1× (real time),
    // otherwise a 60× clock would jump weeks ahead overnight.
    const c = saved.clock;
    const closedMs = c ? Math.max(0, Date.now() - c.anchorReal) : 0;
    clock = createSimClock(c
      ? { anchorReal: Date.now(), anchorSim: c.anchorSim + closedMs, speed: c.speed }
      : { anchorReal: Date.now(), anchorSim: Date.now(), speed: saved.settings.demoSpeed });
    if (clock.toJSON().speed !== saved.settings.demoSpeed) clock.setSpeed(saved.settings.demoSpeed);
  } else {
    state = { parcels: [], settings: { ...DEFAULT_SETTINGS }, inbox: [] };
    clock = createSimClock({ anchorReal: Date.now(), anchorSim: Date.now(), speed: DEFAULT_SETTINGS.demoSpeed });
  }
  deliveredNotified.clear();
  for (const p of state.parcels) if (p.snapshot?.status === 'delivered') deliveredNotified.add(p.id);
  setCurrentLocale(state.settings.locale);
  setLiveApiKey(state.settings.trackerApiKey);
}
hydrate();

// ───────────────────────── state plumbing ─────────────────────────

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  schedulePersist();
  listeners.forEach((l) => l());
}
function emit(e: AppEvent) {
  eventListeners.forEach((l) => { try { l(e); } catch { /* a broken listener must not break the store */ } });
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const find = (id: string) => state.parcels.find((p) => p.id === id);

function patchParcel(id: string, patch: Partial<Parcel>) {
  let changed = false;
  const parcels = state.parcels.map((p) => {
    if (p.id !== id) return p;
    const keys = Object.keys(patch) as Array<keyof Parcel>;
    if (keys.every((k) => p[k] === patch[k])) return p;
    changed = true;
    return { ...p, ...patch };
  });
  if (changed) setState({ parcels });
}

function inboxItemsFor(parcel: Parcel, fresh: Checkpoint[]): InboxItem[] {
  return fresh.map((c) => ({
    id: `${parcel.id}:${c.id}`, parcelId: parcel.id, checkpointId: c.id, time: c.time, status: c.status, read: false,
    text: { ko: checkpointLine(parcel, c, 'ko'), en: checkpointLine(parcel, c, 'en') },
  }));
}

function addInbox(items: InboxItem[]) {
  if (!items.length) return;
  const known = new Set(state.inbox.map((i) => i.id));
  const add = items.filter((i) => !known.has(i.id));
  if (!add.length) return;
  const inbox = [...add, ...state.inbox].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, INBOX_CAP);
  setState({ inbox });
}

async function doRefresh(id: string): Promise<void> {
  const p = find(id);
  if (!p) return;
  patchParcel(id, { refreshing: true });
  let snap;
  const checkedAt = new Date().toISOString();
  try {
    snap = await getProviderFor(p).track({ trackingNumber: p.trackingNumber, carrierId: p.carrierId, createdAt: p.createdAt, demo: p.demo }, nowForParcel(p));
  } catch (err) {
    const key = err instanceof LiveTrackingError ? `engine.error.live.${err.kind}` : 'engine.error.refresh';
    if (find(id)) patchParcel(id, { refreshing: false, error: key, ...(p.demo ? {} : { lastCheckedAt: checkedAt }) });
    emit({ type: 'error', message: key });
    return;
  }
  const cur = find(id);
  if (!cur) return; // removed while in flight
  const first = !cur.snapshot;
  const known = new Set(cur.snapshot?.checkpoints.map((c) => c.id));
  const fresh = first ? [] : snap.checkpoints.filter((c) => !known.has(c.id));
  const updated: Parcel = { ...cur, snapshot: snap, unread: cur.unread + fresh.length, error: undefined, refreshing: false, ...(cur.demo ? {} : { lastCheckedAt: checkedAt }) };
  setState({ parcels: state.parcels.map((x) => (x.id === id ? updated : x)) });
  if (first && snap.status === 'delivered') deliveredNotified.add(id);
  if (fresh.length) {
    addInbox(inboxItemsFor(updated, fresh));
    emit({ type: 'parcel-updated', parcel: updated, newCheckpoints: fresh });
    if (fresh.some((c) => c.status === 'delivered') && !deliveredNotified.has(id)) {
      deliveredNotified.add(id);
      emit({ type: 'parcel-delivered', parcel: updated });
    }
  }
}

/** One refresh per parcel at a time; a call during a refresh schedules exactly one follow-up run. */
function refreshOne(id: string): Promise<void> {
  const running = inflight.get(id);
  if (running) { rerun.add(id); return running; }
  const run = (async () => {
    await null; // never finish synchronously: `finally` must run after `inflight.set` below
    try {
      do { rerun.delete(id); await doRefresh(id); } while (rerun.has(id) && find(id));
    } finally {
      inflight.delete(id);
      rerun.delete(id);
    }
  })();
  inflight.set(id, run);
  return run;
}

let allRun: Promise<void> | null = null;
let allAgain = false;
let allForce = false;
/** Refresh due parcels one at a time. `force` = user asked (live parcels still keep a 30 s gap). `only` filters. */
function refreshAllSequential(force = false, only?: (p: Parcel) => boolean): Promise<void> {
  if (force) allForce = true;
  if (allRun) { allAgain = true; return allRun; }
  allRun = (async () => {
    await null; // never finish synchronously: `finally` must run after the assignment
    try {
      do {
        allAgain = false;
        const f = allForce; allForce = false;
        for (const p of state.parcels.filter((x) => !x.archived && (!only || only(x)))) {
          const cur = find(p.id);
          if (cur && liveDue(cur, f)) await refreshOne(p.id);
        }
      } while (allAgain);
    } finally {
      allRun = null;
    }
  })();
  return allRun;
}

/** Parcel with the same tracking number (normalized), if already added. Use it to tell the user "already added". */
export function findByTrackingNumber(trackingNumber: string): Parcel | undefined {
  const n = normalizeTrackingNumber(trackingNumber);
  return n ? state.parcels.find((p) => p.trackingNumber === n) : undefined;
}

// ───────────────────────── actions ─────────────────────────

export const actions = {
  /**
   * Add a parcel and fetch its first snapshot. Throws InvalidTrackingNumberError for invalid input.
   * DUPLICATES: if the (normalized) number is already tracked, the existing parcel is returned (un-archived)
   * and nothing is created — check `findByTrackingNumber()` first if the UI wants to say so.
   */
  async addParcel(input: AddParcelInput, opts?: { /** internal/tests: simulated parcel on the demo clock */ demo?: boolean }): Promise<Parcel> {
    const v = validateTrackingNumber(input.trackingNumber);
    if (!v.ok) throw new InvalidTrackingNumberError(v.reason);
    const trackingNumber = normalizeTrackingNumber(input.trackingNumber);
    const existing = findByTrackingNumber(trackingNumber);
    if (existing) {
      if (existing.archived) patchParcel(existing.id, { archived: false });
      return find(existing.id)!;
    }
    const carrierId = (input.carrierId && getCarrier(input.carrierId) ? input.carrierId : undefined)
      ?? detectCarriers(trackingNumber)[0]?.carrier.id ?? 'kr.cjlogistics';
    const def = state.settings.defaultCharacter;
    const locale = state.settings.locale;
    const parcel: Parcel = {
      id: uid(), trackingNumber, carrierId,
      nickname: input.nickname?.trim() || `${carrierName(carrierId, locale)} ${trackingNumber.slice(-4)}`,
      character: input.character ?? (def === 'auto' ? autoCharacter(getCarrier(carrierId)) : def),
      createdAt: (opts?.demo ? clock.now() : new Date()).toISOString(), archived: false, snapshot: null, unread: 0,
      ...(opts?.demo ? { demo: true } : {}),
    };
    setState({ parcels: [parcel, ...state.parcels] });
    await refreshOne(parcel.id);
    const added = find(parcel.id) ?? parcel;
    emit({ type: 'parcel-added', parcel: added });
    return added;
  },
  removeParcel(id: string) {
    if (!find(id)) return;
    setState({ parcels: state.parcels.filter((p) => p.id !== id), inbox: state.inbox.filter((i) => i.parcelId !== id) });
    deliveredNotified.delete(id);
    emit({ type: 'parcel-removed', parcelId: id });
  },
  updateParcel(id: string, patch: Partial<Pick<Parcel, 'nickname' | 'character' | 'archived'>>) {
    const clean = { ...patch };
    if (clean.nickname !== undefined) {
      const nn = clean.nickname.trim();
      if (nn) clean.nickname = nn; else delete clean.nickname;
    }
    patchParcel(id, clean);
  },
  /** Switch a parcel to another carrier (wrong guess) and look it up again from scratch. */
  async changeCarrier(id: string, carrierId: string) {
    const p = find(id);
    if (!p || !getCarrier(carrierId) || p.carrierId === carrierId) return;
    setState({
      parcels: state.parcels.map((x) => (x.id === id ? { ...x, carrierId, snapshot: null, error: undefined, lastCheckedAt: undefined, unread: 0, lastSeenCheckpointId: undefined } : x)),
      inbox: state.inbox.filter((i) => i.parcelId !== id),
    });
    await refreshOne(id);
  },
  /** User-requested refresh of one parcel (live parcels: at most every 30 s). */
  async refresh(id: string) {
    const p = find(id);
    if (p && !liveDue(p, true)) return;
    await refreshOne(id);
  },
  /** User-requested refresh of every non-archived parcel, one at a time. Concurrent calls coalesce. */
  async refreshAll() { await refreshAllSequential(true); },
  /**
   * Add a parcel with tracker.delivery's test carrier (a fresh number that is really "in transit" on their
   * servers). Lets the user check that live tracking works without a real tracking number.
   */
  async addTestParcel(): Promise<Parcel> {
    const trackingNumber = dummyTrackingNumber();
    const existing = state.parcels.find((p) => p.carrierId === 'dev.track.dummy' && p.trackingNumber === trackingNumber);
    if (existing) return existing;
    const parcel: Parcel = {
      id: uid(), trackingNumber, carrierId: 'dev.track.dummy',
      nickname: state.settings.locale === 'ko' ? '연결 테스트 택배' : 'Connection test parcel',
      character: 'bunny', createdAt: new Date().toISOString(), archived: false, snapshot: null, unread: 0,
    };
    setState({ parcels: [parcel, ...state.parcels] });
    await refreshOne(parcel.id);
    const added = find(parcel.id) ?? parcel;
    emit({ type: 'parcel-added', parcel: added });
    return added;
  },
  /** Check that the live tracking service answers (uses the test carrier). Resolves 'ok' or an error kind. */
  async testLiveConnection(): Promise<'ok' | LiveTrackingError['kind']> {
    try {
      const s = await trackLive({ carrierId: 'dev.track.dummy', trackingNumber: dummyTrackingNumber() }, { apiKey: state.settings.trackerApiKey });
      return s.liveStatus === 'ok' || s.liveStatus === 'not_found' ? 'ok' : 'server';
    } catch (e) {
      return e instanceof LiveTrackingError ? e.kind : 'network';
    }
  },
  /** Detail screen opened: clear unread for this parcel (no-op when nothing changes). */
  markSeen(id: string) {
    const p = find(id);
    if (!p) return;
    const lastId = p.snapshot?.checkpoints.at(-1)?.id;
    if (p.unread !== 0 || p.lastSeenCheckpointId !== lastId) patchParcel(id, { unread: 0, lastSeenCheckpointId: lastId });
    if (state.inbox.some((i) => i.parcelId === id && !i.read)) {
      setState({ inbox: state.inbox.map((i) => (i.parcelId === id && !i.read ? { ...i, read: true } : i)) });
    }
  },
  /** Mark inbox items read (all when `ids` omitted). Parcel unread counts drop accordingly. */
  markInboxRead(ids?: string[]) {
    const set = ids ? new Set(ids) : undefined;
    const perParcel = new Map<string, number>();
    const inbox = state.inbox.map((i) => {
      if (i.read || (set && !set.has(i.id))) return i;
      perParcel.set(i.parcelId, (perParcel.get(i.parcelId) ?? 0) + 1);
      return { ...i, read: true };
    });
    if (!perParcel.size) return;
    const parcels = state.parcels.map((p) => {
      const n = perParcel.get(p.id);
      return n ? { ...p, unread: Math.max(0, p.unread - n) } : p;
    });
    setState({ inbox, parcels });
  },
  clearInbox() { if (state.inbox.length) setState({ inbox: [] }); },
  updateSettings(patch: Partial<Settings>) {
    const next = { ...state.settings, ...patch };
    if (patch.demoSpeed !== undefined && patch.demoSpeed !== state.settings.demoSpeed) {
      if (!(Number.isFinite(patch.demoSpeed) && patch.demoSpeed > 0)) next.demoSpeed = state.settings.demoSpeed;
      else clock.setSpeed(patch.demoSpeed);
    }
    if (patch.refreshIntervalSec !== undefined && !(patch.refreshIntervalSec >= 2)) next.refreshIntervalSec = state.settings.refreshIntervalSec;
    if (patch.locale && patch.locale !== state.settings.locale) setCurrentLocale(patch.locale);
    if (patch.liveRefreshMin !== undefined && !(patch.liveRefreshMin >= 1)) next.liveRefreshMin = state.settings.liveRefreshMin;
    if (patch.trackerApiKey !== undefined) { next.trackerApiKey = patch.trackerApiKey.trim() || undefined; setLiveApiKey(next.trackerApiKey); }
    setState({ settings: next });
    if (patch.refreshIntervalSec !== undefined) reschedulePolling();
  },
  /** Add the sample parcels (each placed at a nice moment of its story). Calling twice adds nothing new. */
  async loadDemo() {
    const now = clock.now();
    const added: Parcel[] = [];
    for (const s of demoParcelSeeds()) {
      if (findByTrackingNumber(s.trackingNumber)) continue;
      added.push({
        id: uid(), trackingNumber: s.trackingNumber, carrierId: s.carrierId, nickname: s.nickname[state.settings.locale],
        character: s.character, createdAt: demoCreatedAt(s, now), archived: false, snapshot: null, unread: 0, demo: true,
      });
    }
    if (!added.length) return;
    setState({ parcels: [...state.parcels, ...added] });
    for (const p of added) {
      await refreshOne(p.id);
      // Give each demo parcel one "new" update so badges and the inbox aren't empty.
      const cur = find(p.id);
      const last = cur?.snapshot?.checkpoints.at(-1);
      if (cur && last && cur.snapshot?.status !== 'delivered') {
        patchParcel(p.id, { unread: 1 });
        addInbox(inboxItemsFor(cur, [last]));
      }
    }
  },
  /** Jump the simulation clock forward (demo control) and refresh everything. */
  async fastForward(hours: number) {
    clock.advance(hours);
    schedulePersist();
    await refreshAllSequential(true, (p) => !!p.demo); // only demo parcels live on the simulation clock
  },
  /** Wipe everything (parcels, inbox, settings, clock) and clear storage. */
  resetAll() {
    clearPersisted();
    clock = createSimClock({ anchorReal: Date.now(), anchorSim: Date.now(), speed: DEFAULT_SETTINGS.demoSpeed });
    deliveredNotified.clear();
    rerun.clear();
    setCurrentLocale(DEFAULT_SETTINGS.locale);
    setState({ parcels: [], inbox: [], settings: { ...DEFAULT_SETTINGS } });
    reschedulePolling();
  },
};

// ───────────────────────── subscriptions & hooks ─────────────────────────

/** Subscribe to app events (toasts, browser notifications). Returns unsubscribe. */
export function subscribe(listener: (e: AppEvent) => void): () => void {
  eventListeners.add(listener);
  return () => { eventListeners.delete(listener); };
}

/** Subscribe to any state change (non-React consumers). Returns unsubscribe. */
export function subscribeState(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribeState, () => select(state), () => select(state));
}

// memoized derived lists (stable references while parcels are unchanged)
let sortedFor: Parcel[] | null = null;
let sortedAll: Parcel[] = [];
let sortedActive: Parcel[] = [];
function selectSorted(s: State, includeArchived: boolean): Parcel[] {
  if (sortedFor !== s.parcels) {
    sortedFor = s.parcels;
    sortedAll = sortParcels(s.parcels);
    sortedActive = sortedAll.filter((p) => !p.archived);
  }
  return includeArchived ? sortedAll : sortedActive;
}

/** Parcels in display order (urgency: out for delivery > problems > pickup > in transit by ETA > pending > delivered; archived last). */
export function useParcels(opts?: { includeArchived?: boolean }): Parcel[] {
  const inc = !!opts?.includeArchived;
  return useStore((s) => selectSorted(s, inc));
}
export function useParcel(id: string): Parcel | undefined {
  return useStore((s) => s.parcels.find((p) => p.id === id));
}
export function useSettings(): Settings { return useStore((s) => s.settings); }
/** Inbox items, newest first (max 200). */
export function useInbox(): InboxItem[] { return useStore((s) => s.inbox); }
/** Number of unread inbox items (for the tab badge). */
export function useUnreadCount(): number { return useStore((s) => s.inbox.reduce((n, i) => n + (i.read ? 0 : 1), 0)); }

/** Non-hook snapshot access (tests, PWA notifications). */
export function getParcels(): Parcel[] { return selectSorted(state, true); }
export function getParcel(id: string): Parcel | undefined { return find(id); }
export function getSettings(): Settings { return state.settings; }
export function getInbox(): InboxItem[] { return state.inbox; }

/** Current simulation time, re-rendering every `intervalMs` (for countdowns / relative times). */
export function useSimNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const tick = () => setNow(clock.now());
    const t = setInterval(tick, intervalMs);
    // Also re-read the clock whenever store state changes (refresh, fast-forward, speed change),
    // so "now" is never older than freshly loaded snapshot times (avoids "updated in 6 h" style glitches).
    listeners.add(tick);
    return () => { clearInterval(t); listeners.delete(tick); };
  }, [intervalMs]);
  return now;
}
/** Non-hook access to sim time. */
export function simNow(): Date { return clock.now(); }

export interface Clocks { sim: Date; real: Date }
/** Both clocks, re-rendering every `intervalMs` and on every store change. Pair with `nowFor(parcel, clocks)`. */
export function useClocks(intervalMs = 1000): Clocks {
  const read = (): Clocks => ({ sim: clock.now(), real: new Date() });
  const [clocks, setClocks] = useState(read);
  useEffect(() => {
    const tick = () => setClocks(read());
    const t = setInterval(tick, intervalMs);
    listeners.add(tick);
    return () => { clearInterval(t); listeners.delete(tick); };
  }, [intervalMs]);
  return clocks;
}
/** The "now" that applies to a parcel: simulation time for demo parcels, wall-clock time for real ones. */
export function nowFor(p: Pick<Parcel, 'demo'> | undefined, clocks: Clocks): Date {
  return p?.demo ? clocks.sim : clocks.real;
}
/** Hook form of nowFor for screens about one parcel. */
export function useNowFor(p: Pick<Parcel, 'demo'> | undefined, intervalMs = 1000): Date {
  return nowFor(p, useClocks(intervalMs));
}

// ───────────────────────── polling ─────────────────────────

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let lastWake = 0;
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!started) return;
  pollTimer = setTimeout(async () => {
    pollTimer = undefined;
    if (!isHidden()) await refreshAllSequential(false);
    schedulePoll();
  }, Math.max(2, state.settings.refreshIntervalSec) * 1000);
}
function reschedulePolling() { if (started) schedulePoll(); }

function onWake() {
  if (isHidden()) { persistNow(); return; }
  const t = Date.now();
  if (t - lastWake < 1500) return; // focus + visibilitychange fire together
  lastWake = t;
  void refreshAllSequential(false);
  schedulePoll();
}
const onPageHide = () => persistNow();

/** Start background work (polling every settings.refreshIntervalSec while visible). Called once from main.tsx. Returns stop(). */
export function startStore(): () => void {
  const stop = () => {
    started = false;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = undefined;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pagehide', onPageHide);
    }
  };
  if (started) return stop;
  started = true;
  setCurrentLocale(state.settings.locale);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWake);
    window.addEventListener('pagehide', onPageHide);
  }
  lastWake = Date.now();
  void refreshAllSequential(false);
  schedulePoll();
  return stop;
}

/** Effective reduced-motion flag (settings + OS). */
export function useReducedMotion(): boolean {
  const { reduceMotion } = useSettings();
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setOs(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduceMotion === 'on' || (reduceMotion === 'system' && os);
}

/** TEST-ONLY hooks (not for app code). */
export const __storeTest = {
  hydrate,
  persistNow,
  getState: () => state,
  setClock(c: SimClock) { clock = c; },
  getClock: () => clock,
  setPersistence(on: boolean) { persistenceEnabled = on; },
};
