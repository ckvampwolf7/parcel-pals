/**
 * Service-worker registration + update flow (PWA/QA team).
 *
 * Update policy (simple and safe):
 *  1. A new SW installs in the background and WAITS (public/sw.js never calls skipWaiting by itself).
 *  2. We show one toast: "새 버전이 있어요 — 다시 열면 적용돼요".
 *  3. The next time the page is hidden (user switches away), we tell the waiting SW to activate; when it takes
 *     control we reload — still hidden, so the user never sees a flash. If control changes while visible
 *     (another tab activated it), we reload at the next hide instead.
 */
import { showToast } from '@/components/toast';
import { pwaText } from './strings';

const UPDATE_CHECK_MIN_INTERVAL_MS = 60 * 60 * 1000;

let started = false;
let waitingWorker: ServiceWorker | null = null;
let reloadOnHide = false;
let reloading = false;
let lastUpdateCheck = Date.now();

function reload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

function onUpdateReady(worker: ServiceWorker) {
  if (waitingWorker === worker) return;
  waitingWorker = worker;
  showToast({ text: pwaText('updateReady'), tone: 'neutral', durationMs: 8000 });
}

function trackInstalling(reg: ServiceWorkerRegistration, worker: ServiceWorker | null) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // Only an *update* if a SW already controls this page; the first install just becomes active silently.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(reg.waiting ?? worker);
  });
}

/** Handle messages from the SW (notification click → navigate to the parcel). */
function onSwMessage(event: MessageEvent) {
  const data = event.data as { type?: string; hash?: string } | null;
  if (data?.type === 'PP_NAVIGATE' && typeof data.hash === 'string' && data.hash.startsWith('#/')) {
    if (window.location.hash !== data.hash) window.location.hash = data.hash;
  }
}

export function initPwa(): void {
  if (started) return;
  started = true;
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.protocol === 'file:') return;

  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;
  sw.addEventListener('message', onSwMessage);
  sw.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install claiming the page — nothing to reload
    if (document.visibilityState === 'hidden') reload();
    else reloadOnHide = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (reloadOnHide) { reload(); return; }
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    } else if (Date.now() - lastUpdateCheck > UPDATE_CHECK_MIN_INTERVAL_MS) {
      lastUpdateCheck = Date.now();
      void sw.getRegistration().then((reg) => reg?.update()).catch(() => {});
    }
  });

  const register = async () => {
    try {
      const reg = await sw.register('./sw.js', { scope: './', updateViaCache: 'none' });
      if (reg.waiting && sw.controller) onUpdateReady(reg.waiting);
      trackInstalling(reg, reg.installing);
      reg.addEventListener('updatefound', () => trackInstalling(reg, reg.installing));
    } catch (err) {
      // Not fatal: the app works without a SW (just no offline support).
      console.info('[pwa] service worker registration failed', err);
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
