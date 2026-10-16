/**
 * Add-parcel helpers (UI team): tracking-number extraction from pasted messages and validation.
 * Prefers the Engine team's `extractFromText` / `validateTrackingNumber` when '@/engine' exports them,
 * with local fallbacks so the screen works while the engine is mid-flight.
 */
import * as engine from '@/engine';
import { detectCarriers, normalizeTrackingNumber } from '@/engine';

export interface Extracted { trackingNumber: string; carrierId?: string; confidence: number }
export type NumberProblem = 'chars' | 'short' | 'long';

const dyn = engine as unknown as Record<string, unknown>;
const call = <T,>(name: string, ...args: unknown[]): T | undefined => {
  const fn = dyn[name];
  if (typeof fn !== 'function') return undefined;
  try { return fn(...args) as T; } catch { return undefined; }
};

/** Does the input look like a whole message (vs. a typed/pasted number)? */
export function looksLikeMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[\n\r]/.test(t) || /[가-힣ㄱ-ㅎ]/.test(t) || t.length > 40) return true;
  // several words with letters (e.g. "Your parcel 1Z… is on the way")
  return t.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w)).length >= 2;
}

const PHONE = /^0(?:1[016789]\d{7,8}|2\d{7,8}|[3-6]\d{8,9}|70\d{8}|80\d{7})$/; // KR phone numbers
const DATE = /^(?:19|20)\d{6}(?:\d{4})?$/; // 20261016 / 202610161230

function localExtract(text: string): Extracted[] {
  const found = new Map<string, Extracted>();
  const upper = text.toUpperCase();
  const add = (raw: string, boost = 0) => {
    const n = normalizeTrackingNumber(raw);
    if (n.length < 9 || n.length > 30 || PHONE.test(n) || DATE.test(n) || !/\d{6,}/.test(n)) return;
    const m = detectCarriers(n)[0];
    const confidence = Math.min(1, (m?.confidence ?? 0.2) + boost);
    const prev = found.get(n);
    if (!prev || prev.confidence < confidence) found.set(n, { trackingNumber: n, carrierId: m?.carrier.id, confidence });
  };
  // Strongly-shaped international formats first
  for (const m of upper.matchAll(/\b(?:[A-Z]{2}\d{9}[A-Z]{2}|1Z[0-9A-Z]{16}|LP\d{9,16}|YT\d{14,18}|TBA\d{9,14}|SF\d{10,15})\b/g)) add(m[0], 0.3);
  // Digit runs that may contain spaces or dashes ("6123-4567-8901")
  for (const m of upper.matchAll(/(?<![\d])\d(?:[ -]?\d){8,15}(?![\d])/g)) add(m[0], /송장|운송장|tracking|등기/i.test(text) ? 0.1 : 0);
  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Ranked tracking-number candidates found in free text (best first). */
export function extractNumbers(text: string): Extracted[] {
  const r = call<unknown>('extractFromText', text);
  if (Array.isArray(r)) {
    const list = r
      .filter((x): x is { trackingNumber: string } => !!x && typeof (x as { trackingNumber?: unknown }).trackingNumber === 'string')
      .map((x) => {
        const o = x as { trackingNumber: string; carrierId?: unknown; confidence?: unknown };
        return { trackingNumber: normalizeTrackingNumber(o.trackingNumber), carrierId: typeof o.carrierId === 'string' ? o.carrierId : undefined, confidence: typeof o.confidence === 'number' ? o.confidence : 0.5 };
      });
    return list;
  }
  return localExtract(text);
}

/** Validation problem for a normalized number, or null when it looks fine. */
export function numberProblem(n: string): NumberProblem | null {
  const r = call<unknown>('validateTrackingNumber', n);
  if (r && typeof r === 'object') {
    const o = r as { ok?: boolean; valid?: boolean; reason?: string; error?: string };
    const ok = o.ok ?? o.valid;
    if (ok === true) return null;
    const why = o.reason ?? o.error;
    const map: Record<string, NumberProblem> = { chars: 'chars', invalid_chars: 'chars', short: 'short', too_short: 'short', long: 'long', too_long: 'long', empty: 'short' };
    if (ok === false && why && map[why]) return map[why];
  }
  if (!/^[A-Z0-9]+$/.test(n) || !/\d/.test(n)) return 'chars';
  if (n.length < 8) return 'short';
  if (n.length > 30) return 'long';
  return null;
}

/** "612345678901" → "6123 4567 8901" (readability only). */
export function prettyNumber(n: string): string {
  return /^\d{9,}$/.test(n) ? n.replace(/(\d{4})(?=\d)/g, '$1 ') : n;
}
