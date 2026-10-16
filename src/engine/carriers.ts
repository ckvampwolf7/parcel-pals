/**
 * Carrier registry + tracking-number normalization, validation and detection.
 * Formats come from docs/research/carrier-formats.json. Korean plain-digit numbers are ambiguous:
 * detection returns RANKED candidates; strong formats (1Z…, S10, LP…) return one high-confidence match.
 */
import type { Carrier, CarrierMatch, CharacterKind } from '@/types';

export const CARRIERS: Carrier[] = [
  // ── Korean domestic
  { id: 'kr.cjlogistics', nameKo: 'CJ대한통운', nameEn: 'CJ Logistics', country: 'KR', scope: 'domestic', color: '#1f5fbf',
    trackingUrl: 'https://trace.cjlogistics.com/next/tracking.html?wblNo={number}' },
  { id: 'kr.hanjin', nameKo: '한진택배', nameEn: 'Hanjin', country: 'KR', scope: 'domestic', color: '#0a6ab6',
    trackingUrl: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2={number}' },
  { id: 'kr.lotte', nameKo: '롯데택배', nameEn: 'Lotte Global Logistics', country: 'KR', scope: 'domestic', color: '#e0322b',
    trackingUrl: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo={number}' },
  { id: 'kr.epost', nameKo: '우체국택배', nameEn: 'Korea Post', country: 'KR', scope: 'domestic', color: '#e8462e',
    trackingUrl: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={number}' },
  { id: 'kr.logen', nameKo: '로젠택배', nameEn: 'Logen', country: 'KR', scope: 'domestic', color: '#f08300',
    trackingUrl: 'https://www.ilogen.com/web/personal/trace/{number}' },
  { id: 'kr.coupangls', nameKo: '쿠팡 로켓배송', nameEn: 'Coupang Rocket Delivery', country: 'KR', scope: 'domestic', color: '#d9232d' },
  { id: 'kr.kdexp', nameKo: '경동택배', nameEn: 'Kyungdong Express', country: 'KR', scope: 'domestic', color: '#11884a',
    trackingUrl: 'https://kdexp.com/service/delivery/etc/delivery.do?barcode={number}' },
  { id: 'kr.daesin', nameKo: '대신택배', nameEn: 'Daesin Logistics', country: 'KR', scope: 'domestic', color: '#2b4d9b',
    trackingUrl: 'https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno={number}' },
  { id: 'kr.cvsnet', nameKo: 'GS Postbox 편의점택배', nameEn: 'GS Postbox (convenience store)', country: 'KR', scope: 'domestic', color: '#0098d8',
    trackingUrl: 'https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no={number}' },
  // ── International
  { id: 'kr.epost.ems', nameKo: '우체국 EMS', nameEn: 'Korea Post EMS', country: 'KR', scope: 'international', color: '#f08c00',
    trackingUrl: 'https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE={number}' },
  { id: 'kr.epost.intl', nameKo: '우체국 국제우편', nameEn: 'Korea Post International', country: 'KR', scope: 'international', color: '#e8462e',
    trackingUrl: 'https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE={number}' },
  { id: 'cn.cainiao', nameKo: '차이냐오 (알리익스프레스)', nameEn: 'Cainiao (AliExpress)', country: 'CN', scope: 'international', color: '#ff6a00',
    trackingUrl: 'https://global.cainiao.com/newDetail.htm?mailNoList={number}' },
  { id: 'cn.yunexpress', nameKo: '윈익스프레스', nameEn: 'YunExpress', country: 'CN', scope: 'international', color: '#1d4fa3',
    trackingUrl: 'https://www.yuntrack.com/parcelTracking?id={number}' },
  { id: 'cn.chinapost', nameKo: '중국우정', nameEn: 'China Post', country: 'CN', scope: 'international', color: '#0b7a3e',
    trackingUrl: 'https://t.17track.net/en#nums={number}' },
  { id: 'cn.ems', nameKo: '중국 EMS', nameEn: 'China EMS', country: 'CN', scope: 'international', color: '#f08c00',
    trackingUrl: 'https://t.17track.net/en#nums={number}' },
  { id: 'cn.4px', nameKo: '4PX', nameEn: '4PX Express', country: 'CN', scope: 'international', color: '#d7141a',
    trackingUrl: 'https://track.4px.com/#/result/0/{number}' },
  { id: 'cn.sf', nameKo: 'SF익스프레스', nameEn: 'SF Express', country: 'CN', scope: 'international', color: '#222222',
    trackingUrl: 'https://www.sf-express.com/we/ow/chn/en/waybill/waybill-detail/{number}' },
  // Test carrier from tracker.delivery (hidden from pickers; added via Settings → "연결 테스트")
  { id: 'dev.track.dummy', nameKo: '테스트 택배사', nameEn: 'Test carrier', country: 'INTL', scope: 'domestic', color: '#8f8baa' },
  { id: 'us.ups', nameKo: 'UPS', nameEn: 'UPS', country: 'US', scope: 'international', color: '#5a3a1e',
    trackingUrl: 'https://www.ups.com/track?tracknum={number}' },
  { id: 'us.fedex', nameKo: '페덱스', nameEn: 'FedEx', country: 'US', scope: 'international', color: '#4d148c',
    trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr={number}' },
  { id: 'de.dhl', nameKo: 'DHL 익스프레스', nameEn: 'DHL Express', country: 'DE', scope: 'international', color: '#d40511',
    trackingUrl: 'https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={number}' },
  { id: 'us.usps', nameKo: '미국 우정청 (USPS)', nameEn: 'USPS', country: 'US', scope: 'international', color: '#333366',
    trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={number}' },
  { id: 'us.amazon', nameKo: '아마존 로지스틱스', nameEn: 'Amazon Logistics', country: 'US', scope: 'international', color: '#e88a00',
    trackingUrl: 'https://track.amazon.com/tracking/{number}' },
  { id: 'upu.s10', nameKo: '국제우편', nameEn: 'International Post', country: 'INTL', scope: 'international', color: '#6b6b8a',
    trackingUrl: 'https://t.17track.net/en#nums={number}' },
];

const BY_ID = new Map(CARRIERS.map((c) => [c.id, c]));

export function getCarrier(id: string): Carrier | undefined {
  return BY_ID.get(id);
}

/** Localized carrier name. */
export function carrierName(id: string, locale: 'ko' | 'en'): string {
  const c = BY_ID.get(id);
  if (!c) return id;
  return locale === 'ko' ? c.nameKo : c.nameEn;
}

/** Public tracking page for a parcel, or undefined if the carrier has no deep link. */
export function trackingUrlFor(carrierId: string, trackingNumber: string): string | undefined {
  const tpl = BY_ID.get(carrierId)?.trackingUrl;
  return tpl ? tpl.replace('{number}', encodeURIComponent(trackingNumber)) : undefined;
}

/** Character used when the user leaves it on 'auto'. */
export function autoCharacter(carrier: Carrier | undefined): CharacterKind {
  return carrier?.scope === 'international' ? 'plane' : 'truck';
}

// ───────────────────────── normalization & validation ─────────────────────────

const SEP = /[\s\-–—_.·/]+/g;
const PHONE = /^0(1[016789]|2|[3-6][1-5]|70|80)\d{6,8}$/;

/** Full-width → ASCII, uppercase. */
function toAscii(input: string): string {
  return input.normalize('NFKC').toUpperCase();
}

function looksLikeTrackingToken(n: string): boolean {
  return n.length >= 8 && n.length <= 30 && /\d/.test(n) && /^[A-Z0-9]+$/.test(n);
}

/**
 * Normalize user input to a bare tracking number:
 * full-width digits/letters → ASCII, uppercase, strip spaces/dashes/dots, and pull the number out of
 * pasted text like "운송장번호: 1234-5678-9012" (prefers tokens that match a known carrier format).
 */
export function normalizeTrackingNumber(input: string): string {
  const a = toAscii(input).trim();
  const whole = a.replace(SEP, '');
  if (/^[A-Z0-9]*$/.test(whole)) return whole;
  const tokens = tokenize(a);
  if (tokens.length === 0) return whole.replace(/[^A-Z0-9]/g, '');
  const scored = tokens
    .map((t) => ({ t, s: (detectRaw(t)[0]?.confidence ?? 0) + Math.min(t.length, 22) / 100 }))
    .sort((x, y) => y.s - x.s);
  return scored[0].t;
}

/** Candidate number tokens inside free text (separators inside a number are allowed). */
export function tokenize(text: string): string[] {
  const a = toAscii(text);
  const out: string[] = [];
  const re = /[A-Z0-9]+(?:[ \-–—.][A-Z0-9]+)*/g;
  for (const m of a.matchAll(re)) {
    const raw = m[0];
    // split a run of space-separated words into a numeric core: try the whole run and each word
    const variants = new Set<string>([raw.replace(SEP, '')]);
    for (const part of raw.split(/\s+/)) variants.add(part.replace(SEP, ''));
    for (const v of variants) {
      if (!looksLikeTrackingToken(v)) continue;
      if (/^\d{3}-\d{3,4}-\d{4}$/.test(raw) && raw.startsWith('0')) continue; // phone number
      if (PHONE.test(v) && /^\d+$/.test(v) && v.length <= 11) continue;
      out.push(v);
    }
  }
  return [...new Set(out)];
}

export type TrackingValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'invalid_chars' };

export const MIN_TRACKING_LENGTH = 8;
export const MAX_TRACKING_LENGTH = 30;

/** Validate user input (after normalization). Does not require a known carrier format. */
export function validateTrackingNumber(input: string): TrackingValidation {
  if (!input || !input.trim()) return { ok: false, reason: 'empty' };
  const n = normalizeTrackingNumber(input);
  if (!n || !/\d/.test(n)) return { ok: false, reason: 'invalid_chars' };
  if (n.length < MIN_TRACKING_LENGTH) return { ok: false, reason: 'too_short' };
  if (n.length > MAX_TRACKING_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

// ───────────────────────── check digits ─────────────────────────

/** UPU S10 check digit for the 8-digit serial. */
export function s10CheckDigit(serial8: string): number {
  const w = [8, 6, 4, 2, 3, 5, 9, 7];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(serial8[i]) * w[i];
  const c = 11 - (sum % 11);
  return c === 10 ? 0 : c === 11 ? 5 : c;
}
export function isValidS10(n: string): boolean {
  const m = /^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/.exec(n);
  return !!m && s10CheckDigit(m[1]) === Number(m[2]);
}

/** UPS 1Z check digit (Luhn-like over the 15 chars after "1Z"). */
export function upsCheckDigit(body15: string): number {
  let sum = 0;
  for (let i = 0; i < body15.length; i++) {
    const ch = body15[i];
    const v = /\d/.test(ch) ? Number(ch) : (ch.charCodeAt(0) - 63) % 10;
    sum += i % 2 === 1 ? v * 2 : v;
  }
  return (10 - (sum % 10)) % 10;
}
export function isValidUps(n: string): boolean {
  const m = /^1Z([0-9A-Z]{15})(\d)$/.exec(n);
  return !!m && upsCheckDigit(m[1]) === Number(m[2]);
}

/** Reported Korean rule (CJ/Lotte 12-digit, Logen 11-digit, DHL 10-digit): last digit = (rest as integer) mod 7. */
export function isValidMod7(n: string): boolean {
  if (!/^\d+$/.test(n) || n.length < 2) return false;
  return Number(n.slice(0, -1)) % 7 === Number(n.slice(-1));
}
/** Append a mod-7 check digit to a numeric body. */
export function withMod7(body: string): string {
  return body + String(Number(body) % 7);
}
/** Build a valid S10 number from prefix, 8-digit serial and country. */
export function makeS10(prefix: string, serial8: string, country: string): string {
  return `${prefix}${serial8}${s10CheckDigit(serial8)}${country}`;
}

// ───────────────────────── detection ─────────────────────────

type Score = [id: string, confidence: number];

function detectRaw(n: string): CarrierMatch[] {
  const scores: Score[] = [];
  const add = (id: string, c: number) => scores.push([id, c]);

  if (/^1Z[0-9A-Z]{16}$/.test(n)) add('us.ups', isValidUps(n) ? 0.99 : 0.75);
  else if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(n)) {
    const ok = isValidS10(n);
    const base = ok ? 0.97 : 0.55;
    const country = n.slice(-2);
    const ems = n[0] === 'E';
    if (country === 'KR') add(ems ? 'kr.epost.ems' : 'kr.epost.intl', base);
    else if (country === 'CN') { if (ems) { add('cn.ems', base); add('cn.chinapost', base - 0.35); } else add('cn.chinapost', base); }
    else if (country === 'US') add('us.usps', base);
    else add('upu.s10', base);
    if (country !== 'KR') add('kr.epost.intl', 0.15); // handed to Korea Post with the same number on arrival
  } else if (/^LP\d{14}(CN)?$/.test(n)) add('cn.cainiao', 0.93);
  else if (/^(CAINIAO|AEKR)[A-Z0-9]{6,}$/.test(n)) add('cn.cainiao', 0.8);
  else if (/^YT\d{16}$/.test(n)) add('cn.yunexpress', 0.93);
  else if (/^4PX\d{10,15}CN$/.test(n)) add('cn.4px', 0.93);
  else if (/^SF\d{12,13}$/.test(n)) add('cn.sf', 0.92);
  else if (/^TBA\d{12}$/.test(n)) add('us.amazon', 0.92);
  else if (/^(9[1-5]\d{18,20}|420\d{5}(\d{4})?9[1-5]\d{18,20})$/.test(n)) {
    add('us.usps', 0.85);
    if (n.length === 20 || n.length === 22) add('us.fedex', 0.25);
  } else if (/^\d+$/.test(n)) {
    const m7 = isValidMod7(n);
    switch (n.length) {
      case 10:
        add('kr.cjlogistics', 0.36); add('kr.hanjin', 0.32); add('de.dhl', m7 ? 0.24 : 0.1);
        add('kr.cvsnet', 0.12); add('kr.kdexp', 0.06);
        break;
      case 11:
        add('kr.logen', m7 ? 0.86 : 0.7); add('kr.kdexp', 0.1);
        break;
      case 12:
        add('kr.cjlogistics', m7 ? 0.58 : 0.4); add('kr.hanjin', m7 ? 0.28 : 0.36); add('kr.lotte', m7 ? 0.4 : 0.26);
        add('us.fedex', 0.1); add('kr.coupangls', 0.08); add('kr.cvsnet', 0.06); add('kr.kdexp', 0.04);
        break;
      case 13:
        add('kr.epost', 0.72); add('kr.daesin', 0.2); add('kr.coupangls', 0.14); add('kr.kdexp', 0.05);
        break;
      case 14:
        add('kr.coupangls', 0.55); add('kr.kdexp', 0.2);
        break;
      case 15:
        add('us.fedex', 0.75);
        break;
      case 20: case 22:
        add('us.fedex', 0.45);
        break;
      default:
        break;
    }
  }
  const order = new Map(CARRIERS.map((c, i) => [c.id, i]));
  const best = new Map<string, number>();
  for (const [id, c] of scores) best.set(id, Math.max(best.get(id) ?? 0, c));
  return [...best.entries()]
    .map(([id, c]) => ({ carrier: BY_ID.get(id)!, confidence: Math.round(Math.min(0.99, Math.max(0.01, c)) * 100) / 100 }))
    .filter((m) => m.carrier)
    .sort((a, b) => b.confidence - a.confidence || (order.get(a.carrier.id)! - order.get(b.carrier.id)!));
}

/**
 * Ranked carrier candidates for a tracking number (best first). Empty if nothing plausible.
 * Accepts messy input (spaces, dashes, full-width digits, pasted labels).
 */
export function detectCarriers(input: string): CarrierMatch[] {
  const n = normalizeTrackingNumber(input);
  if (n.length < MIN_TRACKING_LENGTH) return [];
  return detectRaw(n);
}

/** Best guess carrier id for a number, or undefined. */
export function bestCarrierId(input: string): string | undefined {
  return detectCarriers(input)[0]?.carrier.id;
}
