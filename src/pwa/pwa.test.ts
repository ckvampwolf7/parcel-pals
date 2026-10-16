import { describe, expect, it, vi } from 'vitest';
import type { Checkpoint, Parcel, StatusTag } from '@/types';
import { createNotificationHandler, isMeaningfulCheckpoint, isQuietHours, type NotificationEnv } from './notifications';

const cp = (id: string, status: StatusTag, ko = '간선상차', en = 'Departed hub'): Checkpoint => ({
  id, status, time: '2026-10-16T03:00:00Z', location: { ko: '서울', en: 'Seoul' }, message: { ko, en },
});
const parcel = (over: Partial<Parcel> = {}): Parcel => ({
  id: 'p1', trackingNumber: '612345678901', carrierId: 'kr.cjlogistics', nickname: '새 운동화', character: 'truck',
  createdAt: '2026-10-15T00:00:00Z', archived: false, unread: 1, snapshot: null, ...over,
});
const at = (h: number) => { const d = new Date(2026, 9, 16, h, 0, 0); return d; };

function env(over: Partial<NotificationEnv> = {}) {
  const show = vi.fn();
  const e: NotificationEnv = {
    now: () => at(14), isHidden: () => true, permission: () => 'granted', enabled: () => true, show, ...over,
  };
  return { e, show };
}

describe('quiet hours', () => {
  it('22:00–08:00 is quiet', () => {
    expect(isQuietHours(at(22))).toBe(true);
    expect(isQuietHours(at(3))).toBe(true);
    expect(isQuietHours(at(7))).toBe(true);
    expect(isQuietHours(at(8))).toBe(false);
    expect(isQuietHours(at(21))).toBe(false);
  });
});

describe('meaningful checkpoints', () => {
  it('skips plain hub scans, keeps key states and hand-offs', () => {
    expect(isMeaningfulCheckpoint(cp('a', 'in_transit'), parcel())).toBe(false);
    expect(isMeaningfulCheckpoint(cp('b', 'out_for_delivery'), parcel())).toBe(true);
    expect(isMeaningfulCheckpoint(cp('c', 'delivered'), parcel())).toBe(true);
    expect(isMeaningfulCheckpoint(cp('d', 'in_transit', '국내 택배사 인계', 'Handed over to local carrier'), parcel())).toBe(true);
    expect(isMeaningfulCheckpoint(cp('e', 'customs'), parcel())).toBe(false);
  });
});

describe('notification handler', () => {
  it('notifies for a meaningful update while hidden', () => {
    const { e, show } = env();
    const h = createNotificationHandler(e);
    const p = parcel();
    const out = h({ type: 'parcel-updated', parcel: p, newCheckpoints: [cp('1', 'in_transit'), cp('2', 'out_for_delivery', '배송출발', 'Out for delivery')] });
    expect(show).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ title: '새 운동화', tag: 'parcel-p1', hash: '#/p/p1' });
    expect(out?.body).toBeTruthy();
  });
  it('does not notify while visible, in quiet hours, without permission, or when disabled', () => {
    const ev = { type: 'parcel-updated' as const, parcel: parcel(), newCheckpoints: [cp('2', 'delivered')] };
    for (const over of [{ isHidden: () => false }, { now: () => at(23) }, { permission: () => 'denied' as const }, { enabled: () => false }]) {
      const { e, show } = env(over);
      createNotificationHandler(e)(ev);
      expect(show).not.toHaveBeenCalled();
    }
  });
  it('does not notify for routine scans and dedupes updated + delivered', () => {
    const { e, show } = env();
    const h = createNotificationHandler(e);
    h({ type: 'parcel-updated', parcel: parcel(), newCheckpoints: [cp('1', 'in_transit')] });
    expect(show).not.toHaveBeenCalled();
    const delivered = cp('9', 'delivered');
    const p = parcel({ snapshot: { status: 'delivered', checkpoints: [delivered], stops: [], progress: 1, currentStopIndex: 0, currentMode: 'truck', updatedAt: '' } });
    h({ type: 'parcel-updated', parcel: p, newCheckpoints: [delivered] });
    h({ type: 'parcel-delivered', parcel: p });
    expect(show).toHaveBeenCalledTimes(1);
  });
});
