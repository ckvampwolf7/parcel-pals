/**
 * Smart paste: pull tracking numbers out of a whole KakaoTalk 알림톡 / SMS / email blob.
 * Carrier-name keywords near a number pick the carrier; phone numbers, dates and order numbers are ignored.
 */
import { CARRIERS, detectCarriers, getCarrier } from './carriers';

export interface ExtractedNumber {
  trackingNumber: string;
  /** Best carrier guess (keywords near the number win over format-only detection). */
  carrierId?: string;
  /** 0..1 how likely this is THE tracking number in the text. */
  confidence: number;
}

export interface ShopHints {
  /** 'aliexpress' | 'temu' | 'coupang' | 'naver' | 'amazon' | 'iherb' | 'shein' | '11st' | 'gmarket' | 'musinsa' | 'ssg' */
  shop?: string;
  /** Item name if the text labels one ("상품명: …"). */
  itemName?: string;
}

const CARRIER_KEYWORDS: Array<[RegExp, string]> = [
  [/CJ\s*대한통운|대한통운|CJ\s*LOGISTICS|CJ택배|오네/g, 'kr.cjlogistics'],
  [/한진/g, 'kr.hanjin'],
  [/롯데|LOTTE/g, 'kr.lotte'],
  [/우체국|우편|EPOST|KOREA\s*POST/g, 'kr.epost'],
  [/로젠|LOGEN/g, 'kr.logen'],
  [/경동/g, 'kr.kdexp'],
  [/대신택배/g, 'kr.daesin'],
  [/GS\s*POSTBOX|편의점\s*택배|반값\s*택배|CVSNET/g, 'kr.cvsnet'],
  [/쿠팡|로켓배송|COUPANG/g, 'kr.coupangls'],
  [/\bUPS\b/g, 'us.ups'],
  [/FEDEX|페덱스/g, 'us.fedex'],
  [/\bDHL\b/g, 'de.dhl'],
  [/USPS/g, 'us.usps'],
  [/차이냐오|CAINIAO/g, 'cn.cainiao'],
  [/YUNEXPRESS|윈익스프레스/g, 'cn.yunexpress'],
  [/4PX/g, 'cn.4px'],
  [/SF\s*EXPRESS|순펑/g, 'cn.sf'],
  [/CHINA\s*POST|중국\s*우정/g, 'cn.chinapost'],
];

const SHOP_KEYWORDS: Array<[RegExp, string]> = [
  [/알리\s*익스프레스|알리익스|ALIEXPRESS/i, 'aliexpress'],
  [/테무|TEMU/i, 'temu'],
  [/쿠팡|COUPANG/i, 'coupang'],
  [/네이버|스마트스토어|NAVER/i, 'naver'],
  [/아마존|AMAZON/i, 'amazon'],
  [/아이허브|IHERB/i, 'iherb'],
  [/쉬인|SHEIN/i, 'shein'],
  [/11번가/i, '11st'],
  [/G마켓|지마켓|GMARKET/i, 'gmarket'],
  [/무신사|MUSINSA/i, 'musinsa'],
  [/SSG|쓱닷컴/i, 'ssg'],
];

/** Shop → likely domestic carrier for ambiguous digit numbers (research: Temu → Hanjin, AliExpress → CJ). */
const SHOP_CARRIER_PRIOR: Record<string, string> = { aliexpress: 'kr.cjlogistics', temu: 'kr.hanjin', coupang: 'kr.coupangls' };

const LABEL_NEAR = /(운송장|송장|등기|추적|조회|TRACKING|WAYBILL|AWB|INVOICE|번호\s*[:：])/;
const NEGATIVE_NEAR = /(주문\s*번호|주문번호|ORDER|결제|승인|전화|연락처|TEL|휴대폰|문의|고객센터|사업자|계좌|우편번호|인증)/;

function nearestKeywordCarrier(text: string, start: number, end: number): string | undefined {
  let best: { id: string; dist: number } | undefined;
  for (const [re, id] of CARRIER_KEYWORDS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const ks = m.index ?? 0;
      const ke = ks + m[0].length;
      const dist = ke <= start ? start - ke : ks >= end ? (ks - end) * 1.5 : 0; // prefer keywords before the number
      if (dist <= 80 && (!best || dist < best.dist)) best = { id, dist };
    }
  }
  return best?.id;
}

/** Shop + item-name hints from a pasted message. */
export function extractShopHints(text: string): ShopHints {
  const out: ShopHints = {};
  for (const [re, shop] of SHOP_KEYWORDS) if (re.test(text)) { out.shop = shop; break; }
  const item = /(?:상품명|품명|상품|ITEM|PRODUCT)\s*[:：]\s*([^\n\r]+)/i.exec(text);
  if (item) {
    const name = item[1].replace(/\s+(외|and)\s*\d+.*$/i, '').trim().slice(0, 40).trim();
    if (name) out.itemName = name;
  }
  return out;
}

/**
 * Tracking numbers found in free text, best first.
 * `carrierId` is set when a carrier keyword is near the number or the format is unambiguous.
 */
export function extractFromText(text: string): ExtractedNumber[] {
  if (!text) return [];
  const a = text.normalize('NFKC').toUpperCase();
  const hints = extractShopHints(text);
  const results = new Map<string, ExtractedNumber>();
  const re = /[A-Z0-9]+(?:[ \-–—.][A-Z0-9]+)*/g;
  for (const m of a.matchAll(re)) {
    const raw = m[0];
    const start = m.index ?? 0;
    // A run like "운송장번호 6123 4567 8901" is one number; "1Z… 2026.10.16" is two. Try the whole run, then each word.
    const pieces: Array<{ s: string; off: number }> = [{ s: raw, off: 0 }];
    if (/\s/.test(raw)) {
      let off = 0;
      for (const w of raw.split(/(\s+)/)) { if (w.trim()) pieces.push({ s: w, off }); off += w.length; }
    }
    for (const { s, off } of pieces) {
      const n = s.replace(/[\s\-–—.]+/g, '');
      if (n.length < 8 || n.length > 30 || !/\d/.test(n) || !/^[A-Z0-9]+$/.test(n)) continue;
      const pStart = start + off;
      const pEnd = pStart + s.length;
      if (/^0\d{1,2}-\d{3,4}-\d{4}$/.test(s) || /^01[016789]\d{7,8}$/.test(n)) continue; // phone numbers
      if (/^1[5-8]\d{2}-?\d{4}$/.test(s)) continue; // nationwide 대표번호 like 1588-1255 (customer-service lines)
      if (/(고객\s*센터|콜\s*센터|문의|전화|연락처|tel|phone|call|☎|📞)[\s:：.\-]*$/i.test(a.slice(Math.max(0, pStart - 12), pStart))) continue; // number right after a phone label
      if (/^(19|20)\d{2}[-.]?\d{2}[-.]?\d{2}$/.test(s) || /^(19|20)\d{6}$/.test(n)) continue; // dates
      if (/^\d{1,2}:\d{2}/.test(s)) continue;
      const before = a.slice(Math.max(0, pStart - 24), pStart);
      const matches = detectCarriers(n);
      let confidence = matches[0]?.confidence ?? 0;
      let carrierId = matches[0]?.carrier.id;
      if (!matches.length) confidence = /^\d+$/.test(n) ? 0.1 : 0.05;
      const kw = nearestKeywordCarrier(a, pStart, pEnd);
      if (kw) {
        // Korea Post keyword + S10 number → the S10-specific entry already wins.
        const plausible = matches.find((x) => x.carrier.id === kw) ?? (kw === 'kr.epost' ? matches.find((x) => x.carrier.id.startsWith('kr.epost')) : undefined);
        if (plausible) { carrierId = plausible.carrier.id; confidence = Math.max(confidence, Math.min(0.97, plausible.confidence + 0.45)); }
        else if (!matches.length || matches[0].confidence < 0.6) { carrierId = getCarrier(kw) ? kw : carrierId; confidence = Math.max(confidence, 0.5); }
      } else if (hints.shop && SHOP_CARRIER_PRIOR[hints.shop]) {
        const prior = matches.find((x) => x.carrier.id === SHOP_CARRIER_PRIOR[hints.shop!]);
        if (prior && matches[0].confidence < 0.7) { carrierId = prior.carrier.id; confidence = Math.max(confidence, prior.confidence + 0.2); }
      }
      if (LABEL_NEAR.test(before)) confidence += 0.15;
      if (NEGATIVE_NEAR.test(before) && !LABEL_NEAR.test(before.slice(-12))) confidence -= 0.45;
      confidence = Math.round(Math.max(0, Math.min(0.99, confidence)) * 100) / 100;
      if (confidence < 0.12) continue;
      const prev = results.get(n);
      if (!prev || prev.confidence < confidence) results.set(n, { trackingNumber: n, carrierId, confidence });
    }
  }
  // Drop numbers that are substrings of a better (longer) candidate, e.g. one word of a spaced number.
  const all = [...results.values()];
  return all
    .filter((r) => !all.some((o) => o !== r && o.trackingNumber.length > r.trackingNumber.length && o.trackingNumber.includes(r.trackingNumber) && o.confidence >= r.confidence - 0.05))
    .sort((x, y) => y.confidence - x.confidence);
}

/** Carriers whose names appear in a text (for UI hints). */
export function carriersMentioned(text: string): string[] {
  const a = text.normalize('NFKC').toUpperCase();
  const ids: string[] = [];
  for (const [re, id] of CARRIER_KEYWORDS) { re.lastIndex = 0; if (re.test(a) && !ids.includes(id)) ids.push(id); }
  return ids.filter((id) => CARRIERS.some((c) => c.id === id));
}
