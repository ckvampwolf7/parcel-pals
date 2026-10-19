/**
 * Parcel Pals server poller (Supabase Edge Function "poll").
 *
 *  - Cron (pg_cron → pg_net, every 30 min, header x-cron-secret): for every account with a push subscription,
 *    look up its synced live parcels on tracker.delivery and send a Web Push when a parcel has a new event.
 *  - { action: 'test', key }: send a test notification to that account's devices (from Settings).
 *  - { action: 'init' }: make sure the VAPID key pair exists (the browser reads the public key via pp_push_public_key).
 *
 * The tracking/wording logic is the app's own engine, bundled into ./engine.js by scripts/build-edge.mjs.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.4';
import webpush from 'npm:web-push@3.6.7';
import { trackLive, checkpointLine, supportsLiveTracking, carrierName, setUserRegion } from './engine.js';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SUBJECT = 'https://ckvampwolf7.github.io/parcel-pals/';
const DAY = 864e5;
const MAX_LOOKUPS = 150;
const CONCURRENCY = 4;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, apikey, authorization, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS' };

type Locale = 'ko' | 'en';
interface Sub { endpoint: string; account_id: string; p256dh: string; auth: string; locale: Locale; region: 'KR' | 'US'; tz: string; quiet: boolean }
const SUB_COLS = 'endpoint, account_id, p256dh, auth, locale, region, tz, quiet';

/** 22:00–08:00 in the device's own time zone (same quiet hours as the app). */
function quietNow(s: Sub, now = new Date()): boolean {
  if (!s.quiet) return false;
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: s.tz }).format(now));
    return h >= 22 || h < 8;
  } catch { return false; }
}
// deno-lint-ignore no-explicit-any
type Parcel = any;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

async function secret(name: string): Promise<string | undefined> {
  const { data } = await sb.from('app_secrets').select('value').eq('name', name).maybeSingle();
  return data?.value;
}

async function setupVapid(): Promise<string> {
  let pub = await secret('vapid_public');
  let priv = await secret('vapid_private');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    await sb.from('app_secrets').upsert(
      [{ name: 'vapid_public', value: k.publicKey }, { name: 'vapid_private', value: k.privateKey }],
      { onConflict: 'name', ignoreDuplicates: true },
    );
    pub = await secret('vapid_public');
    priv = await secret('vapid_private');
  }
  webpush.setVapidDetails(SUBJECT, pub!, priv!);
  return pub!;
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Send one payload to every subscription; drop the ones the push service says are gone. */
async function sendAll(subs: Sub[], payloadFor: (s: Sub) => object): Promise<number> {
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payloadFor(s)), { TTL: 86400, urgency: 'normal' });
      sent++;
      await sb.from('push_subscriptions').update({ last_ok_at: new Date().toISOString(), fail_count: 0 }).eq('endpoint', s.endpoint);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      else await sb.from('push_subscriptions').update({ fail_count: 1 }).eq('endpoint', s.endpoint);
      console.warn('push failed', code, (e as Error).message);
    }
  }));
  return sent;
}

function worthPolling(p: Parcel, now: number): boolean {
  if (!p || p.archived || p.demo || !p.carrierId || !p.trackingNumber) return false;
  if (!supportsLiveTracking(p.carrierId)) return false;
  const s = p.snapshot;
  if (s?.status === 'delivered') {
    const last = s.checkpoints?.at?.(-1);
    if (!last || now - Date.parse(last.time) > DAY) return false;
  }
  return true;
}

async function poll() {
  const now = Date.now();
  const { data: subRows } = await sb.from('push_subscriptions').select(SUB_COLS);
  const subs = (subRows ?? []) as Sub[];
  const byAccount = new Map<string, Sub[]>();
  for (const s of subs) byAccount.set(s.account_id, [...(byAccount.get(s.account_id) ?? []), s]);

  type Job = { account: string; p: Parcel; last?: { last_id: string | null; last_time: string | null } };
  const jobs: Job[] = [];
  for (const account of byAccount.keys()) {
    const [{ data: rows }, { data: states }] = await Promise.all([
      sb.from('sync_parcels').select('parcel_id, data').eq('account_id', account).not('data', 'is', null),
      sb.from('push_state').select('parcel_id, last_id, last_time').eq('account_id', account),
    ]);
    const st = new Map((states ?? []).map((r) => [r.parcel_id, r]));
    for (const r of rows ?? []) if (worthPolling(r.data, now)) jobs.push({ account, p: r.data, last: st.get(r.parcel_id) });
  }

  let looked = 0, notified = 0;
  const queue = jobs.slice(0, MAX_LOOKUPS);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { account, p } = job;
      let snap;
      try { snap = await trackLive({ carrierId: p.carrierId, trackingNumber: p.trackingNumber }, { now: new Date() }); } catch { continue; }
      looked++;
      if (snap.liveStatus !== 'ok') continue;
      const newest = snap.checkpoints.at(-1);
      if (!newest) continue;
      // Baseline: what we last pushed, else the newest event the devices had already synced.
      const syncedLast = p.snapshot?.checkpoints?.at?.(-1);
      const baseline = job.last?.last_time ?? syncedLast?.time;
      const fresh = baseline ? snap.checkpoints.filter((c: { time: string }) => Date.parse(c.time) > Date.parse(baseline)) : [];
      const awake = (byAccount.get(account) ?? []).filter((s) => !quietNow(s));
      // Every device is in quiet hours: keep the news for a later run (state not advanced).
      if (fresh.length && !awake.length) continue;
      await sb.from('push_state').upsert({ account_id: account, parcel_id: p.id, last_id: newest.id, last_time: newest.time, checked_at: new Date().toISOString() });
      if (!fresh.length) continue;
      const parcel = { ...p, snapshot: snap };
      notified += await sendAll(awake, (s) => {
        setUserRegion(s.region === 'US' ? 'US' : 'KR');
        return {
          title: (p.nickname && p.nickname !== p.trackingNumber ? p.nickname : '') || `${carrierName(p.carrierId, s.locale)} ${String(p.trackingNumber).slice(-4)}`,
          body: checkpointLine(parcel, newest, s.locale),
          tag: `parcel-${p.id}`,
          hash: `#/p/${p.id}`,
        };
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { accounts: byAccount.size, parcels: jobs.length, looked, notified };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === 'init') return json({ publicKey: await setupVapid() });
    if (body?.action === 'test') {
      if (typeof body.key !== 'string' || body.key.length < 32 || body.key.length > 128) return json({ error: 'key' }, 400);
      const { data: acc } = await sb.from('sync_accounts').select('id').eq('key_hash', await sha256hex(body.key)).maybeSingle();
      if (!acc) return json({ sent: 0 });
      await setupVapid();
      let q = sb.from('push_subscriptions').select(SUB_COLS).eq('account_id', acc.id);
      if (typeof body.endpoint === 'string') q = q.eq('endpoint', body.endpoint);
      const { data: subs } = await q;
      const sent = await sendAll((subs ?? []) as Sub[], (s) => s.locale === 'en'
        ? { title: 'Parcel Pals', body: 'Notifications are on! I’ll tell you when your parcels move.', tag: 'pp-test', hash: '#/' }
        : { title: '택배친구', body: '알림이 켜졌어요! 택배가 움직이면 알려 드릴게요.', tag: 'pp-test', hash: '#/' });
      return json({ sent });
    }
    const cron = await secret('cron');
    if (!cron || req.headers.get('x-cron-secret') !== cron) return json({ error: 'unauthorized' }, 401);
    await setupVapid();
    return json(await poll());
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
