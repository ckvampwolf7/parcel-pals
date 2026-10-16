import type { Checkpoint, Parcel } from '@/types';
import { eventsToToasts } from './toastEvents';

const cp = (id: string, status: Checkpoint['status'], time: string): Checkpoint => ({
  id, status, time, location: { ko: '서울', en: 'Seoul' }, message: { ko: '간선하차', en: 'Arrived at hub' },
});
const parcel = (id: string, status: Checkpoint['status'] = 'in_transit'): Parcel => ({
  id, trackingNumber: '612345678901', carrierId: 'kr.cjlogistics', nickname: `P-${id}`, character: 'truck',
  createdAt: '2026-10-16T00:00:00Z', archived: false, unread: 1,
  snapshot: { status, checkpoints: [], stops: [], progress: 0.5, currentStopIndex: 1, currentMode: 'truck', updatedAt: '2026-10-16T00:00:00Z' },
});

describe('eventsToToasts', () => {
  it('turns an update into a pal toast linking to the parcel', () => {
    const p = parcel('a');
    const out = eventsToToasts([{ type: 'parcel-updated', parcel: p, newCheckpoints: [cp('1', 'in_transit', '2026-10-16T01:00:00Z')] }], 'ko', '#/');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ character: 'truck', to: '/p/a' });
    expect(out[0].text.length).toBeGreaterThan(0);
  });

  it('coalesces update + delivered into one celebratory toast', () => {
    const p = parcel('a', 'delivered');
    const out = eventsToToasts([
      { type: 'parcel-updated', parcel: p, newCheckpoints: [cp('9', 'delivered', '2026-10-16T05:00:00Z')] },
      { type: 'parcel-delivered', parcel: p },
    ], 'en', '#/');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tone: 'success', mood: 'celebrating' });
    expect(out[0].text).toContain('P-a');
  });

  it('stays quiet about the parcel the user is already looking at', () => {
    const p = parcel('a');
    const out = eventsToToasts([{ type: 'parcel-updated', parcel: p, newCheckpoints: [cp('1', 'in_transit', '2026-10-16T01:00:00Z')] }], 'ko', '#/p/a');
    expect(out).toHaveLength(0);
  });

  it('summarises a burst of many parcel updates', () => {
    const evs = ['a', 'b', 'c'].map((id) => ({ type: 'parcel-updated' as const, parcel: parcel(id), newCheckpoints: [cp('1', 'in_transit', '2026-10-16T01:00:00Z')] }));
    const out = eventsToToasts(evs, 'en', '#/');
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe('/inbox');
    expect(out[0].text).toContain('3');
  });
});
