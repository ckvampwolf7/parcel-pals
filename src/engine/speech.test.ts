import {
  SPEECH_SITUATIONS, STATUS_TAGS, characterLine, checkpointLine, describeProgress, explainStatus, moodFor, nextStepLine,
  snapshotAt, speechSituation, statusLabel, planFor,
} from '@/engine';
import { NAMESPACES, hasKey } from '@/i18n';
import type { CharacterKind, Checkpoint, Locale, Parcel, StatusTag, TrackingSnapshot } from '@/types';

const PALS: CharacterKind[] = ['truck', 'plane', 'bunny'];
const LOCALES: Locale[] = ['ko', 'en'];
const H = 3.6e6;
const T0 = new Date(2026, 9, 13, 10, 0).getTime(); // Tue local
const UNRESOLVED = /\{\w+\}/;

function parcelFor(trackingNumber: string, carrierId: string, character: CharacterKind, t: number, nickname = '새 운동화'): Parcel {
  const createdAt = new Date(T0).toISOString();
  return { id: 'p1', trackingNumber, carrierId, nickname, character, createdAt, archived: false, unread: 0,
    snapshot: snapshotAt({ trackingNumber, carrierId, createdAt }, new Date(t)) };
}

describe('i18n namespace', () => {
  it('ko and en have exactly the same keys and placeholders', () => {
    const { ko, en } = NAMESPACES.engine;
    expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(ko)) if (k !== 'fmt.date') expect([k, ph(en[k])]).toEqual([k, ph(ko[k])]);
  });
  it('every pal × situation has speech + next-step copy in both locales', () => {
    for (const l of LOCALES) for (const pal of PALS) for (const sit of SPEECH_SITUATIONS) {
      expect(hasKey(`engine.say.${pal}.${sit}.1`, l)).toBe(true);
      expect(hasKey(`engine.next.${sit}`, l)).toBe(true);
    }
  });
  it('Korean pal lines are short (≤ 60 chars after typical params) and use at most one emoji', () => {
    const { ko } = NAMESPACES.engine;
    for (const [k, v] of Object.entries(ko)) {
      if (!k.startsWith('say.') && !k.startsWith('cp.')) continue;
      const filled = v.replace('{where}', '문 앞에 살포시 두고 왔어요.').replace('{reason}', '날씨가 안 좋아서 조금 늦어지고 있어요.').replace(/\{\w+\}/g, '인천국제공항');
      expect([k, filled.length <= 62]).toEqual([k, true]);
      expect([k, (v.match(/\p{Extended_Pictographic}/gu) ?? []).length <= 1]).toEqual([k, true]);
    }
  });
  it('status labels exist for every status', () => {
    for (const s of STATUS_TAGS) for (const l of LOCALES) expect(statusLabel(s, l)).not.toMatch(/^engine\./);
  });
});

describe('characterLine & checkpointLine over real journeys', () => {
  const routes: Array<[string, string]> = [['640123456136', 'kr.cjlogistics'], ['LP00512345678918', 'cn.cainiao'], ['1Z999AA10123456784', 'us.ups'], ['612345678908', 'kr.coupangls']];
  it('every pal produces non-empty, fully-resolved ko/en lines at every moment', () => {
    const seen = new Set<string>();
    for (const [tn, c] of routes) for (const pal of PALS) {
      for (let t = T0; t < T0 + 12 * 24 * H; t += 3 * H) {
        const p = parcelFor(tn, c, pal, t);
        seen.add(speechSituation(p));
        for (const l of LOCALES) {
          const line = characterLine(p, l);
          expect(line.length).toBeGreaterThan(3);
          expect(line).not.toMatch(UNRESOLVED);
          expect(line).not.toMatch(/engine\./);
          const next = nextStepLine(p, l);
          if (next !== null) expect(next).not.toMatch(UNRESOLVED);
          expect(describeProgress(p, l)).toMatch(/%/);
        }
        for (const cp of p.snapshot!.checkpoints) for (const l of LOCALES) {
          const line = checkpointLine(p, cp, l);
          expect(line.length).toBeGreaterThan(3);
          expect(line).not.toMatch(UNRESOLVED);
          expect(explainStatus(cp, l).length).toBeGreaterThan(5);
        }
      }
    }
    for (const s of ['pending', 'infoReceived', 'moving', 'flying', 'customs', 'handoff', 'nearby', 'outForDelivery', 'delivered'] as const) expect(seen).toContain(s);
  });
  it('is deterministic (no flicker) and uses the nickname naturally', () => {
    const p = parcelFor('640123456136', 'kr.cjlogistics', 'truck', T0 + 30 * H);
    expect(characterLine(p, 'ko')).toBe(characterLine({ ...p }, 'ko'));
    const generic = { ...p, nickname: '640123456136' };
    for (let t = T0; t < T0 + 3 * 24 * H; t += H) {
      const g = { ...generic, snapshot: parcelFor('640123456136', 'kr.cjlogistics', 'truck', t).snapshot };
      expect(characterLine(g, 'ko')).not.toContain('640123456136');
    }
  });
});

describe('synthetic situations', () => {
  const stops = [
    { id: 'o', kind: 'origin' as const, name: { ko: '판매자', en: 'Seller' }, modeToNext: 'truck' as const },
    { id: 'h', kind: 'hub' as const, name: { ko: '곤지암 메가허브', en: 'Gonjiam MegaHub' }, modeToNext: 'truck' as const },
    { id: 'l', kind: 'local' as const, name: { ko: '마포 터미널', en: 'Mapo Terminal' }, modeToNext: 'bike' as const },
    { id: 'd', kind: 'destination' as const, name: { ko: '우리 집', en: 'Home' } },
  ];
  const cp = (status: StatusTag, time: string, id = 'x-1-depart'): Checkpoint => ({ id, time, status, location: { ko: '곤지암', en: 'Gonjiam' }, message: { ko: '간선상차', en: 'Departed' } });
  const mk = (over: Partial<TrackingSnapshot>, at: Date, pal: CharacterKind = 'truck'): Parcel => ({
    id: 'p', trackingNumber: '640123456136', carrierId: 'kr.cjlogistics', nickname: '선물', character: pal, createdAt: at.toISOString(), archived: false, unread: 0,
    snapshot: { status: 'in_transit', checkpoints: [cp('in_transit', at.toISOString())], stops, progress: 1 / 3, currentStopIndex: 1, currentMode: 'truck', updatedAt: at.toISOString(), ...over },
  });
  it('every pal × every status gives a line in both locales', () => {
    const at = new Date(2026, 9, 14, 14);
    for (const pal of PALS) for (const status of STATUS_TAGS) for (const l of LOCALES) {
      const p = mk({ status, checkpoints: status === 'pending' ? [] : [cp(status, at.toISOString())] }, at, pal);
      const line = characterLine(p, l);
      expect(line.length).toBeGreaterThan(3);
      expect(line).not.toMatch(UNRESOLVED);
    }
  });
  it('night at a hub → night line + sleeping; Sunday → rest-day line naming Monday', () => {
    const night = new Date(2026, 9, 14, 23, 30);
    const p = mk({}, night);
    expect(speechSituation(p)).toBe('night');
    expect(moodFor(p.snapshot)).toBe('sleeping');
    const sunday = new Date(2026, 9, 18, 14);
    const s = mk({}, sunday);
    expect(speechSituation(s)).toBe('restDay');
    expect(nextStepLine(s, 'ko')).toContain('월요일');
    expect(nextStepLine(s, 'en')).toContain('Monday');
  });
  it('delay mentions the reason; stale reassures; pickup names the place; delivered says where', () => {
    const at = new Date(2026, 9, 14, 14);
    const d = mk({ delayed: true, delayReason: 'hub_congestion' }, at);
    expect(characterLine(d, 'ko')).toContain('허브에 택배가 많아서');
    expect(moodFor(d.snapshot)).toBe('worried');
    expect(speechSituation(mk({ stale: true }, at))).toBe('stale');
    const pk = mk({ status: 'available_for_pickup', pickup: { place: { ko: 'GS25 마포역점', en: 'GS25 Mapo Station' }, kind: 'convenience_store' }, checkpoints: [cp('available_for_pickup', at.toISOString(), 'x-7-pickup_ready~convenience_store')] }, at, 'bunny');
    expect(characterLine(pk, 'ko')).toContain('GS25 마포역점');
    expect(nextStepLine(pk, 'en')).toContain('GS25 Mapo Station');
    const dl = mk({ status: 'delivered', progress: 1, currentStopIndex: 3, checkpoints: [cp('delivered', at.toISOString(), 'x-8-delivered~security')] }, at, 'plane');
    expect(characterLine(dl, 'ko')).toContain('경비실');
    expect(nextStepLine(dl, 'ko')).toBeNull();
    expect(moodFor(dl.snapshot)).toBe('celebrating');
  });
  it('handoff line mentions the partner and the new number', () => {
    const at = new Date(2026, 9, 14, 14);
    const h = mk({ handoff: { carrierId: 'kr.cjlogistics', trackingNumber: '612345678901', time: at.toISOString() }, checkpoints: [cp('in_transit', at.toISOString(), 'x-9-handover~kr.cjlogistics')] }, at, 'plane');
    const line = characterLine(h, 'ko');
    expect(line).toContain('CJ대한통운');
    expect(line).toContain('612345678901');
  });
  it('explains raw carrier jargon without a simulator code', () => {
    const raw = (ko: string): Checkpoint => ({ id: 'td-1', time: new Date().toISOString(), status: 'in_transit', location: { ko: '', en: '' }, message: { ko, en: ko } });
    expect(explainStatus(raw('간선상차'), 'ko')).toContain('큰 트럭');
    expect(explainStatus(raw('수입신고수리'), 'ko')).toContain('통관이 끝났어요');
    expect(explainStatus(raw('배달준비'), 'en')).toContain('delivery today');
  });
  it('describeProgress reads like a sentence with a percentage', () => {
    const at = new Date(2026, 9, 14, 14);
    const p = mk({ status: 'customs', progress: 0.7, currentStopIndex: 1 }, at, 'plane');
    expect(describeProgress(p, 'ko')).toBe('슝슝이가 곤지암 메가허브에서 통관 중이에요. 전체 여정의 70%예요.');
    expect(describeProgress(p, 'en')).toBe('Zoomy is clearing customs at Gonjiam MegaHub. 70% of the journey done.');
  });
  it('moodFor keeps the 1-arg call working', () => {
    expect(moodFor(null)).toBe('waiting');
    const plan = planFor({ trackingNumber: '640123456136', carrierId: 'kr.cjlogistics', createdAt: new Date(T0).toISOString() });
    expect(plan.actual.events.length).toBeGreaterThan(5);
  });
});
