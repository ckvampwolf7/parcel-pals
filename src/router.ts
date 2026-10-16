/**
 * Minimal hash router (works on static hosting / file:// and inside PWAs).
 * Routes:  #/  home · #/add  add parcel (?n=<number> prefill) · #/p/<id>  parcel detail · #/inbox · #/settings
 */
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'add'; prefill?: string }
  | { name: 'parcel'; id: string }
  | { name: 'inbox' }
  | { name: 'settings' }
  | { name: 'notFound'; path: string };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const q = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'add') return { name: 'add', prefill: q.get('n') ?? undefined };
  if (parts[0] === 'p' && parts[1]) return { name: 'parcel', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'inbox') return { name: 'inbox' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'notFound', path };
}

const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseRoute(hash);
}

/** navigate('/p/abc') · navigate('/', { replace: true }) */
export function navigate(path: string, opts?: { replace?: boolean }) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (opts?.replace) window.location.replace(target);
  else window.location.hash = target;
}

/** Go back if there is in-app history, otherwise to home. */
export function goBack() {
  if (window.history.length > 1 && document.referrer !== '' ) window.history.back();
  else navigate('/', { replace: true });
}

export const href = (path: string) => '#' + (path.startsWith('/') ? path : '/' + path);
