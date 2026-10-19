/** Thin client for the sync/push server functions (PostgREST RPC + the "poll" Edge Function). No SDK needed. */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export interface SyncRow { id: string; data: Record<string, unknown> | null; modifiedAt: string; snapAt: string; snapN: number }
export type SyncChange = Omit<SyncRow, 'snapAt'> & { snapAt: string | null };
export interface SyncResult { cursor: string; rows: SyncRow[] }

export class SyncError extends Error {
  constructor(public kind: 'network' | 'server' | 'key', message?: string) { super(message ?? `sync:${kind}`); this.name = 'SyncError'; }
}

const headers = { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function post<T>(path: string, body: unknown, f: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await f(`${SUPABASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new SyncError('network', e instanceof Error ? e.message : undefined);
  }
  const text = await res.text();
  if (!res.ok) throw new SyncError(/invalid sync key/.test(text) ? 'key' : 'server', `${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

const rpc = <T>(fn: string, args: Record<string, unknown>, f?: typeof fetch) => post<T>(`/rest/v1/rpc/${fn}`, args, f);

/** Push local changes, pull everything changed since `since` (null = everything). */
export function syncRound(key: string, since: string | null, changes: SyncChange[], f?: typeof fetch): Promise<SyncResult> {
  return rpc<SyncResult>('pp_sync', { p_key: key, p_since: since, p_changes: changes }, f);
}

export async function pushPublicKey(f?: typeof fetch): Promise<string> {
  const k = await rpc<string | null>('pp_push_public_key', {}, f);
  if (k) return k;
  // First use ever: ask the server to create its key pair.
  const r = await post<{ publicKey: string }>('/functions/v1/poll', { action: 'init' }, f);
  return r.publicKey;
}

export interface PushRegistration { endpoint: string; p256dh: string; auth: string; locale: string; region: string; tz: string; quiet: boolean }

/** Register (or update) this device's push subscription: language, region and time zone shape the server's messages. */
export function pushRegister(key: string, sub: PushRegistration, f?: typeof fetch) {
  return rpc<void>('pp_push_register', { p_key: key, p_sub: sub }, f);
}

export function pushUnsubscribe(key: string, endpoint: string, f?: typeof fetch) {
  return rpc<void>('pp_push_unsubscribe', { p_key: key, p_endpoint: endpoint }, f);
}

/** Ask the server to send a test notification to this device (or all devices of the account). */
export function sendTestPush(key: string, endpoint?: string, f?: typeof fetch): Promise<{ sent: number }> {
  return post('/functions/v1/poll', { action: 'test', key, endpoint }, f);
}
