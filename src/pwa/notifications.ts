/**
 * Browser notifications + app badge (PWA/QA team).
 *
 * Rules (calm by design — see docs/research/insights.md):
 *  - only when settings.notifications is on AND permission is granted
 *  - only while the app is NOT visible (the UI shows in-app toasts when it is)
 *  - only for meaningful states: out for delivery, delivered, ready for pickup, failed attempt, exception,
 *    held in customs (customs + delayed) and carrier hand-offs — never for every hub scan
 *  - quiet hours 22:00–08:00 local time: skip the browser notification (the inbox still records it)
 *  - one notification per parcel (tag = parcel id, newer replaces older); click opens the parcel
 *  - installed-app badge (navigator.setAppBadge) mirrors the unread inbox count
 */
import type { AppEvent, Checkpoint, Parcel, StatusTag } from '@/types';
import { getInbox, getSettings, subscribe, subscribeState } from '@/store';
import { checkpointLine } from '@/engine';
import { getCurrentLocale } from '@/i18n';
import { pwaText } from './strings';
import { getSyncMeta } from '@/sync';

export const QUIET_HOURS = { start: 22, end: 8 } as const;

const ALWAYS_NOTIFY: ReadonlySet<StatusTag> = new Set<StatusTag>([
  'out_for_delivery', 'delivered', 'available_for_pickup', 'attempt_fail', 'exception',
]);
const HANDOFF_RE = /인계|이관|handed (?:over|off)|hand-?off|handover|transferred to/i;

/** Local hour within quiet hours (22:00–08:00 by default)? */
export function isQuietHours(date: Date = new Date(), quiet: { start: number; end: number } = QUIET_HOURS): boolean {
  const h = date.getHours();
  return quiet.start > quiet.end ? h >= quiet.start || h < quiet.end : h >= quiet.start && h < quiet.end;
}

/** Is this checkpoint worth interrupting the user for? */
export function isMeaningfulCheckpoint(c: Checkpoint, parcel: Pick<Parcel, 'snapshot'>): boolean {
  if (ALWAYS_NOTIFY.has(c.status)) return true;
  if (c.status === 'customs' && parcel.snapshot?.delayed) return true; // held in customs
  return HANDOFF_RE.test(c.message.ko) || HANDOFF_RE.test(c.message.en);
}

/** Newest meaningful checkpoint among the fresh ones (checkpoints are oldest-first). */
export function pickNotifiableCheckpoint(parcel: Parcel, fresh: Checkpoint[]): Checkpoint | undefined {
  for (let i = fresh.length - 1; i >= 0; i--) if (isMeaningfulCheckpoint(fresh[i], parcel)) return fresh[i];
  return undefined;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Very old Safari: callback-only API.
    return new Promise((resolve) => { void Notification.requestPermission((p) => resolve(p)); });
  }
}

interface NotifyPayload { title: string; body: string; tag: string; hash: string }

async function showBrowserNotification(p: NotifyPayload): Promise<void> {
  const options: NotificationOptions = {
    body: p.body,
    tag: p.tag,
    icon: new URL('icons/icon-192.png', document.baseURI).href,
    badge: new URL('icons/favicon-32.png', document.baseURI).href,
    data: { hash: p.hash },
    lang: getCurrentLocale(),
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg?.active) { await reg.showNotification(p.title, options); return; }
  } catch { /* fall through to the page-level API */ }
  try {
    const n = new Notification(p.title, options);
    n.onclick = () => {
      window.focus();
      window.location.hash = p.hash;
      n.close();
    };
  } catch { /* e.g. Android Chrome without a SW throws — nothing more we can do */ }
}

// ───────────── app badge (navigator.setAppBadge) ─────────────
type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
let lastBadge = -1;

/** Installed-app icon badge = unread inbox items (same number as the in-app inbox badge). Off with notifications. */
function syncBadge() {
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge) return;
  const total = getSettings().notifications ? getInbox().reduce((n, i) => n + (i.read ? 0 : 1), 0) : 0;
  if (total === lastBadge) return;
  lastBadge = total;
  const op = total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge?.();
  op?.catch(() => {});
}

export interface NotificationEnv {
  now: () => Date;
  isHidden: () => boolean;
  permission: () => NotificationPermission | 'unsupported';
  enabled: () => boolean;
  show: (p: NotifyPayload) => void | Promise<void>;
}

const defaultEnv: NotificationEnv = {
  now: () => new Date(),
  isHidden: () => document.visibilityState === 'hidden',
  permission: () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
  // With Web Push on, the server sends these (also when the app is closed) — don't show them twice.
  enabled: () => getSettings().notifications && !getSyncMeta().pushEndpoint,
  show: showBrowserNotification,
};

/** Pure-ish event handler, exported for unit tests. Returns the payload it showed (or null). */
export function createNotificationHandler(env: NotificationEnv = defaultEnv) {
  const lastNotified = new Map<string, string>(); // parcelId → checkpoint id (dedupe updated + delivered)
  return (e: AppEvent): NotifyPayload | null => {
    if (e.type === 'parcel-removed') { lastNotified.delete(e.parcelId); return null; }
    if (e.type !== 'parcel-updated' && e.type !== 'parcel-delivered') return null;
    const parcel = e.parcel;
    if (!env.enabled()) return null;
    const hidden = env.isHidden();

    const fresh = e.type === 'parcel-updated' ? e.newCheckpoints : (parcel.snapshot?.checkpoints.slice(-1) ?? []);
    const cp = pickNotifiableCheckpoint(parcel, fresh);
    if (!cp || lastNotified.get(parcel.id) === cp.id) return null;
    if (!hidden || env.permission() !== 'granted' || isQuietHours(env.now())) return null;

    lastNotified.set(parcel.id, cp.id);
    const locale = getCurrentLocale();
    const payload: NotifyPayload = {
      title: parcel.nickname || pwaText('notificationFallbackTitle', locale),
      body: checkpointLine(parcel, cp, locale),
      tag: `parcel-${parcel.id}`,
      hash: `#/p/${encodeURIComponent(parcel.id)}`,
    };
    void env.show(payload);
    return payload;
  };
}

let stop: (() => void) | null = null;

export function initNotifications(): () => void {
  if (stop) return stop;
  if (typeof window === 'undefined') return () => {};
  const handler = createNotificationHandler();
  const unsub = subscribe((e) => { handler(e); });
  const unsubState = subscribeState(syncBadge);
  syncBadge();
  stop = () => { unsub(); unsubState(); stop = null; };
  return stop;
}
