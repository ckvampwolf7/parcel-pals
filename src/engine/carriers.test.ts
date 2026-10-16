import formats from '../../docs/research/carrier-formats.json';
import {
  CARRIERS, detectCarriers, extractFromText, extractShopHints, isValidMod7, isValidS10, isValidUps, normalizeTrackingNumber,
  trackingUrlFor, validateTrackingNumber,
} from '@/engine';

const STRONG = new Set(['us.ups', 'kr.epost.ems', 'kr.epost.intl', 'cn.chinapost', 'cn.ems', 'cn.cainiao', 'cn.yunexpress', 'cn.4px', 'cn.sf', 'us.amazon', 'us.usps']);

describe('carrier registry', () => {
  it('covers every carrier from research with unique ids and bilingual names', () => {
    const ids = new Set(CARRIERS.map((c) => c.id));
    expect(ids.size).toBe(CARRIERS.length);
    for (const f of formats) expect(ids.has(f.id)).toBe(true);
    for (const c of CARRIERS) { expect(c.nameKo).toBeTruthy(); expect(c.nameEn).toBeTruthy(); }
  });
  it('builds tracking urls', () => {
    expect(trackingUrlFor('kr.cjlogistics', '640123456781')).toContain('640123456781');
    expect(trackingUrlFor('kr.coupangls', '1')).toBeUndefined();
  });
});

describe('detection: research examples', () => {
  for (const f of formats) {
    it(`${f.id} example ${f.example}`, () => {
      const m = detectCarriers(f.example);
      expect(m.length).toBeGreaterThan(0);
      const ids = m.map((x) => x.carrier.id);
      // generic S10 routes to the country-specific carrier when one exists
      const expected = f.id === 'upu.s10' ? 'cn.chinapost' : f.id;
      expect(ids).toContain(expected);
      if (STRONG.has(f.id)) {
        expect(ids[0]).toBe(expected);
        expect(m[0].confidence).toBeGreaterThanOrEqual(0.85);
      }
    });
  }
});

describe('check digits', () => {
  it('validates S10', () => {
    expect(isValidS10('RR473124829US')).toBe(true);
    expect(isValidS10('EE123456785KR')).toBe(true);
    expect(isValidS10('RR473124828US')).toBe(false);
    const good = detectCarriers('RR473124829US')[0].confidence;
    const bad = detectCarriers('RR473124828US')[0].confidence;
    expect(good).toBeGreaterThan(bad);
  });
  it('validates UPS', () => {
    expect(isValidUps('1Z999AA10123456784')).toBe(true);
    expect(isValidUps('1Z999AA10123456785')).toBe(false);
    expect(detectCarriers('1Z999AA10123456784')[0].confidence).toBeGreaterThan(detectCarriers('1Z999AA10123456785')[0].confidence);
  });
  it('mod-7 boosts CJ/Lotte for 12 digits', () => {
    expect(isValidMod7('640123456781')).toBe(true);
    const valid = detectCarriers('640123456781');
    const invalid = detectCarriers('640123456782');
    const cj = (m: typeof valid) => m.find((x) => x.carrier.id === 'kr.cjlogistics')!.confidence;
    expect(cj(valid)).toBeGreaterThan(cj(invalid));
  });
});

describe('ambiguity ranking', () => {
  it('plain 12 digits → several Korean candidates, CJ first, none certain', () => {
    const m = detectCarriers('640123456781');
    expect(m.length).toBeGreaterThanOrEqual(3);
    expect(m[0].carrier.id).toBe('kr.cjlogistics');
    expect(m[0].confidence).toBeLessThan(0.7);
    expect(m.map((x) => x.carrier.id)).toEqual(expect.arrayContaining(['kr.hanjin', 'kr.lotte']));
    for (let i = 1; i < m.length; i++) expect(m[i - 1].confidence).toBeGreaterThanOrEqual(m[i].confidence);
  });
  it('11 digits → Logen first; 13 → Korea Post first', () => {
    expect(detectCarriers('30123456786')[0].carrier.id).toBe('kr.logen');
    expect(detectCarriers('6012345678901')[0].carrier.id).toBe('kr.epost');
  });
  it('strong formats return one high-confidence match', () => {
    for (const n of ['1Z999AA10123456784', 'LP00512345678901', 'YT2412345678901234']) {
      const m = detectCarriers(n);
      expect(m).toHaveLength(1);
      expect(m[0].confidence).toBeGreaterThan(0.9);
    }
  });
  it('nothing for junk', () => {
    expect(detectCarriers('')).toEqual([]);
    expect(detectCarriers('12345')).toEqual([]);
  });
});

describe('normalization & validation', () => {
  it('strips separators, full-width digits and labels', () => {
    expect(normalizeTrackingNumber(' 6401-2345-6781 ')).toBe('640123456781');
    expect(normalizeTrackingNumber('６４０１２３４５６７８１')).toBe('640123456781');
    expect(normalizeTrackingNumber('운송장번호: 1234-5678-9012')).toBe('123456789012');
    expect(normalizeTrackingNumber('1z 999 aa1 0123 456 784')).toBe('1Z999AA10123456784');
    expect(normalizeTrackingNumber('송장 LP00512345678901 입니다')).toBe('LP00512345678901');
  });
  it('validates', () => {
    expect(validateTrackingNumber('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateTrackingNumber('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateTrackingNumber('12345')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateTrackingNumber('1'.repeat(31))).toEqual({ ok: false, reason: 'too_long' });
    expect(validateTrackingNumber('가나다라')).toEqual({ ok: false, reason: 'invalid_chars' });
    expect(validateTrackingNumber('ABCDEFGHIJK')).toEqual({ ok: false, reason: 'invalid_chars' });
    expect(validateTrackingNumber('6401-2345-6781')).toEqual({ ok: true });
  });
});

describe('smart paste', () => {
  it('pulls the CJ number out of a KakaoTalk message and ignores phone numbers', () => {
    const text = '[CJ대한통운] 고객님의 상품이 배송될 예정입니다.\n운송장번호: 6123-4567-8901\n배송기사: 010-1234-5678\n문의: 1588-1255';
    const r = extractFromText(text);
    expect(r[0]).toMatchObject({ trackingNumber: '612345678901', carrierId: 'kr.cjlogistics' });
    expect(r[0].confidence).toBeGreaterThan(0.8);
    expect(r.find((x) => x.trackingNumber === '01012345678')).toBeUndefined();
  });
  it('uses the carrier keyword near the number (Hanjin) and skips order numbers / dates', () => {
    const text = '주문번호 2026101612345678 / 2026-10-16 결제완료\n한진택배 송장번호 512345678901 로 발송되었습니다.';
    const r = extractFromText(text);
    expect(r[0]).toMatchObject({ trackingNumber: '512345678901', carrierId: 'kr.hanjin' });
    expect(r.find((x) => x.trackingNumber === '20261016')).toBeUndefined();
  });
  it('handles English emails with UPS and AliExpress', () => {
    expect(extractFromText('Your order has shipped! UPS tracking: 1Z 999 AA1 0123 456 784. Questions? Call 1-800-742-5877')[0])
      .toMatchObject({ trackingNumber: '1Z999AA10123456784', carrierId: 'us.ups' });
    const ali = extractFromText('AliExpress: Order 8172635445 shipped via Cainiao. Tracking number: LP00512345678901');
    expect(ali[0]).toMatchObject({ trackingNumber: 'LP00512345678901', carrierId: 'cn.cainiao' });
  });
  it('shop prior: Temu digits → Hanjin', () => {
    const r = extractFromText('[Temu] 주문하신 상품이 출고되었습니다. 운송장: 512345678901');
    expect(r[0].carrierId).toBe('kr.hanjin');
  });
  it('shop & item hints', () => {
    expect(extractShopHints('[알리익스프레스] 상품명: 무선 키보드 외 1건')).toEqual({ shop: 'aliexpress', itemName: '무선 키보드' });
    expect(extractShopHints('nothing here')).toEqual({});
  });
  it('returns nothing for text without numbers', () => {
    expect(extractFromText('안녕하세요 택배 언제 와요?')).toEqual([]);
  });
});

describe('extractFromText ignores customer-service phone numbers (lead regression)', () => {
  it('drops 1588-xxxx 대표번호 and numbers after 고객센터/문의', async () => {
    const { extractFromText } = await import('@/engine');
    const msg = '[CJ대한통운] 주문하신 상품이 발송되었습니다.\n운송장번호: 6123-4567-8909\n배송조회: 고객센터 1588-1255\n문의 02-123-4567';
    const found = extractFromText(msg).map((c) => c.trackingNumber);
    expect(found).toEqual(['612345678909']);
  });
});
