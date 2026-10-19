/**
 * Pure sync logic: which local parcels to upload, and how server rows merge into local state.
 *
 * Version of a parcel = (modifiedAt, snapAt, snapN), compared as a tuple (the server does the same):
 *  - modifiedAt: real time of the last user edit (add, rename, pal, carrier, archive, delete)
 *  - snapAt / snapN: time and count of the newest carrier event — so fresher tracking data wins between equal edits.
 * Demo parcels never sync. Per-device fields (unread, seen marker, errors, last lookup) stay local.
 */
import type { Checkpoint, Parcel } from '@/types';
import type { SyncChange, SyncRow } from './api';

const EPOCH = '1970-01-01T00:00:00.000Z';
const LOCAL_ONLY = ['unread', 'lastSeenCheckpointId', 'error', 'refreshing', 'lastCheckedAt'] as const;

export interface Version { modifiedAt: string; snapAt: string; snapN: number }

/** 43-char base64url string from 32 random bytes. */
export function newSyncKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isValidSyncKey(k: unknown): k is string {
  return typeof k === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(k);
}

/** Pull a sync key out of a pasted link (…#/link/<key>) or a bare code. */
export function parseSyncKey(text: string): string | null {
  const t = text.trim();
  const m = /#\/link\/([A-Za-z0-9_-]{32,128})/.exec(t);
  if (m) return m[1];
  return isValidSyncKey(t) ? t : null;
}

export function syncable(p: Parcel): boolean {
  return !p.demo;
}

export function versionOf(p: Parcel): Version {
  const cps = p.snapshot?.checkpoints ?? [];
  const last = cps.at(-1);
  return { modifiedAt: iso(p.modifiedAt ?? p.createdAt), snapAt: last ? iso(last.time) : EPOCH, snapN: cps.length };
}

/** a > b → 1, a < b → -1, equal → 0 (tuple order, like Postgres row comparison). */
export function compareVersion(a: Version, b: Version): number {
  const ma = Date.parse(a.modifiedAt), mb = Date.parse(b.modifiedAt);
  if (ma !== mb) return ma > mb ? 1 : -1;
  const sa = Date.parse(a.snapAt), sb = Date.parse(b.snapAt);
  if (sa !== sb) return sa > sb ? 1 : -1;
  return a.snapN === b.snapN ? 0 : a.snapN > b.snapN ? 1 : -1;
}

export const versionKey = (v: Version) => `${Date.parse(v.modifiedAt)}|${Date.parse(v.snapAt)}|${v.snapN}`;

function iso(s: string | undefined): string {
  const t = s ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? EPOCH : new Date(t).toISOString();
}

/** The parcel as stored on the server (no per-device fields). */
export function toWire(p: Parcel): Record<string, unknown> {
  const out: Record<string, unknown> = { ...p };
  for (const k of LOCAL_ONLY) delete out[k];
  return out;
}

/**
 * Changes to upload: parcels (and deletions) whose version differs from what this device last sent or received.
 * `known` maps parcel id → versionKey last exchanged with the server.
 */
export function changesToPush(parcels: Parcel[], tombstones: Record<string, string>, known: Record<string, string>): SyncChange[] {
  const out: SyncChange[] = [];
  for (const p of parcels) {
    if (!syncable(p)) continue;
    const v = versionOf(p);
    if (known[p.id] === versionKey(v)) continue;
    out.push({ id: p.id, data: toWire(p), modifiedAt: v.modifiedAt, snapAt: v.snapAt, snapN: v.snapN });
  }
  for (const [id, at] of Object.entries(tombstones)) {
    const v: Version = { modifiedAt: iso(at), snapAt: EPOCH, snapN: 0 };
    if (known[id] === versionKey(v)) continue;
    out.push({ id, data: null, modifiedAt: v.modifiedAt, snapAt: v.snapAt, snapN: 0 });
  }
  return out;
}

export interface MergeResult {
  parcels: Parcel[];
  tombstones: Record<string, string>;
  known: Record<string, string>;
  /** parcel id → checkpoints that are new to this device (for the inbox / unread counts) */
  fresh: Record<string, Checkpoint[]>;
  changed: boolean;
}

/** Merge server rows into local state. Newer version wins; ties keep local. */
export function mergeRows(parcels: Parcel[], tombstones: Record<string, string>, known: Record<string, string>, rows: SyncRow[]): MergeResult {
  let list = parcels.slice();
  const tomb = { ...tombstones };
  const kn = { ...known };
  const fresh: Record<string, Checkpoint[]> = {};
  let changed = false;
  for (const row of rows) {
    const rv: Version = { modifiedAt: iso(row.modifiedAt), snapAt: iso(row.snapAt), snapN: row.snapN ?? 0 };
    const idx = list.findIndex((p) => p.id === row.id);
    const local = idx >= 0 ? list[idx] : undefined;
    const localTomb = tomb[row.id];
    const lv: Version | undefined = local ? versionOf(local) : localTomb ? { modifiedAt: iso(localTomb), snapAt: EPOCH, snapN: 0 } : undefined;
    if (lv && compareVersion(rv, lv) <= 0) {
      if (compareVersion(rv, lv) === 0) kn[row.id] = versionKey(rv);
      continue;
    }
    kn[row.id] = versionKey(rv);
    if (row.data === null) {
      // Deleted on another device.
      if (local) { list.splice(idx, 1); changed = true; }
      tomb[row.id] = rv.modifiedAt;
      continue;
    }
    delete tomb[row.id];
    const remote = row.data as unknown as Parcel;
    if (!remote || typeof remote !== 'object' || remote.id !== row.id || typeof remote.trackingNumber !== 'string') continue;
    if (local?.demo) continue;
    const knownIds = new Set(local?.snapshot?.checkpoints.map((c) => c.id) ?? []);
    const newCps = local?.snapshot ? (remote.snapshot?.checkpoints ?? []).filter((c) => !knownIds.has(c.id)) : [];
    if (newCps.length) fresh[row.id] = newCps;
    const merged: Parcel = {
      ...remote,
      unread: (local?.unread ?? 0) + newCps.length,
      lastSeenCheckpointId: local?.lastSeenCheckpointId,
      lastCheckedAt: local?.lastCheckedAt,
      error: undefined,
      refreshing: false,
    };
    if (local) list[idx] = merged;
    else list = [merged, ...list];
    changed = true;
  }
  return { parcels: list, tombstones: tomb, known: kn, fresh, changed };
}
