/** Curated demo parcels whose simulated stories look great, plus a helper that places each one mid-story. */
import type { CharacterKind, TrackingSnapshot } from '@/types';
import { snapshotAt } from './simulator';
import { isMoving } from './status';

/** What part of the story a demo parcel should be in when loaded. */
export type DemoTarget = 'domestic_moving' | 'international_air' | 'out_for_delivery' | 'delivered';

export interface DemoSeed {
  trackingNumber: string;
  carrierId: string;
  nickname: { ko: string; en: string };
  character: CharacterKind;
  /** Fallback offset (sim hours before now) when no `target` search is done. */
  hoursAgo: number;
  /** Preferred story moment; `demoCreatedAt` searches for a createdAt that lands there (time-of-day aware). */
  target?: DemoTarget;
}

/** Sample parcels for first run / "Try demo". */
export function demoParcelSeeds(): DemoSeed[] {
  return [
    { trackingNumber: '640123456136', carrierId: 'kr.cjlogistics', nickname: { ko: '새 운동화', en: 'New sneakers' }, character: 'truck', hoursAgo: 14, target: 'domestic_moving' },
    { trackingNumber: 'LP00512345678918', carrierId: 'cn.cainiao', nickname: { ko: '해외직구 키보드', en: 'Keyboard from abroad' }, character: 'plane', hoursAgo: 60, target: 'international_air' },
    { trackingNumber: '512345678916', carrierId: 'kr.hanjin', nickname: { ko: '엄마 생일 선물', en: 'Mom’s birthday gift' }, character: 'bunny', hoursAgo: 30, target: 'out_for_delivery' },
    { trackingNumber: '309123456051', carrierId: 'kr.lotte', nickname: { ko: '고양이 모래', en: 'Cat litter' }, character: 'truck', hoursAgo: 50, target: 'delivered' },
  ];
}

function score(target: DemoTarget, s: TrackingSnapshot, now: number): number {
  const moving = isMoving(s);
  const lastT = s.checkpoints.length ? new Date(s.checkpoints[s.checkpoints.length - 1].time).getTime() : now;
  const sinceLast = (now - lastT) / 3.6e6;
  switch (target) {
    case 'domestic_moving':
      if (s.status !== 'in_transit') return s.status === 'info_received' ? 1 : 0;
      return (moving ? 3 : 2) + (s.progress > 0.25 && s.progress < 0.75 ? 0.5 : 0) - Math.min(0.4, sinceLast / 48);
    case 'international_air':
      if (s.currentMode === 'plane' && moving) return 4 - Math.abs(s.progress * 6 - 1.5) * 0.2;
      if (s.status === 'customs') return 3;
      return s.status === 'in_transit' && s.currentStopIndex < 3 ? 1.5 : 0.5;
    case 'out_for_delivery':
      if (s.status === 'out_for_delivery') {
        const etaMid = s.eta ? (new Date(s.eta.earliest).getTime() + new Date(s.eta.latest).getTime()) / 2 : now + 3 * 3.6e6;
        const remaining = (etaMid - now) / 3.6e6;
        return 4 - Math.min(1, Math.abs(remaining - 1.5) / 4);
      }
      if (s.status === 'in_transit' && s.stops[s.currentStopIndex]?.kind === 'local') return 2.5;
      return s.status === 'in_transit' ? 1 : 0;
    case 'delivered':
      if (s.status === 'delivered') return 3 - Math.abs(sinceLast - 5) / 24;
      return 0;
    default:
      return 0;
  }
}

/**
 * createdAt (ISO) that puts a demo parcel at its target story moment at sim time `now`.
 * Falls back to `hoursAgo` when the seed has no target.
 */
export function demoCreatedAt(seed: DemoSeed, now: Date): string {
  const n = now.getTime();
  if (!seed.target) return new Date(n - seed.hoursAgo * 3.6e6).toISOString();
  let best = { h: seed.hoursAgo, s: -Infinity };
  for (let h = 0.5; h <= 240; h += h < 72 ? 0.25 : 1) {
    // round to the minute so plans are stable across reloads
    const createdAt = new Date(Math.round((n - h * 3.6e6) / 6e4) * 6e4).toISOString();
    const snap = snapshotAt({ trackingNumber: seed.trackingNumber, carrierId: seed.carrierId, createdAt }, now);
    const sc = score(seed.target, snap, n);
    if (sc > best.s + 1e-9) best = { h, s: sc };
  }
  return new Date(Math.round((n - best.h * 3.6e6) / 6e4) * 6e4).toISOString();
}
