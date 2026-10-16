/**
 * Fixture parcels for Journey tests and the dev gallery (src/journey/dev/gallery.html).
 * Not imported by the app itself.
 */
import type { Checkpoint, Parcel, RouteStop, StatusTag, TrackingSnapshot, TransportMode } from '@/types';

const L = (ko: string, en: string) => ({ ko, en });

export const DOMESTIC_STOPS: RouteStop[] = [
  { id: 'o', kind: 'origin', name: L('성수 판매자', 'Seongsu shop'), modeToNext: 'truck' },
  { id: 'h1', kind: 'hub', name: L('곤지암 허브', 'Gonjiam Hub'), modeToNext: 'truck' },
  { id: 'h2', kind: 'hub', name: L('대전 터미널', 'Daejeon Terminal'), modeToNext: 'truck' },
  { id: 'l', kind: 'local', name: L('동네 대리점', 'Local depot'), modeToNext: 'bike' },
  { id: 'd', kind: 'destination', name: L('우리 집', 'Home') },
];

export const INTL_STOPS: RouteStop[] = [
  { id: 'o', kind: 'origin', name: L('선전 판매자', 'Shenzhen seller'), modeToNext: 'truck' },
  { id: 'h1', kind: 'hub', name: L('선전 물류센터', 'Shenzhen sort center'), modeToNext: 'truck' },
  { id: 'a1', kind: 'airport', name: L('선전 공항', 'Shenzhen Airport'), modeToNext: 'plane' },
  { id: 'a2', kind: 'airport', name: L('인천공항', 'Incheon Airport'), modeToNext: 'truck' },
  { id: 'c', kind: 'customs', name: L('인천 세관', 'Incheon Customs'), modeToNext: 'truck' },
  { id: 'h2', kind: 'hub', name: L('한진 허브', 'Hanjin Hub'), modeToNext: 'truck' },
  { id: 'l', kind: 'local', name: L('동네 대리점', 'Local depot'), modeToNext: 'bike' },
  { id: 'd', kind: 'destination', name: L('우리 집', 'Home') },
];

const BASE = new Date('2026-10-14T09:00:00+09:00').getTime();
const h = (n: number) => new Date(BASE + n * 36e5).toISOString();

function cps(prefix: string, rows: Array<[number, StatusTag, number, string, string, string, string]>): Checkpoint[] {
  return rows.map(([hr, status, stopIndex, mko, men, lko, len], i) => ({
    id: `${prefix}-${i}`, time: h(hr), status, stopIndex, message: L(mko, men), location: L(lko, len),
  }));
}

const DOM_ROWS: Array<[number, StatusTag, number, string, string, string, string]> = [
  [0, 'info_received', 0, '상품접수', 'Shipment information received', '성수', 'Seongsu'],
  [3, 'in_transit', 0, '집화처리', 'Picked up', '성수', 'Seongsu'],
  [8, 'in_transit', 1, '간선하차', 'Arrived at hub', '곤지암', 'Gonjiam'],
  [11, 'in_transit', 1, '간선상차', 'Departed hub', '곤지암', 'Gonjiam'],
  [18, 'in_transit', 2, '간선하차', 'Arrived at terminal', '대전', 'Daejeon'],
  [24, 'in_transit', 3, '배달준비', 'Arrived at delivery branch', '마포', 'Mapo'],
  [26, 'out_for_delivery', 3, '배송출발', 'Out for delivery', '마포', 'Mapo'],
  [30, 'delivered', 4, '배송완료', 'Delivered', '마포', 'Mapo'],
];

const INTL_ROWS: Array<[number, StatusTag, number, string, string, string, string]> = [
  [0, 'info_received', 0, '주문 접수', 'Order information received', '선전', 'Shenzhen'],
  [6, 'in_transit', 1, '물류센터 입고', 'Arrived at sorting center', '선전', 'Shenzhen'],
  [14, 'in_transit', 2, '항공 출발', 'Departed from origin airport', '선전', 'Shenzhen'],
  [20, 'in_transit', 3, '항공 도착', 'Arrived at destination airport', '인천', 'Incheon'],
  [26, 'customs', 4, '반입신고', 'Import customs clearance started', '인천', 'Incheon'],
  [40, 'in_transit', 4, '수입신고수리', 'Customs cleared', '인천', 'Incheon'],
  [44, 'in_transit', 5, '간선하차', 'Arrived at hub', '한진 허브', 'Hanjin Hub'],
  [52, 'in_transit', 6, '배달준비', 'Arrived at delivery branch', '마포', 'Mapo'],
  [55, 'out_for_delivery', 6, '배송출발', 'Out for delivery', '마포', 'Mapo'],
  [59, 'delivered', 7, '배송완료', 'Delivered', '마포', 'Mapo'],
];

export type Scenario =
  | 'pending' | 'info_received' | 'domestic' | 'domestic_between' | 'international' | 'intl_customs_delayed' | 'intl_handoff'
  | 'out_for_delivery' | 'pickup' | 'delivered' | 'intl_delivered' | 'exception' | 'stale';

interface Spec { stops: RouteStop[]; rows: typeof DOM_ROWS; upTo: number; progress?: number; mode?: TransportMode; carrierId: string; number: string; character: Parcel['character']; nickname: string; extra?: Partial<TrackingSnapshot>; statusOverride?: StatusTag }

const SPECS: Record<Scenario, Spec> = {
  pending: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 0, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화', statusOverride: 'pending' },
  info_received: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 1, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화' },
  domestic: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 4, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화' },
  domestic_between: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 4, progress: 0.38, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'bunny', nickname: '엄마 생일 선물' },
  international: { stops: INTL_STOPS, rows: INTL_ROWS, upTo: 3, progress: 0.22, mode: 'plane', carrierId: 'us.ups', number: '1Z999AA10123456784', character: 'plane', nickname: '해외 직구 키보드' },
  intl_customs_delayed: { stops: INTL_STOPS, rows: INTL_ROWS, upTo: 5, carrierId: 'us.ups', number: '1Z999AA10123456784', character: 'plane', nickname: '해외 직구 키보드', extra: { delayed: true, delayReason: 'customs_inspection' } },
  intl_handoff: {
    stops: INTL_STOPS, rows: INTL_ROWS, upTo: 6, progress: 0.66, carrierId: 'us.ups', number: '1Z999AA10123456784', character: 'plane', nickname: '해외 직구 키보드',
    extra: { handoff: { carrierId: 'kr.cjlogistics', trackingNumber: '512345678902', time: h(40) } },
  },
  out_for_delivery: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 7, progress: 0.86, mode: 'bike', carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화' },
  pickup: {
    stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 7, progress: 1, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'bunny', nickname: '책 세트', statusOverride: 'available_for_pickup',
    extra: { pickup: { place: L('GS25 망원점', 'GS25 Mangwon'), kind: 'convenience_store' } },
  },
  delivered: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 8, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화' },
  intl_delivered: {
    stops: INTL_STOPS, rows: INTL_ROWS, upTo: 10, carrierId: 'us.ups', number: '1Z999AA10123456784', character: 'plane', nickname: '해외 직구 키보드',
    extra: { handoff: { carrierId: 'kr.cjlogistics', trackingNumber: '512345678902', time: h(40) } },
  },
  exception: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 5, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화', statusOverride: 'exception' },
  stale: { stops: DOMESTIC_STOPS, rows: DOM_ROWS, upTo: 3, carrierId: 'kr.cjlogistics', number: '612345678901', character: 'truck', nickname: '새 운동화', extra: { stale: true } },
};

export function fixtureParcel(s: Scenario, patch?: Partial<Parcel>): Parcel {
  const spec = SPECS[s];
  const checkpoints = s === 'pending' ? [] : cps(s, spec.rows.slice(0, spec.upTo));
  const last = checkpoints.at(-1);
  const n = spec.stops.length;
  const status = spec.statusOverride ?? last?.status ?? 'pending';
  if (s === 'exception' && last) checkpoints.push({ ...last, id: `${s}-x`, time: h(spec.rows[spec.upTo - 1][0] + 2), status: 'exception', message: L('주소 불명', 'Address issue') });
  const cur = last?.stopIndex ?? 0;
  const progress = spec.progress ?? (status === 'delivered' ? 1 : cur / (n - 1));
  const snapshot: TrackingSnapshot = {
    status,
    checkpoints,
    stops: spec.stops,
    progress,
    currentStopIndex: Math.min(n - 1, Math.floor(progress * (n - 1) + 1e-6)),
    currentMode: spec.mode ?? spec.stops[cur]?.modeToNext ?? 'truck',
    eta: status === 'delivered' ? undefined : { earliest: h(spec.rows.at(-1)![0] - 2), latest: h(spec.rows.at(-1)![0] + 2), confidence: s === 'international' ? 0.4 : 0.8 },
    updatedAt: last ? new Date(new Date(last.time).getTime() + 30 * 6e4).toISOString() : h(0),
    ...spec.extra,
  };
  return {
    id: `fx-${s}`, trackingNumber: spec.number, carrierId: spec.carrierId, nickname: spec.nickname, character: spec.character,
    createdAt: h(0), archived: false, snapshot, unread: 0, demo: true, ...patch,
  };
}

export const SCENARIOS = Object.keys(SPECS) as Scenario[];
