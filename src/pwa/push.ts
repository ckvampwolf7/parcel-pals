/**
 * Web Push: lets the server (supabase/functions/poll) notify this device about parcel news while the app is closed.
 * Needs cloud sync (the server only knows parcels it has seen) and, on iPhone/iPad, the app added to the Home Screen
 * (iOS 16.4+). The service worker shows the notifications (public/sw.js, 'push').
 */
import { getSettings, subscribeState } from '@/store';
import { getSyncMeta } from '@/sync';
import { pushPublicKey, pushRegister, pushUnsubscribe, sendTestPush } from '@/sync/api';

export type PushSupport = 'ok' | 'ios-install' | 'unsupported';

const isIos = () => typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos() && !isStandalone()) return 'ios-install';
  return ok ? 'ok' : 'unsupported';
}

function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 10_000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

function details(sub: PushSubscription) {
  const j = sub.toJSON();
  const s = getSettings();
  return {
    endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '',
    locale: s.locale, region: s.region, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul', quiet: true,
  };
}

/** Ask permission, subscribe and register with the server. Returns the endpoint. */
export async function enablePush(key: string): Promise<{ ok: true; endpoint: string } | { ok: false; reason: 'denied' | 'unsupported' | 'ios-install' | 'error' }> {
  const support = pushSupport();
  if (support !== 'ok') return { ok: false, reason: support };
  try {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'denied' };
    const reg = await registration();
    const appKey = b64uToBytes(await pushPublicKey());
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, appKey)) { await sub.unsubscribe(); sub = null; }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await pushRegister(key, details(sub));
    return { ok: true, endpoint: sub.endpoint };
  } catch (e) {
    console.warn('[push] enable failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function disablePush(key: string | undefined, endpoint: string | undefined): Promise<void> {
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* no SW / already gone */ }
  if (key && endpoint) { try { await pushUnsubscribe(key, endpoint); } catch { /* offline: server drops it on the next 410 */ } }
}

export function testPush(key: string, endpoint: string): Promise<{ sent: number }> {
  return sendTestPush(key, endpoint);
}

/** Keep the server's copy of language / region / time zone current while push is on. */
export function startPushUpkeep(): () => void {
  let last = '';
  const check = async () => {
    const m = getSyncMeta();
    if (!m.key || !m.pushEndpoint || pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
    const s = getSettings();
    const sig = `${m.key}|${s.locale}|${s.region}`;
    if (sig === last) return;
    last = sig;
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) await pushRegister(m.key, details(sub));
    } catch { last = ''; }
  };
  void check();
  return subscribeState(() => void check());
}
