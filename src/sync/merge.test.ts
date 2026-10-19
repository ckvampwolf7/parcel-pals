// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Checkpoint, Parcel, TrackingSnapshot } from '@/types';
import { changesToPush, compareVersion, isValidSyncKey, mergeRows, newSyncKey, parseSyncKey, toWire, versionKey, versionOf } from './merge';
import type { SyncRow } from './api';

const cp = (id: string, time: string): Checkpoint => ({ id, time, status: 'in_transit', location: { ko: 'A', en: 'A' }, message: { ko: 'm', en: 'm' } });
const snap = (cps: Checkpoint[]): TrackingSnapshot => ({ status: 'in_transit', checkpoints: cps } as unknown as TrackingSnapshot);
const parcel = (over: Partial<Parcel> = {}): Parcel => ({
  id: 'p1', trackingNumber: '516139538183', carrierId: 'us.fedex', nickname: 'Shoes', character: 'plane',
  createdAt: '2026-10-19T10:00:00.000Z', archived: false, snapshot: null, unread: 0, ...over,
});
const rowOf = (p: Parcel | null, id = 'p1', modifiedAt?: string): SyncRow => {
  if (!p) return { id, data: null, modifiedAt: modifiedAt!, snapAt: '1970-01-01T00:00:00Z', snapN: 0 };
  const v = versionOf(p);
  return { id: p.id, data: toWire(p), modifiedAt: v.modifiedAt, snapAt: v.snapAt, snapN: v.snapN };
};

describe('sync keys', () => {
  it('are long random base64url strings and can be read back from links', () => {
    const k = newSyncKey();
    expect(isValidSyncKey(k)).toBe(true);
    expect(k).not.toBe(newSyncKey());
    expect(parseSyncKey(`https://ckvampwolf7.github.io/parcel-pals/#/link/${k}`)).toBe(k);
    expect(parseSyncKey(`  ${k} `)).toBe(k);
    expect(parseSyncKey('short')).toBeNull();
  });
});

describe('versions', () => {
  it('order by edit time, then newest event, then event count', () => {
    const a = versionOf(parcel({ modifiedAt: '2026-10-19T12:00:00Z' }));
    const b = versionOf(parcel({ modifiedAt: '2026-10-19T11:00:00Z', snapshot: snap([cp('x', '2026-10-19T11:30:00Z')]) }));
    expect(compareVersion(a, b)).toBe(1);
    const c = versionOf(parcel({ snapshot: snap([cp('x', '2026-10-19T11:30:00Z')]) }));
    const d = versionOf(parcel({ snapshot: snap([cp('x', '2026-10-19T11:30:00Z'), cp('y', '2026-10-19T11:30:00Z')]) }));
    expect(compareVersion(d, c)).toBe(1);
    expect(compareVersion(c, c)).toBe(0);
  });
});

describe('changesToPush', () => {
  it('sends new/changed parcels and deletions, never demo parcels or per-device fields', () => {
    const p = parcel({ unread: 3, lastCheckedAt: '2026-10-19T12:00:00Z' });
    const demo = parcel({ id: 'd', demo: true });
    const out = changesToPush([p, demo], { gone: '2026-10-19T13:00:00Z' }, {});
    expect(out.map((c) => c.id)).toEqual(['p1', 'gone']);
    expect(out[0].data).not.toHaveProperty('unread');
    expect(out[0].data).not.toHaveProperty('lastCheckedAt');
    expect(out[1].data).toBeNull();
    // already exchanged → nothing to send
    const known = { p1: versionKey(versionOf(p)), gone: versionKey({ modifiedAt: '2026-10-19T13:00:00Z', snapAt: '1970-01-01T00:00:00Z', snapN: 0 }) };
    expect(changesToPush([p], { gone: '2026-10-19T13:00:00Z' }, known)).toEqual([]);
  });
});

describe('mergeRows', () => {
  it('adds parcels from other devices', () => {
    const remote = parcel({ id: 'r1', snapshot: snap([cp('a', '2026-10-19T09:00:00Z')]) });
    const m = mergeRows([], {}, {}, [rowOf(remote)]);
    expect(m.parcels.map((p) => p.id)).toEqual(['r1']);
    expect(m.parcels[0].unread).toBe(0);
    expect(m.changed).toBe(true);
  });

  it('newer tracking data from another device marks the new events unread, keeping local seen state', () => {
    const local = parcel({ unread: 0, lastSeenCheckpointId: 'a', snapshot: snap([cp('a', '2026-10-19T09:00:00Z')]) });
    const remote = parcel({ snapshot: snap([cp('a', '2026-10-19T09:00:00Z'), cp('b', '2026-10-19T12:00:00Z')]) });
    const m = mergeRows([local], {}, {}, [rowOf(remote)]);
    expect(m.parcels[0].snapshot?.checkpoints).toHaveLength(2);
    expect(m.parcels[0].unread).toBe(1);
    expect(m.parcels[0].lastSeenCheckpointId).toBe('a');
    expect(m.fresh.p1.map((c) => c.id)).toEqual(['b']);
  });

  it('older server rows never overwrite newer local edits', () => {
    const local = parcel({ nickname: 'New name', modifiedAt: '2026-10-19T15:00:00Z' });
    const remote = parcel({ nickname: 'Old name', modifiedAt: '2026-10-19T14:00:00Z' });
    const m = mergeRows([local], {}, {}, [rowOf(remote)]);
    expect(m.parcels[0].nickname).toBe('New name');
    expect(m.changed).toBe(false);
  });

  it('a newer deletion removes the parcel; an older one does not', () => {
    const local = parcel({ modifiedAt: '2026-10-19T12:00:00Z' });
    expect(mergeRows([local], {}, {}, [rowOf(null, 'p1', '2026-10-19T13:00:00Z')]).parcels).toEqual([]);
    expect(mergeRows([local], {}, {}, [rowOf(null, 'p1', '2026-10-19T11:00:00Z')]).parcels).toHaveLength(1);
  });

  it('a parcel deleted here is not resurrected by an older server copy', () => {
    const remote = parcel({ modifiedAt: '2026-10-19T12:00:00Z' });
    const m = mergeRows([], { p1: '2026-10-19T13:00:00Z' }, {}, [rowOf(remote)]);
    expect(m.parcels).toEqual([]);
  });

  it('ignores malformed rows', () => {
    const m = mergeRows([], {}, {}, [{ id: 'x', data: { hello: 1 }, modifiedAt: '2026-10-19T12:00:00Z', snapAt: '1970-01-01T00:00:00Z', snapN: 0 }]);
    expect(m.parcels).toEqual([]);
  });
});
