/**
 * STORE PUBLIC API — owned by the Engine team.
 * Components import ONLY these names from '@/store'. Keep names/signatures; rewrite internals freely
 * (persistence, polling, diffing, events). The body below is a LEAD STUB that already works end-to-end.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AddParcelInput, AppEvent, InboxItem, Parcel, Settings } from '@/types';
import {
  autoCharacter, checkpointLine, createSimClock, demoParcelSeeds, detectCarriers, getCarrier, getProvider,
  normalizeTrackingNumber, type SimClock,
} from '@/engine';
import { setCurrentLocale } from '@/i18n';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'ko',
  defaultCharacter: 'auto',
  notifications: true,
  demoSpeed: 60,
  refreshIntervalSec: 15,
  theme: 'system',
  reduceMotion: 'system',
  onboarded: false,
};

interface State {
  parcels: Parcel[];
  settings: Settings;
  inbox: InboxItem[];
}

let clock: SimClock = createSimClock({ anchorReal: Date.now(), anchorSim: Date.now(), speed: DEFAULT_SETTINGS.demoSpeed });
let state: State = { parcels: [], settings: { ...DEFAULT_SETTINGS }, inbox: [] };
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: AppEvent) => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
function emit(e: AppEvent) { eventListeners.forEach((l) => l(e)); }
const uid = () => Math.random().toString(36).slice(2, 10);

function patchParcel(id: string, patch: Partial<Parcel>) {
  setState({ parcels: state.parcels.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

async function refreshOne(id: string) {
  const p = state.parcels.find((x) => x.id === id);
  if (!p) return;
  const snap = await getProvider().track({ trackingNumber: p.trackingNumber, carrierId: p.carrierId, createdAt: p.createdAt, demo: p.demo }, clock.now());
  const known = new Set(p.snapshot?.checkpoints.map((c) => c.id));
  const fresh = p.snapshot ? snap.checkpoints.filter((c) => !known.has(c.id)) : [];
  const updated: Parcel = { ...p, snapshot: snap, unread: p.unread + fresh.length, error: undefined };
  patchParcel(id, updated);
  if (fresh.length) {
    const items: InboxItem[] = fresh.map((c) => ({
      id: uid(), parcelId: id, checkpointId: c.id, time: c.time, status: c.status, read: false,
      text: { ko: checkpointLine(updated, c, 'ko'), en: checkpointLine(updated, c, 'en') },
    }));
    setState({ inbox: [...items.reverse(), ...state.inbox] });
    emit({ type: 'parcel-updated', parcel: updated, newCheckpoints: fresh });
    if (snap.status === 'delivered' && p.snapshot?.status !== 'delivered') emit({ type: 'parcel-delivered', parcel: updated });
  }
}

// ───────────────────────── actions ─────────────────────────

export const actions = {
  async addParcel(input: AddParcelInput): Promise<Parcel> {
    const trackingNumber = normalizeTrackingNumber(input.trackingNumber);
    const carrierId = input.carrierId ?? detectCarriers(trackingNumber)[0]?.carrier.id ?? 'kr.cjlogistics';
    const def = state.settings.defaultCharacter;
    const parcel: Parcel = {
      id: uid(), trackingNumber, carrierId,
      nickname: input.nickname?.trim() || trackingNumber,
      character: input.character ?? (def === 'auto' ? autoCharacter(getCarrier(carrierId)) : def),
      createdAt: clock.now().toISOString(), archived: false, snapshot: null, unread: 0,
    };
    setState({ parcels: [parcel, ...state.parcels] });
    await refreshOne(parcel.id);
    const added = state.parcels.find((p) => p.id === parcel.id)!;
    emit({ type: 'parcel-added', parcel: added });
    return added;
  },
  removeParcel(id: string) {
    setState({ parcels: state.parcels.filter((p) => p.id !== id), inbox: state.inbox.filter((i) => i.parcelId !== id) });
    emit({ type: 'parcel-removed', parcelId: id });
  },
  updateParcel(id: string, patch: Partial<Pick<Parcel, 'nickname' | 'character' | 'archived'>>) { patchParcel(id, patch); },
  async refresh(id: string) { await refreshOne(id); },
  async refreshAll() { await Promise.all(state.parcels.filter((p) => !p.archived).map((p) => refreshOne(p.id))); },
  /** Detail screen opened: clear unread for this parcel. */
  markSeen(id: string) {
    const p = state.parcels.find((x) => x.id === id);
    if (!p) return;
    patchParcel(id, { unread: 0, lastSeenCheckpointId: p.snapshot?.checkpoints.at(-1)?.id });
    setState({ inbox: state.inbox.map((i) => (i.parcelId === id ? { ...i, read: true } : i)) });
  },
  markInboxRead(ids?: string[]) {
    setState({ inbox: state.inbox.map((i) => (!ids || ids.includes(i.id) ? { ...i, read: true } : i)) });
  },
  clearInbox() { setState({ inbox: [] }); },
  updateSettings(patch: Partial<Settings>) {
    if (patch.demoSpeed !== undefined) clock.setSpeed(patch.demoSpeed);
    if (patch.locale) setCurrentLocale(patch.locale);
    setState({ settings: { ...state.settings, ...patch } });
  },
  /** Add the sample parcels (mid-journey). */
  async loadDemo() {
    for (const s of demoParcelSeeds()) {
      const createdAt = new Date(clock.now().getTime() - s.hoursAgo * 3.6e6).toISOString();
      const p: Parcel = {
        id: uid(), trackingNumber: s.trackingNumber, carrierId: s.carrierId, nickname: s.nickname[state.settings.locale],
        character: s.character, createdAt, archived: false, snapshot: null, unread: 0, demo: true,
      };
      setState({ parcels: [...state.parcels, p] });
      await refreshOne(p.id);
    }
  },
  /** Jump the simulation clock forward (demo control) and refresh everything. */
  async fastForward(hours: number) { clock.advance(hours); await actions.refreshAll(); },
  resetAll() {
    clock = createSimClock({ anchorReal: Date.now(), anchorSim: Date.now(), speed: DEFAULT_SETTINGS.demoSpeed });
    setState({ parcels: [], inbox: [], settings: { ...DEFAULT_SETTINGS } });
  },
};

// ───────────────────────── subscriptions & hooks ─────────────────────────

/** Subscribe to app events (toasts, browser notifications). Returns unsubscribe. */
export function subscribe(listener: (e: AppEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => select(state), () => select(state));
}

/** Active parcels (archived excluded unless asked), in display order. */
export function useParcels(opts?: { includeArchived?: boolean }): Parcel[] {
  const parcels = useStore((s) => s.parcels);
  return opts?.includeArchived ? parcels : parcels.filter((p) => !p.archived);
}
export function useParcel(id: string): Parcel | undefined {
  return useStore((s) => s.parcels.find((p) => p.id === id));
}
export function useSettings(): Settings { return useStore((s) => s.settings); }
export function useInbox(): InboxItem[] { return useStore((s) => s.inbox); }

/** Current simulation time, re-rendering every `intervalMs` (for countdowns / relative times). */
export function useSimNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => { const t = setInterval(() => setNow(clock.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
/** Non-hook access to sim time. */
export function simNow(): Date { return clock.now(); }

/** Start background work (polling). Called once from main.tsx. Returns stop(). */
export function startStore(): () => void {
  const timer = setInterval(() => { void actions.refreshAll(); }, state.settings.refreshIntervalSec * 1000);
  return () => clearInterval(timer);
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
