/**
 * Cloud sync: keeps the parcel list the same on every device that shares a sync key.
 *
 *  - The key is a long random secret created on the first device; other devices join by opening a link/QR
 *    (#/link/<key>). Whoever has the key can see the parcels, so it is shown only in Settings.
 *  - Sync metadata lives under its own storage key (not in the app state): key, pull cursor, versions last
 *    exchanged with the server (`known`) and deletions not yet confirmed (`tombstones`).
 *  - Runs on start, when the app comes back to the foreground, every few minutes while visible, and shortly after
 *    local changes. One request per round (push changes + pull news); see merge.ts for the rules.
 */
import { useSyncExternalStore } from 'react';
import { actions, getParcels, subscribeState } from '@/store';
import { SyncError, syncRound } from './api';
import { changesToPush, isValidSyncKey, mergeRows, newSyncKey, syncable, versionKey } from './merge';

export { newSyncKey, parseSyncKey, isValidSyncKey } from './merge';

const STORAGE = 'parcel-pals:sync';
const PERIOD_MS = 5 * 60_000;
const DEBOUNCE_MS = 2500;

export interface SyncMeta {
  key?: string;
  cursor: string | null;
  known: Record<string, string>;
  tombstones: Record<string, string>;
  lastSyncAt?: string;
  /** 'network' | 'server' | 'key' while the last attempt failed */
  error?: string;
  /** endpoint of this device's push subscription, when push is on */
  pushEndpoint?: string;
}
export interface SyncStatus extends SyncMeta { syncing: boolean }

const EMPTY: SyncMeta = { cursor: null, known: {}, tombstones: {} };
let meta: SyncMeta = load();
let syncing = false;
let status: SyncStatus = { ...meta, syncing };
const listeners = new Set<() => void>();

function load(): SyncMeta {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    return {
      key: isValidSyncKey(raw.key) ? raw.key : undefined,
      cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
      known: raw.known && typeof raw.known === 'object' ? raw.known : {},
      tombstones: raw.tombstones && typeof raw.tombstones === 'object' ? raw.tombstones : {},
      lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : undefined,
      pushEndpoint: typeof raw.pushEndpoint === 'string' ? raw.pushEndpoint : undefined,
    };
  } catch {
    return { ...EMPTY };
  }
}

function update(patch: Partial<SyncMeta>, persist = true) {
  meta = { ...meta, ...patch };
  status = { ...meta, syncing };
  if (persist) {
    try { localStorage.setItem(STORAGE, JSON.stringify({ ...meta, error: undefined })); } catch { /* private mode */ }
  }
  listeners.forEach((l) => l());
}
function setSyncing(v: boolean) { syncing = v; status = { ...meta, syncing }; listeners.forEach((l) => l()); }

export function getSyncMeta(): SyncMeta { return meta; }
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status, () => status);
}

let running: Promise<void> | null = null;
let again = false;

/** One sync round (coalesces concurrent calls). Never throws; the error is kept in the status. */
export function syncNow(): Promise<void> {
  if (!meta.key) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    setSyncing(true);
    try {
      do {
        again = false;
        await round();
      } while (again && meta.key);
    } finally {
      running = null;
      setSyncing(false);
    }
  })();
  return running;
}

async function round(): Promise<void> {
  const key = meta.key;
  if (!key) return;
  // Parcels this device exchanged before but no longer has were deleted here.
  const local = getParcels();
  const ids = new Set(local.map((p) => p.id));
  const tombstones = { ...meta.tombstones };
  const now = new Date().toISOString();
  for (const id of Object.keys(meta.known)) if (!ids.has(id) && !tombstones[id]) tombstones[id] = now;
  const changes = changesToPush(local, tombstones, meta.known);
  let res;
  try {
    res = await syncRound(key, meta.cursor, changes);
  } catch (e) {
    update({ tombstones, error: e instanceof SyncError ? e.kind : 'server' });
    return;
  }
  if (meta.key !== key) return; // disconnected meanwhile
  const known = { ...meta.known };
  for (const c of changes) known[c.id] = versionKey({ modifiedAt: c.modifiedAt, snapAt: c.snapAt ?? '1970-01-01T00:00:00.000Z', snapN: c.snapN });
  // Merge against the parcels as they are *now* (a refresh may have finished while we waited).
  const m = mergeRows(getParcels(), tombstones, known, res.rows ?? []);
  if (m.changed) actions.applySync(m.parcels, m.fresh);
  update({ cursor: res.cursor, known: m.known, tombstones: m.tombstones, lastSyncAt: new Date().toISOString(), error: undefined });
}

/** Turn sync on with a brand-new key (first device). */
export async function enableSync(): Promise<void> {
  update({ ...EMPTY, key: newSyncKey() });
  await syncNow();
}

/** Join an existing key (another device's link). Local parcels are kept and merged in. */
export async function linkSync(key: string): Promise<void> {
  if (!isValidSyncKey(key)) throw new SyncError('key');
  update({ ...EMPTY, key, pushEndpoint: meta.pushEndpoint });
  await syncNow();
}

/** Stop syncing on this device (parcels stay here; the other devices are not affected). */
export function disconnectSync(): void {
  update({ ...EMPTY });
}

/** Remember (or forget) this device's push subscription. */
export function setPushEndpoint(endpoint: string | undefined): void {
  update({ pushEndpoint: endpoint });
}

/** Link that opens the app and joins this device's key. */
export function linkUrl(key = meta.key): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
  return `${base}#/link/${key ?? ''}`;
}

let started = false;
/** Background sync triggers. Called once from main.tsx. */
export function startSync(): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const visible = () => document.visibilityState !== 'hidden';
  const unsub = subscribeState(() => {
    if (!meta.key || syncing) return;
    const parcels = getParcels();
    const ids = new Set(parcels.map((p) => p.id));
    const deleted = Object.keys(meta.known).some((id) => !ids.has(id) && !meta.tombstones[id]);
    if (!deleted && !changesToPush(parcels.filter(syncable), {}, meta.known).length) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), DEBOUNCE_MS);
  });
  const onVisible = () => { if (visible()) void syncNow(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  const timer = setInterval(() => { if (visible()) void syncNow(); }, PERIOD_MS);
  void syncNow();
  return () => {
    started = false;
    unsub();
    clearTimeout(debounce);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
  };
}

/** @internal tests */
export function __resetSyncForTests(next: Partial<SyncMeta> = {}) {
  meta = { ...EMPTY, ...next };
  syncing = false;
  running = null;
  status = { ...meta, syncing };
}
