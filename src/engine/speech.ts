/**
 * The pals' voice. All text comes from i18n keys in src/i18n/ns/engine.ts.
 * Variants are chosen deterministically (hash of checkpoint id + situation) so lines don't flicker on re-render.
 */
import type { CharacterKind, Checkpoint, Locale, Parcel, TrackingSnapshot } from '@/types';
import { hasKey, lt, t } from '@/i18n';
import { carrierName } from './carriers';
import { dayStart, hourOf, isRestDay, nextWorkingDay } from './calendar';
import { hashString } from './prng';
import { checkpointCode, type EventCode } from './simulator';
import { isMoving } from './status';
import { classifyCarrierText, type JargonTerm } from './statusText';

export type SpeechSituation =
  | 'pending' | 'infoReceived' | 'pickedUp' | 'moving' | 'atHub' | 'night' | 'restDay' | 'flying' | 'sailing' | 'landed'
  | 'customs' | 'customsCleared' | 'handoff' | 'nearby' | 'outForDelivery' | 'attemptFail' | 'pickupReady' | 'delivered'
  | 'delayed' | 'stale' | 'exception' | 'expired';

export const SPEECH_SITUATIONS: SpeechSituation[] = [
  'pending', 'infoReceived', 'pickedUp', 'moving', 'atHub', 'night', 'restDay', 'flying', 'sailing', 'landed', 'customs',
  'customsCleared', 'handoff', 'nearby', 'outForDelivery', 'attemptFail', 'pickupReady', 'delivered', 'delayed', 'stale',
  'exception', 'expired',
];

const PALS: CharacterKind[] = ['truck', 'plane', 'bunny'];
const palOf = (p: Parcel): CharacterKind => (PALS.includes(p.character) ? p.character : 'truck');

/** Count numbered variants `<base>.1`, `<base>.2`, … */
function variantCount(base: string, locale: Locale): number {
  let n = 0;
  while (hasKey(`${base}.${n + 1}`, locale)) n++;
  return n;
}

function pickLine(base: string, salt: string, params: Record<string, string | number>, locale: Locale): string {
  const count = variantCount(base, locale);
  if (count === 0) return '';
  const idx = (hashString(`${salt}|${base}`) % count) + 1;
  return finalize(t(`${base}.${idx}`, params, locale), locale);
}

function finalize(s: string, locale: Locale): string {
  const out = s.replace(/\s{2,}/g, ' ').trim();
  return locale === 'en' && out ? out[0].toUpperCase() + out.slice(1) : out;
}

/** True for auto-generated or number-like nicknames, which read badly inside a sentence. */
export function isGenericNickname(parcel: Pick<Parcel, 'nickname' | 'trackingNumber'>): boolean {
  const n = parcel.nickname?.trim() ?? '';
  return !n || n === parcel.trackingNumber || /\d{4,}/.test(n);
}

function nameParam(parcel: Parcel, locale: Locale): string {
  return isGenericNickname(parcel) ? t('engine.generic.name', undefined, locale) : parcel.nickname.trim();
}

function codeOf(cp: Checkpoint | undefined): { code: EventCode; detail?: string } | undefined {
  return cp ? checkpointCode(cp.id) : undefined;
}

/** Is the parcel already in Korea (after customs for international routes)? Rest days only apply there. */
function inKorea(s: TrackingSnapshot): boolean {
  const customsIdx = s.stops.findIndex((x) => x.kind === 'customs');
  return customsIdx < 0 || s.currentStopIndex >= customsIdx;
}

function restNow(s: TrackingSnapshot, now: number): boolean {
  if (!inKorea(s)) return false;
  const h = hourOf(now);
  return isRestDay(new Date(now)) || (h >= 21 && isRestDay(new Date(dayStart(now, 1))));
}

/** Which situation the pal is in right now (drives characterLine and nextStepLine). */
export function speechSituation(parcel: Parcel, now?: Date): SpeechSituation {
  const s = parcel.snapshot;
  if (!s || s.status === 'pending') return 'pending';
  const at = (now ?? new Date(s.updatedAt)).getTime();
  const last = s.checkpoints.at(-1);
  const lastCode = codeOf(last)?.code;
  switch (s.status) {
    case 'expired': return 'expired';
    case 'exception': return 'exception';
    case 'delivered': return 'delivered';
    case 'available_for_pickup': return 'pickupReady';
    case 'attempt_fail': return 'attemptFail';
    default: break;
  }
  if (s.delayed) return 'delayed';
  if (s.status === 'out_for_delivery') return 'outForDelivery';
  if (s.stale) return 'stale';
  if (s.status === 'info_received') return 'infoReceived';
  if (lastCode === 'handover' && s.handoff) return 'handoff';
  if (s.status === 'customs') return lastCode === 'customs_cleared' ? 'customsCleared' : 'customs';
  const moving = isMoving(s);
  if (moving) {
    if (s.currentMode === 'plane') return 'flying';
    if (s.currentMode === 'ship') return 'sailing';
    return 'moving';
  }
  if (restNow(s, at)) return 'restDay';
  const h = hourOf(at);
  if (h >= 22 || h < 6) return 'night';
  if (lastCode === 'pickup') return 'pickedUp';
  if (lastCode === 'flight_arrive' || lastCode === 'sail_arrive') return 'landed';
  if (s.stops[s.currentStopIndex]?.kind === 'local') return 'nearby';
  return 'atHub';
}

function speechParams(parcel: Parcel, locale: Locale, now: number): Record<string, string | number> {
  const s = parcel.snapshot;
  const stops = s?.stops ?? [];
  const idx = s?.currentStopIndex ?? 0;
  const place = lt(stops[idx]?.name, locale);
  const next = lt(stops[Math.min(idx + 1, Math.max(0, stops.length - 1))]?.name, locale);
  const partnerId = s?.handoff?.carrierId;
  const last = s?.checkpoints.at(-1);
  const lastCode = codeOf(last);
  let whereKey = 'door';
  const delivered = s?.checkpoints.find((c) => c.status === 'delivered');
  const dc = codeOf(delivered);
  if (dc?.code === 'picked_up') whereKey = 'pickup';
  else if (dc?.detail && ['door', 'security', 'locker', 'hand'].includes(dc.detail)) whereKey = dc.detail;
  const lastTime = last ? new Date(last.time).getTime() : now;
  return {
    name: nameParam(parcel, locale),
    place: place || t('engine.generic.name', undefined, locale),
    next: next || place,
    carrier: carrierName(partnerId ?? parcel.carrierId, locale),
    partner: partnerId ? carrierName(partnerId, locale) : lastCode?.detail ? carrierName(lastCode.detail, locale) : '',
    newNumber: s?.handoff?.trackingNumber ?? '',
    reason: t(`engine.reason.${s?.delayReason && hasKey(`engine.reason.${s.delayReason}`) ? s.delayReason : 'weather'}`, undefined, locale),
    where: t(`engine.where.${whereKey}`, undefined, locale),
    day: t(`engine.wdFull.${new Date(nextWorkingDay(now)).getDay() + 1}`, undefined, locale),
    pickupPlace: lt(s?.pickup?.place, locale) || place,
    hours: Math.max(1, Math.round((now - lastTime) / 3.6e6)),
  };
}

/** Speech-bubble line: what the pal says about this parcel right now (first person, 1–2 short sentences). */
export function characterLine(parcel: Parcel, locale: Locale, now?: Date): string {
  const at = now ?? (parcel.snapshot ? new Date(parcel.snapshot.updatedAt) : new Date());
  const sit = speechSituation(parcel, at);
  const salt = `${parcel.snapshot?.checkpoints.at(-1)?.id ?? parcel.id}|${sit}`;
  return pickLine(`engine.say.${palOf(parcel)}.${sit}`, salt, speechParams(parcel, locale, at.getTime()), locale);
}

// ───────────────────────── checkpoints ─────────────────────────

const CODE_TO_CP: Partial<Record<EventCode, string>> = {
  airport_arrive: 'to_port', port_arrive: 'to_port',
};
const TERM_TO_CP: Record<JargonTerm, string> = {
  returning: 'exception', exception: 'exception', delivered: 'delivered', pickup_ready: 'pickup_ready', attempt_fail: 'attempt_fail',
  out_for_delivery: 'out_for_delivery', arrive_local: 'arrive_local', customs_cleared: 'customs_cleared',
  customs_declared: 'customs_declared', customs_in: 'customs_in', handover: 'handover', depart: 'depart', arrive_hub: 'arrive_hub',
  pickup: 'pickup', received: 'received', transit: 'transit',
};
const STATUS_TO_CP: Record<string, string> = {
  pending: 'received', info_received: 'received', in_transit: 'transit', customs: 'customs_in', out_for_delivery: 'out_for_delivery',
  available_for_pickup: 'pickup_ready', attempt_fail: 'attempt_fail', delivered: 'delivered', exception: 'exception', expired: 'exception',
};

/** Key (in cp.* / explain.*) describing a checkpoint, from its simulator code or by classifying the carrier text. */
export function checkpointKind(cp: Checkpoint): string {
  const c = checkpointCode(cp.id);
  if (c) {
    if (c.code === 'out_for_delivery' && c.detail === 'retry') return 'out_for_delivery_retry';
    return CODE_TO_CP[c.code] ?? c.code;
  }
  // Live data: when the status text is generic ("In transit"), the carrier's description often says more
  // ("Arrived at FedEx location", "Departed …").
  const term = classifyCarrierText(`${cp.message.ko} ${cp.message.en}`) ?? (cp.detail ? classifyCarrierText(cp.detail) : undefined);
  if (term) return TERM_TO_CP[term];
  return STATUS_TO_CP[cp.status] ?? 'transit';
}

/** Line for one checkpoint (inbox items, notifications, toasts) in the parcel's pal voice. */
export function checkpointLine(parcel: Parcel, checkpoint: Checkpoint, locale: Locale): string {
  const kind = checkpointKind(checkpoint);
  const c = checkpointCode(checkpoint.id);
  const pal = palOf(parcel);
  const now = new Date(checkpoint.time).getTime();
  const base = speechParams(parcel, locale, now);
  const params: Record<string, string | number> = { ...base, place: lt(checkpoint.location, locale) || base.place };
  if (c?.code === 'handover' && c.detail) {
    params.partner = carrierName(c.detail, locale);
    params.newNumber = parcel.snapshot?.handoff?.trackingNumber ?? parcel.trackingNumber;
  }
  if (c?.code === 'delay' && c.detail && hasKey(`engine.reason.${c.detail}`)) params.reason = t(`engine.reason.${c.detail}`, undefined, locale);
  if (c?.code === 'delivered' && c.detail && hasKey(`engine.where.${c.detail}`)) params.where = t(`engine.where.${c.detail}`, undefined, locale);
  if (c?.code === 'picked_up') params.where = t('engine.where.pickup', undefined, locale);
  let line = pickLine(`engine.cp.${pal}.${kind}`, checkpoint.id, params, locale);
  // A handover without a new number shouldn't print an empty number.
  if (kind === 'handover' && !params.newNumber) line = finalize(t(`engine.cp.${pal}.handover.2`, params, locale), locale);
  return line || finalize(`${lt(checkpoint.message, locale)}`, locale);
}

/** Carrier jargon → one plain sentence (e.g. 간선상차 → "큰 트럭에 실려 다음 터미널로 출발했다는 뜻이에요."). */
export function explainStatus(checkpoint: Checkpoint, locale: Locale): string {
  let kind = checkpointKind(checkpoint);
  if (kind === 'out_for_delivery_retry') kind = 'out_for_delivery';
  if (!hasKey(`engine.explain.${kind}`, locale)) kind = 'transit';
  return t(`engine.explain.${kind}`, undefined, locale);
}

/** One plain sentence on what usually happens next / what to do. null once delivered. */
export function nextStepLine(parcel: Parcel, locale: Locale, now?: Date): string | null {
  const s = parcel.snapshot;
  const at = now ?? (s ? new Date(s.updatedAt) : new Date());
  const sit = speechSituation(parcel, at);
  if (sit === 'delivered') return null;
  return finalize(t(`engine.next.${sit}`, speechParams(parcel, locale, at.getTime()), locale), locale);
}

/** Screen-reader text for the journey scene, e.g. "슝슝이가 인천공항세관에서 통관 중이에요. 전체 여정의 70%예요." */
export function describeProgress(parcel: Parcel, locale: Locale): string {
  const s = parcel.snapshot;
  const pal = t(`engine.pal.${palOf(parcel)}.subj`, undefined, locale);
  if (!s || s.status === 'pending') return `${t('engine.describe.pending', { pal }, locale)} ${t('engine.describe.progress', { pct: 0 }, locale)}`;
  const idx = s.currentStopIndex;
  const place = lt(s.stops[idx]?.name, locale);
  const next = lt(s.stops[Math.min(idx + 1, s.stops.length - 1)]?.name, locale);
  let key = 'atStop';
  let where = place;
  if (s.status === 'delivered') key = 'delivered';
  else if (s.status === 'available_for_pickup') { key = 'pickup'; where = lt(s.pickup?.place, locale) || place; }
  else if (s.status === 'out_for_delivery') key = 'outForDelivery';
  else if (s.status === 'customs') key = 'customs';
  else if (isMoving(s)) key = s.currentMode === 'plane' ? 'flying' : s.currentMode === 'ship' ? 'sailing' : 'moving';
  const main = t(`engine.describe.${key}`, { pal, place: where, next }, locale);
  const pct = Math.round(Math.max(0, Math.min(1, s.progress)) * 100);
  return `${main} ${t('engine.describe.progress', { pct }, locale)}`;
}

/** Localized pal name ("붕붕이" / "Vroomy"). */
export function palName(kind: CharacterKind, locale: Locale): string {
  return t(`engine.pal.${kind}.name`, undefined, locale);
}
