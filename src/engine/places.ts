/** Place names + carrier vocabularies used by the simulation (all bilingual). */
import type { LocalizedText } from '@/types';

export type L = LocalizedText;
const L = (ko: string, en: string): L => ({ ko, en });

/** Carrier "family": decides vocabulary and facility naming. */
export type Family = 'cj' | 'hanjin' | 'lotte' | 'epost' | 'logen' | 'kd' | 'daesin' | 'cvs' | 'coupang' | 'express' | 'intl';

export const FAMILY: Record<string, Family> = {
  'kr.cjlogistics': 'cj', 'kr.hanjin': 'hanjin', 'kr.lotte': 'lotte', 'kr.epost': 'epost', 'kr.logen': 'logen',
  'kr.kdexp': 'kd', 'kr.daesin': 'daesin', 'kr.cvsnet': 'cvs', 'kr.coupangls': 'coupang',
  'us.ups': 'express', 'us.fedex': 'express', 'de.dhl': 'express',
};
export const familyOf = (carrierId: string, scope: 'domestic' | 'international'): Family =>
  FAMILY[carrierId] ?? (scope === 'international' ? 'intl' : 'cj');

/** The user's neighbourhood: every parcel comes home to the same place (believable across parcels). */
export const HOME_AREA = L('마포', 'Mapo');
export const HOME = L('우리 집', 'Home');

export const SELLER_AREAS: L[] = [
  L('파주', 'Paju'), L('김포', 'Gimpo'), L('인천 서구', 'Incheon Seo-gu'), L('부천', 'Bucheon'), L('이천', 'Icheon'),
  L('용인', 'Yongin'), L('화성', 'Hwaseong'), L('대구 달서', 'Daegu Dalseo'), L('부산 강서', 'Busan Gangseo'),
  L('광주 광산', 'Gwangju Gwangsan'), L('안산', 'Ansan'), L('평택', 'Pyeongtaek'), L('청주', 'Cheongju'), L('남양주', 'Namyangju'),
];

export const MEGA_HUBS: Record<Family, L[]> = {
  cj: [L('곤지암 메가허브', 'Gonjiam MegaHub'), L('대전 허브', 'Daejeon Hub'), L('옥천 허브', 'Okcheon Hub'), L('청원 허브', 'Cheongwon Hub')],
  hanjin: [L('대전 메가허브', 'Daejeon MegaHub'), L('중부 허브', 'Jungbu Hub')],
  lotte: [L('진천 메가허브', 'Jincheon MegaHub'), L('청원 허브', 'Cheongwon Hub')],
  epost: [L('중부권광역우편물류센터', 'Central Region Mail Center'), L('동서울우편집중국', 'East Seoul Mail Center')],
  logen: [L('이천 허브', 'Icheon Hub'), L('대전 허브', 'Daejeon Hub')],
  kd: [L('경동 대전 허브', 'Kyungdong Daejeon Hub')],
  daesin: [L('대신 대전 허브', 'Daesin Daejeon Hub')],
  cvs: [L('편의점택배 군포 허브', 'CVS Parcel Gunpo Hub')],
  coupang: [L('쿠팡 이천 물류센터', 'Coupang Icheon FC'), L('쿠팡 고양 물류센터', 'Coupang Goyang FC'), L('쿠팡 인천 물류센터', 'Coupang Incheon FC')],
  express: [L('인천 게이트웨이', 'Incheon Gateway')],
  intl: [L('인천 국제우편물류센터', 'Incheon Intl Mail Center')],
};

/** Seller-side branch / local depot name for a family. */
export function facility(family: Family, area: L, carrierName: L): L {
  switch (family) {
    case 'epost': case 'intl': return L(`${area.ko}우체국`, `${area.en} Post Office`);
    case 'hanjin': case 'lotte': return L(`${area.ko} 대리점`, `${area.en} Branch`);
    case 'logen': case 'kd': case 'daesin': return L(`${area.ko} 영업소`, `${area.en} Branch`);
    case 'coupang': return L(`${area.ko} 캠프`, `${area.en} Camp`);
    case 'cvs': return L(`GS25 ${area.ko}점`, `GS25 ${area.en}`);
    case 'express': return L(`${carrierName.ko} ${area.ko} 서비스센터`, `${carrierName.en} ${area.en} Service Center`);
    default: return L(`${area.ko} 터미널`, `${area.en} Terminal`);
  }
}

/** Carrier-style checkpoint wording per family for the domestic steps (ko varies by carrier; en is generic carrier English). */
export type DomesticCode = 'received' | 'pickup' | 'depart' | 'arrive_hub' | 'arrive_local' | 'out_for_delivery' | 'delivered' | 'attempt_fail' | 'pickup_ready' | 'picked_up';

const EN: Record<DomesticCode, string> = {
  received: 'Shipment information received',
  pickup: 'Picked up',
  depart: 'Departed sorting hub',
  arrive_hub: 'Arrived at sorting hub',
  arrive_local: 'Arrived at delivery station',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  attempt_fail: 'Delivery attempted — recipient not available',
  pickup_ready: 'Ready for pickup',
  picked_up: 'Picked up by recipient',
};

const KO: Record<Family, Record<DomesticCode, string>> = {
  cj: { received: '상품접수', pickup: '집화처리', depart: '간선상차', arrive_hub: '간선하차', arrive_local: '배송지 도착', out_for_delivery: '배송출발', delivered: '배송완료', attempt_fail: '미배송 (고객 부재)', pickup_ready: '보관 (택배함)', picked_up: '수령 완료' },
  hanjin: { received: '접수', pickup: '입고', depart: '이동중', arrive_hub: '도착', arrive_local: '배송준비중', out_for_delivery: '배송출발', delivered: '배송완료', attempt_fail: '미배송 (수취인 부재)', pickup_ready: '보관 중', picked_up: '수령 완료' },
  lotte: { received: '상품접수', pickup: '상품 집하', depart: '상품 이동중', arrive_hub: '상품 도착', arrive_local: '배송 준비', out_for_delivery: '배송 출발', delivered: '배달 완료', attempt_fail: '미배달 (부재)', pickup_ready: '보관 중', picked_up: '수령 완료' },
  epost: { received: '접수', pickup: '발송', depart: '발송', arrive_hub: '도착', arrive_local: '도착', out_for_delivery: '배달준비', delivered: '배달완료', attempt_fail: '미배달 (수취인 부재)', pickup_ready: '우체국 보관', picked_up: '창구 교부' },
  intl: { received: '접수', pickup: '발송', depart: '발송', arrive_hub: '도착', arrive_local: '도착', out_for_delivery: '배달준비', delivered: '배달완료', attempt_fail: '미배달 (수취인 부재)', pickup_ready: '우체국 보관', picked_up: '창구 교부' },
  logen: { received: '접수', pickup: '집하', depart: '터미널출고', arrive_hub: '터미널입고', arrive_local: '배송점 도착', out_for_delivery: '배송출고', delivered: '배송완료', attempt_fail: '미배송 (부재)', pickup_ready: '보관 중', picked_up: '수령 완료' },
  kd: { received: '접수', pickup: '집하', depart: '간선상차', arrive_hub: '간선하차', arrive_local: '도착 영업소 입고', out_for_delivery: '배송출발', delivered: '배송완료', attempt_fail: '미배송', pickup_ready: '영업소 도착 (방문 수령)', picked_up: '고객 수령' },
  daesin: { received: '접수', pickup: '집하', depart: '발송', arrive_hub: '도착', arrive_local: '도착 영업소 입고', out_for_delivery: '배송출발', delivered: '배송완료', attempt_fail: '미배송', pickup_ready: '영업소 도착 (방문 수령)', picked_up: '고객 수령' },
  cvs: { received: '점포 접수', pickup: '집하', depart: '간선상차', arrive_hub: '간선하차', arrive_local: '배송지 도착', out_for_delivery: '점포 배송 출발', delivered: '수령 완료', attempt_fail: '미배송', pickup_ready: '점포 도착', picked_up: '수령 완료' },
  coupang: { received: '상품준비중', pickup: '집하', depart: '배송센터 출고', arrive_hub: '도착', arrive_local: '캠프 도착', out_for_delivery: '배송출발', delivered: '배송완료', attempt_fail: '미배송', pickup_ready: '보관 중', picked_up: '수령 완료' },
  express: { received: '운송장 생성', pickup: '집하', depart: '시설 출발', arrive_hub: '시설 도착', arrive_local: '배송 센터 도착', out_for_delivery: '배송 출발', delivered: '배송 완료', attempt_fail: '배송 시도 (부재)', pickup_ready: '보관 중', picked_up: '수령 완료' },
};

export function domesticMessage(family: Family, code: DomesticCode): L {
  return L(KO[family][code], EN[code]);
}

/** Where a delivered parcel was left. */
export type DeliveredWhere = 'door' | 'security' | 'locker' | 'hand';
export const WHERE_TEXT: Record<DeliveredWhere, L> = {
  door: L('문 앞', 'left at front door'),
  security: L('경비실', 'left at security office'),
  locker: L('무인택배함', 'left in parcel locker'),
  hand: L('직접 전달', 'handed to recipient'),
};

// ───────────────────────── international ─────────────────────────

export interface OriginPlace { city: L; airport: L; flightH: [number, number] }
export interface SeaRoute { city: L; port: L; arrivalPort: L; customs: L; sailH: [number, number] }

export const ORIGINS: Record<string, OriginPlace[]> = {
  CN: [
    { city: L('선전', 'Shenzhen'), airport: L('선전 바오안 국제공항', "Shenzhen Bao'an Airport"), flightH: [3, 3.8] },
    { city: L('광저우', 'Guangzhou'), airport: L('광저우 바이윈 국제공항', 'Guangzhou Baiyun Airport'), flightH: [3, 3.6] },
    { city: L('이우', 'Yiwu'), airport: L('항저우 샤오산 국제공항', 'Hangzhou Xiaoshan Airport'), flightH: [2, 2.5] },
    { city: L('상하이', 'Shanghai'), airport: L('상하이 푸둥 국제공항', 'Shanghai Pudong Airport'), flightH: [1.8, 2.2] },
    { city: L('둥관', 'Dongguan'), airport: L('선전 바오안 국제공항', "Shenzhen Bao'an Airport"), flightH: [3, 3.8] },
  ],
  US: [
    { city: L('로스앤젤레스', 'Los Angeles'), airport: L('LA 국제공항', 'Los Angeles Intl Airport'), flightH: [12.5, 13.5] },
    { city: L('뉴욕', 'New York'), airport: L('존 F. 케네디 국제공항', 'JFK Intl Airport'), flightH: [14, 15] },
    { city: L('시카고', 'Chicago'), airport: L('시카고 오헤어 국제공항', "Chicago O'Hare Airport"), flightH: [13.5, 14.5] },
    { city: L('루이빌', 'Louisville'), airport: L('루이빌 국제공항', 'Louisville Intl Airport'), flightH: [14, 15] },
  ],
  JP: [
    { city: L('도쿄', 'Tokyo'), airport: L('나리타 국제공항', 'Narita Intl Airport'), flightH: [2.3, 2.7] },
    { city: L('오사카', 'Osaka'), airport: L('간사이 국제공항', 'Kansai Intl Airport'), flightH: [1.8, 2.1] },
  ],
  DE: [
    { city: L('라이프치히', 'Leipzig'), airport: L('라이프치히/할레 공항', 'Leipzig/Halle Airport'), flightH: [11, 12] },
    { city: L('프랑크푸르트', 'Frankfurt'), airport: L('프랑크푸르트 국제공항', 'Frankfurt Airport'), flightH: [11, 11.8] },
  ],
  GB: [{ city: L('런던', 'London'), airport: L('런던 히스로 공항', 'London Heathrow Airport'), flightH: [12, 13] }],
  HK: [{ city: L('홍콩', 'Hong Kong'), airport: L('홍콩 국제공항', 'Hong Kong Intl Airport'), flightH: [3.3, 3.8] }],
  AU: [{ city: L('시드니', 'Sydney'), airport: L('시드니 공항', 'Sydney Airport'), flightH: [10, 10.8] }],
};

export const SEA_ROUTES: SeaRoute[] = [
  { city: L('웨이하이', 'Weihai'), port: L('웨이하이항', 'Weihai Port'), arrivalPort: L('평택항', 'Pyeongtaek Port'), customs: L('평택세관', 'Pyeongtaek Customs'), sailH: [14, 18] },
  { city: L('칭다오', 'Qingdao'), port: L('칭다오항', 'Qingdao Port'), arrivalPort: L('인천항', 'Incheon Port'), customs: L('인천세관', 'Incheon Customs'), sailH: [16, 22] },
];

export const INCHEON_AIRPORT = L('인천국제공항', 'Incheon Airport');
export const AIRPORT_CUSTOMS = L('인천공항세관', 'Incheon Airport Customs');

export const INTL_MSG = {
  received: L('주문 정보 접수', 'Shipment information received'),
  pickup: L('현지 물류센터 입고', 'Arrived at origin facility'),
  export_depart: L('수출 통관 완료 · 출고', 'Export cleared, departed facility'),
  airport_arrive: L('항공사 인계', 'Handed over to airline'),
  flight_depart: L('항공기 출발', 'Flight departed'),
  flight_arrive: L('인천공항 도착', 'Arrived at Incheon Airport'),
  port_arrive: L('출항지 도착', 'Arrived at departure port'),
  sail_depart: L('선박 출항', 'Vessel departed'),
  sail_arrive: L('입항', 'Vessel arrived at port'),
  customs_in: L('반입신고', 'Arrived at customs (bonded warehouse)'),
  customs_declared: L('수입신고', 'Import declaration filed'),
  customs_cleared: L('수입신고수리', 'Customs cleared'),
};

export const DELAY_MSG: Record<string, L> = {
  weather: L('기상 악화로 운송 지연', 'Delayed: severe weather'),
  hub_congestion: L('물량 증가로 터미널 처리 지연', 'Delayed: high volume at sorting hub'),
  customs_inspection: L('세관 검사 대상 선별', 'Selected for customs inspection'),
  holiday: L('연휴로 인한 배송 지연', 'Delayed: public holiday'),
};
