/**
 * Date/ETA/relative-time formatting. All text via i18n keys (engine namespace + common relative keys).
 * Times are formatted in the user's LOCAL time zone (Date local getters) — same convention as the simulation.
 */
import type { Eta, Locale, TrackingSnapshot } from '@/types';
import { t } from '@/i18n';
import { dayDiff } from './calendar';

const ts = (iso: string | Date) => (typeof iso === 'string' ? new Date(iso) : iso);

/** "10월 18일(금)" / "Fri, Oct 18" */
export function formatDate(iso: string | Date, locale: Locale): string {
  const d = ts(iso);
  return t('engine.fmt.date', {
    m: d.getMonth() + 1, d: d.getDate(), wd: t(`engine.wd.${d.getDay() + 1}`, undefined, locale), mon: t(`engine.mon.${d.getMonth() + 1}`, undefined, locale),
  }, locale);
}

/** "오후 2:05" / "2:05 PM" */
export function formatTime(iso: string | Date, locale: Locale): string {
  const d = ts(iso);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return t('engine.fmt.time', {
    ampm: t(h < 12 ? 'engine.am' : 'engine.pm', undefined, locale), h: h12, mm: String(d.getMinutes()).padStart(2, '0'),
  }, locale);
}

/** Timeline rows: "10월 16일(금) 오후 2:05" / "Fri, Oct 16, 2:05 PM" */
export function formatDateTime(iso: string | Date, locale: Locale): string {
  return t('engine.fmt.dateTime', { date: formatDate(iso, locale), time: formatTime(iso, locale) }, locale);
}

/** Hour-only label used in windows: ko "오후 2시", en "2 PM". */
function hourLabel(d: Date, locale: Locale, withAmPm = true): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = t(h < 12 ? 'engine.am' : 'engine.pm', undefined, locale);
  if (!withAmPm) return String(h12);
  return t('engine.fmt.hour', { ampm, h: h12 }, locale);
}

/** "오후 2–4시" / "2–4 PM" (rounded outward to whole hours). */
export function formatTimeWindow(earliest: Date, latest: Date, locale: Locale): string {
  const a = new Date(earliest); a.setMinutes(0, 0, 0);
  const b = new Date(latest); if (b.getMinutes() > 0 || b.getSeconds() > 0) { b.setMinutes(0, 0, 0); b.setHours(b.getHours() + 1); }
  if (b.getTime() <= a.getTime()) b.setHours(a.getHours() + 1);
  const aH = a.getHours();
  const bH = b.getDate() !== a.getDate() ? 24 : b.getHours();
  const samePart = (aH < 12 && bH < 12) || (aH >= 12 && bH >= 12 && bH < 24);
  if (samePart) {
    return t('engine.fmt.hourRange', {
      ampm: t(a.getHours() < 12 ? 'engine.am' : 'engine.pm', undefined, locale), a: hourLabel(a, locale, false), b: hourLabel(b, locale, false),
    }, locale);
  }
  return t('engine.fmt.range', { a: hourLabel(a, locale), b: hourLabel(b, locale) }, locale);
}

/** Max window (hours) for which a time-of-day range is shown (only realistic once out for delivery). */
const WINDOW_MAX_H = 5;

/**
 * Human ETA text as honest day buckets: "오늘 도착 예정", "내일 도착 예정", "오늘~내일", "10월 18일(금) 도착 예정",
 * "2–4일 후 도착 예정". A time window ("오늘 오후 2–4시") only when the window is narrow (out for delivery).
 * A delivered ETA (earliest === latest, confidence 1, in the past) reads "배송 완료" style. `now` = sim time.
 */
export function formatEta(eta: Eta | undefined, locale: Locale, now: Date): string {
  if (!eta) return t('engine.eta.unknown', undefined, locale);
  const e = new Date(eta.earliest).getTime();
  const l = new Date(eta.latest).getTime();
  const n = now.getTime();
  if (eta.confidence === 1 && e === l && l <= n) {
    return dayDiff(l, n) === 0
      ? t('engine.eta.deliveredToday', { time: formatTime(new Date(l), locale) }, locale)
      : t('engine.eta.delivered', { date: formatDate(new Date(l), locale) }, locale);
  }
  if (l < n) return t('engine.eta.soon', undefined, locale);
  const a = Math.max(0, dayDiff(n, Math.max(e, n)));
  const b = Math.max(a, dayDiff(n, l));
  if (a === 0 && b === 0) {
    if ((l - e) / 3.6e6 <= WINDOW_MAX_H) return t('engine.eta.todayWindow', { window: formatTimeWindow(new Date(Math.max(e, n)), new Date(l), locale) }, locale);
    return t('engine.eta.today', undefined, locale);
  }
  if (a === 1 && b === 1) return t('engine.eta.tomorrow', undefined, locale);
  if (a === 0 && b === 1) return t('engine.eta.todayOrTomorrow', undefined, locale);
  if (a === 1 && b === 2) return t('engine.eta.tomorrowOrNext', undefined, locale);
  if (a === b) return t('engine.eta.onDate', { date: formatDate(new Date(l), locale) }, locale);
  if (a === 0) return t('engine.eta.withinDays', { b }, locale);
  return t('engine.eta.inDays', { a, b }, locale);
}

/**
 * Status-aware ETA text for cards/headers: handles pending, pickup-ready, delivered and attempt-failed
 * before falling back to formatEta.
 */
export function formatSnapshotEta(snapshot: TrackingSnapshot | null | undefined, locale: Locale, now: Date): string {
  if (!snapshot || snapshot.status === 'pending') return t('engine.eta.pending', undefined, locale);
  if (snapshot.status === 'delivered') {
    const last = snapshot.checkpoints.at(-1);
    return formatEta(last ? { earliest: last.time, latest: last.time, confidence: 1 } : snapshot.eta, locale, now);
  }
  if (snapshot.status === 'available_for_pickup') return t('engine.eta.pickupReady', undefined, locale);
  if (snapshot.status === 'expired' || snapshot.status === 'exception') return t('engine.eta.unknown', undefined, locale);
  return formatEta(snapshot.eta, locale, now);
}

/** Relative time: "방금 전", "3분 전", "3시간 전", "2일 전"; future → "3시간 후"; older than a week → date. */
export function formatRelative(iso: string, locale: Locale, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const future = diff < -30e3;
  const m = Math.round(Math.abs(diff) / 6e4);
  if (m < 1) return t('common.justNow', undefined, locale);
  if (future) {
    if (m < 60) return t('engine.rel.inMinutes', { n: m }, locale);
    const h = Math.round(m / 60);
    if (h < 24) return t('engine.rel.inHours', { n: h }, locale);
    return t('engine.rel.inDays', { n: Math.round(h / 24) }, locale);
  }
  if (m < 60) return t('common.minutesAgo', { n: m }, locale);
  const h = Math.round(m / 60);
  if (h < 24) return t('common.hoursAgo', { n: h }, locale);
  const d = Math.round(h / 24);
  if (d <= 7) return t('common.daysAgo', { n: d }, locale);
  return formatDate(iso, locale);
}
