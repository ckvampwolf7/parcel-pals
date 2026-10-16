/**
 * ENGINE PUBLIC API — owned by the Engine team.
 * Everything other modules may import from '@/engine' is exported here. Keep these names and signatures;
 * internals can be split into any files you like (carriers.ts, simulator.ts, speech.ts …).
 *
 * The bodies below are LEAD STUBS so the app runs while the team works. Replace them.
 */
import type {
  Carrier, CarrierMatch, CharacterKind, Checkpoint, Eta, Locale, Mood, Parcel, StatusTag, TrackingSnapshot,
} from '@/types';

// ───────────────────────── carriers ─────────────────────────

export const CARRIERS: Carrier[] = [
  { id: 'kr.cjlogistics', nameKo: 'CJ대한통운', nameEn: 'CJ Logistics', country: 'KR', scope: 'domestic' },
  { id: 'us.ups', nameKo: 'UPS', nameEn: 'UPS', country: 'US', scope: 'international' },
];

export function getCarrier(id: string): Carrier | undefined {
  return CARRIERS.find((c) => c.id === id);
}

/** Strip spaces/dashes, uppercase. */
export function normalizeTrackingNumber(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/** Ranked carrier candidates for a tracking number (best first). Empty if nothing plausible. */
export function detectCarriers(input: string): CarrierMatch[] {
  const n = normalizeTrackingNumber(input);
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return [{ carrier: CARRIERS[1], confidence: 0.95 }];
  if (/^\d{10,13}$/.test(n)) return [{ carrier: CARRIERS[0], confidence: 0.5 }];
  return [];
}

/** Character used when the user leaves it on 'auto'. */
export function autoCharacter(carrier: Carrier | undefined): CharacterKind {
  return carrier?.scope === 'international' ? 'plane' : 'truck';
}

// ───────────────────────── tracking provider ─────────────────────────

export interface TrackRequest {
  trackingNumber: string;
  carrierId: string;
  /** ISO real time the parcel was added — the mock provider anchors its plan to this. */
  createdAt: string;
  demo?: boolean;
}

export interface TrackingProvider {
  id: string;
  /** `now` is the current SIMULATION time (see createSimClock). Must be deterministic for (req, now). */
  track(req: TrackRequest, now: Date): Promise<TrackingSnapshot>;
}

/** Deterministic simulated carrier. */
export const mockProvider: TrackingProvider = {
  id: 'mock',
  async track(req, now) {
    const start = new Date(req.createdAt).getTime();
    const hours = (now.getTime() - start) / 3.6e6;
    const steps: Array<[number, StatusTag, string, string]> = [
      [0, 'info_received', '상품접수', 'Shipment information received'],
      [2, 'in_transit', '집화처리', 'Picked up'],
      [8, 'in_transit', '간선상차', 'Departed hub'],
      [16, 'in_transit', '간선하차', 'Arrived at hub'],
      [22, 'out_for_delivery', '배송출발', 'Out for delivery'],
      [26, 'delivered', '배송완료', 'Delivered'],
    ];
    const done = steps.filter((s) => s[0] <= hours);
    const checkpoints: Checkpoint[] = done.map((s, i) => ({
      id: `${req.trackingNumber}-${i}`,
      time: new Date(start + s[0] * 3.6e6).toISOString(),
      status: s[1],
      location: { ko: '서울', en: 'Seoul' },
      message: { ko: s[2], en: s[3] },
      stopIndex: Math.min(i, 3),
    }));
    const last = checkpoints[checkpoints.length - 1];
    const progress = Math.min(1, Math.max(0, hours / 26));
    return {
      status: last?.status ?? 'pending',
      checkpoints,
      stops: [
        { id: 'o', kind: 'origin', name: { ko: '판매자', en: 'Seller' }, modeToNext: 'truck' },
        { id: 'h1', kind: 'hub', name: { ko: '곤지암 허브', en: 'Gonjiam Hub' }, modeToNext: 'truck' },
        { id: 'l', kind: 'local', name: { ko: '동네 대리점', en: 'Local depot' }, modeToNext: 'bike' },
        { id: 'd', kind: 'destination', name: { ko: '우리 집', en: 'Home' } },
      ],
      progress,
      currentStopIndex: Math.min(3, Math.floor(progress * 3)),
      currentMode: 'truck',
      eta: { earliest: new Date(start + 24 * 3.6e6).toISOString(), latest: new Date(start + 28 * 3.6e6).toISOString() },
      updatedAt: now.toISOString(),
    };
  },
};

/** The provider the store should use. (Later: a real API provider chosen by settings/env.) */
export function getProvider(): TrackingProvider {
  return mockProvider;
}

// ───────────────────────── simulation clock ─────────────────────────

export interface SimClock {
  /** current simulation time */
  now(): Date;
  /** change speed without jumping (re-anchors) */
  setSpeed(speed: number): void;
  /** jump forward by simulated hours */
  advance(hours: number): void;
  /** serializable state for persistence */
  toJSON(): { anchorReal: number; anchorSim: number; speed: number };
}

export function createSimClock(state?: { anchorReal: number; anchorSim: number; speed: number }): SimClock {
  let anchorReal = state?.anchorReal ?? Date.now();
  let anchorSim = state?.anchorSim ?? Date.now();
  let speed = state?.speed ?? 1;
  const now = () => new Date(anchorSim + (Date.now() - anchorReal) * speed);
  return {
    now,
    setSpeed(s) { const n = now().getTime(); anchorReal = Date.now(); anchorSim = n; speed = s; },
    advance(h) { anchorSim += h * 3.6e6; },
    toJSON: () => ({ anchorReal, anchorSim, speed }),
  };
}

// ───────────────────────── presentation helpers ─────────────────────────

export type StatusTone = 'neutral' | 'info' | 'progress' | 'warning' | 'danger' | 'success';

/** Tone drives colors: CSS var `--c-tone-<tone>` / `--c-tone-<tone>-soft` (see styles/tokens.css). */
export function statusTone(status: StatusTag): StatusTone {
  switch (status) {
    case 'delivered': return 'success';
    case 'out_for_delivery': case 'available_for_pickup': return 'progress';
    case 'attempt_fail': case 'expired': return 'warning';
    case 'exception': return 'danger';
    case 'pending': return 'neutral';
    default: return 'info';
  }
}

export function statusLabel(status: StatusTag, locale: Locale): string {
  const ko: Record<StatusTag, string> = {
    pending: '조회 대기', info_received: '접수 완료', in_transit: '이동 중', customs: '통관 중', out_for_delivery: '배송 출발',
    available_for_pickup: '수령 대기', attempt_fail: '배송 실패', delivered: '배송 완료', exception: '문제 발생', expired: '업데이트 없음',
  };
  const en: Record<StatusTag, string> = {
    pending: 'Pending', info_received: 'Info received', in_transit: 'In transit', customs: 'In customs', out_for_delivery: 'Out for delivery',
    available_for_pickup: 'Ready for pickup', attempt_fail: 'Attempt failed', delivered: 'Delivered', exception: 'Exception', expired: 'No updates',
  };
  return (locale === 'ko' ? ko : en)[status];
}

/** Mood the parcel's character should show right now. */
export function moodFor(snapshot: TrackingSnapshot | null): Mood {
  if (!snapshot) return 'waiting';
  if (snapshot.delayed) return 'worried';
  switch (snapshot.status) {
    case 'delivered': return 'celebrating';
    case 'out_for_delivery': case 'available_for_pickup': return 'happy';
    case 'attempt_fail': case 'exception': return 'worried';
    case 'expired': return 'sleeping';
    case 'pending': case 'info_received': return 'waiting';
    default: return 'moving';
  }
}

/** Speech-bubble line: what the pal says about this parcel right now (first person, cute, 1–2 short sentences). */
export function characterLine(parcel: Parcel, locale: Locale): string {
  const s = parcel.snapshot?.status ?? 'pending';
  return locale === 'ko' ? `${statusLabel(s, locale)}! 열심히 가고 있어요` : `${statusLabel(s, locale)}! On my way`;
}

/** Line for one checkpoint (inbox items, notifications, toasts). */
export function checkpointLine(parcel: Parcel, checkpoint: Checkpoint, locale: Locale): string {
  return `${parcel.nickname}: ${locale === 'ko' ? checkpoint.message.ko : checkpoint.message.en}`;
}

/** Human ETA text, e.g. "내일 도착 예정" / "Arriving tomorrow", "오늘 오후 2–6시". `now` = sim time. */
export function formatEta(eta: Eta | undefined, locale: Locale, now: Date): string {
  if (!eta) return locale === 'ko' ? '도착 예정일 확인 중' : 'Estimating arrival';
  const d = new Date(eta.latest);
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
  if (locale === 'ko') return days <= 0 ? '오늘 도착 예정' : days === 1 ? '내일 도착 예정' : `${days}일 후 도착 예정`;
  return days <= 0 ? 'Arriving today' : days === 1 ? 'Arriving tomorrow' : `Arriving in ${days} days`;
}

/** Relative time like "3시간 전" / "3 h ago". */
export function formatRelative(iso: string, locale: Locale, now: Date): string {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 6e4));
  if (m < 1) return locale === 'ko' ? '방금 전' : 'just now';
  if (m < 60) return locale === 'ko' ? `${m}분 전` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return locale === 'ko' ? `${h}시간 전` : `${h} h ago`;
  const d = Math.round(h / 24);
  return locale === 'ko' ? `${d}일 전` : `${d} d ago`;
}

/** Sample parcels for first run / "Try demo". Each gets a createdAt in the past so it is mid-journey. */
export function demoParcelSeeds(): Array<{ trackingNumber: string; carrierId: string; nickname: { ko: string; en: string }; character: CharacterKind; hoursAgo: number }> {
  return [
    { trackingNumber: '612345678901', carrierId: 'kr.cjlogistics', nickname: { ko: '새 운동화', en: 'New sneakers' }, character: 'truck', hoursAgo: 10 },
    { trackingNumber: '1Z999AA10123456784', carrierId: 'us.ups', nickname: { ko: '해외 직구 키보드', en: 'Keyboard from abroad' }, character: 'plane', hoursAgo: 20 },
  ];
}
