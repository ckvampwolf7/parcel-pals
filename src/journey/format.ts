/** Formatting + small browser helpers for the parcel detail screen. */
import type { Checkpoint, Eta, Locale } from '@/types';

const tag = (l: Locale) => (l === 'ko' ? 'ko-KR' : 'en-US');

export function fmtDate(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { month: locale === 'ko' ? 'long' : 'short', day: 'numeric', weekday: 'short' }).format(new Date(iso));
}
export function fmtTime(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
export function fmtHour(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: 'numeric' }).format(new Date(iso));
}
export function fmtDateTime(iso: string | Date, locale: Locale): string {
  return `${fmtDate(iso, locale)} ${fmtTime(iso, locale)}`;
}

/** Local calendar-day key, e.g. 2026-10-16 */
export function dayKey(d: string | Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
/** Whole days between two local dates (b - a). */
export function dayDiff(a: string | Date, b: string | Date): number {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 864e5);
}

/** ETA window text: "10월 17일 (금) 오후 2시 – 6시" / "Fri, Oct 17, 2 PM – 6 PM". */
export function fmtEtaWindow(eta: Eta, locale: Locale): string {
  const a = new Date(eta.earliest), b = new Date(eta.latest);
  if (dayKey(a) === dayKey(b)) {
    if (Math.abs(b.getTime() - a.getTime()) < 36e5 * 18) return `${fmtDate(a, locale)} ${fmtHour(a, locale)} – ${fmtHour(b, locale)}`;
    return fmtDate(a, locale);
  }
  return `${fmtDate(a, locale)} – ${fmtDate(b, locale)}`;
}

/** Newest-first checkpoints grouped by local day. */
export function groupByDay(checkpoints: Checkpoint[]): Array<{ key: string; items: Checkpoint[] }> {
  const sorted = [...checkpoints].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const groups: Array<{ key: string; items: Checkpoint[] }> = [];
  for (const c of sorted) {
    const k = dayKey(c.time);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(c);
    else groups.push({ key: k, items: [c] });
  }
  return groups;
}

/** "612345678901" → "6123 4567 8901" (digits only); other formats unchanged. */
export function prettyNumber(n: string): string {
  return /^\d{9,}$/.test(n) ? n.replace(/(\d{4})(?=\d)/g, '$1 ') : n;
}

export function trackingUrl(template: string | undefined, number: string): string | undefined {
  if (!template) return undefined;
  return template.includes('{number}') ? template.replace('{number}', encodeURIComponent(number)) : template;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
