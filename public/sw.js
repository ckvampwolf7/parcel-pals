/* 택배친구 · Parcel Pals — service worker (hand-written, no Workbox). Owned by the PWA/QA team.
 *
 * This file is a TEMPLATE: `scripts/build-sw.mjs` runs after `vite build` and replaces the two marked
 * literals below with the real build version and the list of hashed files in dist/. Without that step
 * the defaults still work (app shell only; hashed assets get cached the first time they are fetched).
 *
 * Strategy
 *  - install:  precache the app shell (index.html, JS/CSS bundles, manifest, icons). Fonts are NOT precached
 *              (Pretendard ships ~90 unicode-range subsets) — they are cached on first use instead.
 *  - fetch:    same-origin GET only.
 *              navigation          → network-first (4 s timeout when a cached copy exists) → cached index.html
 *              hashed assets/fonts → cache-first, then network (and cache the response)
 *              everything else     → stale-while-revalidate
 *  - activate: delete caches from older versions, claim clients.
 *  - message:  {type:'SKIP_WAITING'} activates a waiting worker (the page decides when).
 *  - notificationclick: focus an open window on the parcel (or open one).
 */
/* eslint-disable no-restricted-globals */

const VERSION = /*__PP_VERSION__*/ 'dev' /*__PP_VERSION_END__*/;
const PRECACHE_URLS = /*__PP_PRECACHE__*/ ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'] /*__PP_PRECACHE_END__*/;

const PREFIX = 'pp-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const RUNTIME_CACHE = `${PREFIX}runtime-v1`;
const RUNTIME_MAX_ENTRIES = 200;
const NAV_TIMEOUT_MS = 4000;

const scopeUrl = new URL(self.registration ? self.registration.scope : './', self.location.href);
const toUrl = (path) => new URL(path, scopeUrl).href;
const INDEX_URL = toUrl('./index.html');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Add one by one so a single missing file (e.g. an icon not drawn yet) doesn't fail the whole install.
    await Promise.all(PRECACHE_URLS.map(async (path) => {
      try {
        const res = await fetch(new Request(toUrl(path), { cache: 'reload' }));
        if (res.ok) await cache.put(toUrl(path), res);
      } catch { /* offline during install: skip this one */ }
    }));
    // index.html is the offline fallback — make sure it really is there, else abort install (keep old SW).
    if (!(await cache.match(INDEX_URL))) throw new Error('[sw] index.html could not be precached');
  })());
  // No skipWaiting() here: the page asks for it (see src/pwa) so a running app never swaps code mid-session.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch { /* unsupported */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

const isHashedAsset = (url) => /\/assets\/[^/]+-[\w-]{6,}\.\w+$/.test(url.pathname);
const isFont = (url) => /\.(woff2?|ttf|otf)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin: let the browser handle it
  if (!url.href.startsWith(scopeUrl.href)) return;
  if (req.mode === 'navigate') { event.respondWith(handleNavigation(event)); return; }
  if (url.pathname.endsWith('/sw.js')) return;
  if (isHashedAsset(url) || isFont(url)) { event.respondWith(cacheFirst(req)); return; }
  event.respondWith(staleWhileRevalidate(req, event));
});

async function handleNavigation(event) {
  const cached = () => caches.match(INDEX_URL, { ignoreSearch: true });
  const network = (async () => {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    return fetch(event.request);
  })();
  try {
    const fallback = await cached();
    if (!fallback) return await network;
    // Network-first, but don't hang on "lie-fi": after a timeout serve the cached shell.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
    const res = await Promise.race([network.catch(() => null), timeout]);
    if (res && (res.ok || res.status < 500)) return res;
    return fallback;
  } catch {
    const fallback = await cached();
    return fallback || new Response('<!doctype html><meta charset="utf-8"><title>택배친구</title><p>오프라인이에요. 연결되면 다시 열어 주세요. · You are offline.</p>', {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).then(trimRuntime).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(req, event) {
  const shell = await caches.open(SHELL_CACHE);
  const inShell = await shell.match(req);
  const hit = inShell || (await caches.match(req));
  const refresh = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') {
      const cache = inShell ? shell : await caches.open(RUNTIME_CACHE);
      await cache.put(req, res.clone());
    }
    return res;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  return refresh;
}

async function trimRuntime() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const extra = keys.length - RUNTIME_MAX_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

// ───────────── notifications ─────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const hash = typeof data.hash === 'string' && data.hash.startsWith('#/') ? data.hash : '#/';
  const target = toUrl('./') + hash;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const inScope = windows.filter((c) => c.url.startsWith(scopeUrl.href));
    const client = inScope.find((c) => c.focused) || inScope[0];
    if (client) {
      client.postMessage({ type: 'PP_NAVIGATE', hash });
      try { await client.focus(); } catch { /* focus may be denied */ }
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
