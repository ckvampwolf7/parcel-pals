/**
 * localStorage persistence: key `parcel-pals:v1`, versioned, defensive.
 * Anything malformed is dropped field-by-field; unparseable / future-version data resets gracefully.
 */
import type { CharacterKind, InboxItem, Parcel, Settings, StatusTag } from '@/types';
import type { SimClockState } from '@/engine';

export const STORAGE_KEY = 'parcel-pals:v1';
export const STORAGE_VERSION = 1;
export const INBOX_CAP = 200;

export interface PersistedState {
  version: number;
  parcels: Parcel[];
  settings: Settings;
  inbox: InboxItem[];
  clock?: SimClockState;
}

const CHARS: CharacterKind[] = ['truck', 'plane', 'bunny'];
const STATUSES: StatusTag[] = ['pending', 'info_received', 'in_transit', 'customs', 'out_for_delivery', 'available_for_pickup', 'attempt_fail', 'delivered', 'exception', 'expired'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const isIso = (v: unknown): v is string => str(v) && !Number.isNaN(Date.parse(v));

function storage(): Storage | undefined {
  try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; }
}

export function sanitizeSettings(raw: unknown, defaults: Settings): Settings {
  const s = { ...defaults };
  if (!isObj(raw)) return s;
  if (raw.locale === 'ko' || raw.locale === 'en') s.locale = raw.locale;
  if (raw.defaultCharacter === 'auto' || CHARS.includes(raw.defaultCharacter as CharacterKind)) s.defaultCharacter = raw.defaultCharacter as Settings['defaultCharacter'];
  if (typeof raw.notifications === 'boolean') s.notifications = raw.notifications;
  if (typeof raw.demoSpeed === 'number' && Number.isFinite(raw.demoSpeed) && raw.demoSpeed > 0 && raw.demoSpeed <= 100000) s.demoSpeed = raw.demoSpeed;
  if (typeof raw.refreshIntervalSec === 'number' && Number.isFinite(raw.refreshIntervalSec) && raw.refreshIntervalSec >= 2) s.refreshIntervalSec = raw.refreshIntervalSec;
  if (raw.theme === 'system' || raw.theme === 'light' || raw.theme === 'dark') s.theme = raw.theme;
  if (raw.reduceMotion === 'system' || raw.reduceMotion === 'on' || raw.reduceMotion === 'off') s.reduceMotion = raw.reduceMotion;
  if (typeof raw.onboarded === 'boolean') s.onboarded = raw.onboarded;
  if (typeof raw.liveRefreshMin === 'number' && Number.isFinite(raw.liveRefreshMin) && raw.liveRefreshMin >= 1 && raw.liveRefreshMin <= 1440) s.liveRefreshMin = raw.liveRefreshMin;
  if (typeof raw.trackerApiKey === 'string' && raw.trackerApiKey.trim()) s.trackerApiKey = raw.trackerApiKey.trim();
  if (raw.region === 'KR' || raw.region === 'US') s.region = raw.region;
  return s;
}

function sanitizeSnapshot(raw: unknown): Parcel['snapshot'] {
  if (!isObj(raw)) return null;
  if (!Array.isArray(raw.checkpoints) || !Array.isArray(raw.stops) || !STATUSES.includes(raw.status as StatusTag)) return null;
  const checkpoints = raw.checkpoints.filter((c) => isObj(c) && str(c.id) && isIso(c.time) && STATUSES.includes(c.status as StatusTag) && isObj(c.message) && isObj(c.location));
  const stops = raw.stops.filter((s) => isObj(s) && str(s.id) && isObj(s.name));
  if (!stops.length) return null;
  const progress = typeof raw.progress === 'number' && Number.isFinite(raw.progress) ? Math.min(1, Math.max(0, raw.progress)) : 0;
  const idx = typeof raw.currentStopIndex === 'number' ? Math.min(stops.length - 1, Math.max(0, Math.floor(raw.currentStopIndex))) : 0;
  return {
    ...(raw as unknown as NonNullable<Parcel['snapshot']>),
    checkpoints: checkpoints as unknown as NonNullable<Parcel['snapshot']>['checkpoints'],
    stops: stops as unknown as NonNullable<Parcel['snapshot']>['stops'],
    progress,
    currentStopIndex: idx,
    updatedAt: isIso(raw.updatedAt) ? raw.updatedAt : new Date().toISOString(),
  };
}

export function sanitizeParcel(raw: unknown): Parcel | null {
  if (!isObj(raw) || !str(raw.id) || !str(raw.trackingNumber) || !str(raw.carrierId) || !raw.trackingNumber) return null;
  const p: Parcel = {
    id: raw.id,
    trackingNumber: raw.trackingNumber,
    carrierId: raw.carrierId,
    nickname: str(raw.nickname) && raw.nickname.trim() ? raw.nickname : raw.trackingNumber,
    character: CHARS.includes(raw.character as CharacterKind) ? (raw.character as CharacterKind) : 'truck',
    createdAt: isIso(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    archived: raw.archived === true,
    snapshot: sanitizeSnapshot(raw.snapshot),
    unread: typeof raw.unread === 'number' && Number.isFinite(raw.unread) && raw.unread > 0 ? Math.floor(raw.unread) : 0,
  };
  if (str(raw.lastSeenCheckpointId)) p.lastSeenCheckpointId = raw.lastSeenCheckpointId;
  if (str(raw.error)) p.error = raw.error;
  if (raw.demo === true) p.demo = true;
  if (isIso(raw.lastCheckedAt)) p.lastCheckedAt = raw.lastCheckedAt;
  if (isIso(raw.modifiedAt)) p.modifiedAt = raw.modifiedAt;
  return p; // `refreshing` is never restored
}

function sanitizeInboxItem(raw: unknown): InboxItem | null {
  if (!isObj(raw) || !str(raw.id) || !str(raw.parcelId) || !str(raw.checkpointId) || !isIso(raw.time)) return null;
  if (!STATUSES.includes(raw.status as StatusTag) || !isObj(raw.text) || !str(raw.text.ko) || !str(raw.text.en)) return null;
  return { id: raw.id, parcelId: raw.parcelId, checkpointId: raw.checkpointId, time: raw.time, status: raw.status as StatusTag,
    text: { ko: raw.text.ko, en: raw.text.en }, read: raw.read === true };
}

function sanitizeClock(raw: unknown): SimClockState | undefined {
  if (!isObj(raw)) return undefined;
  const { anchorReal, anchorSim, speed } = raw;
  if ([anchorReal, anchorSim, speed].every((n) => typeof n === 'number' && Number.isFinite(n)) && (speed as number) > 0) {
    return { anchorReal: anchorReal as number, anchorSim: anchorSim as number, speed: speed as number };
  }
  return undefined;
}

/** Parse + migrate + sanitize. Returns null when there is nothing usable (caller starts fresh). */
export function parsePersisted(json: string | null, defaults: Settings): PersistedState | null {
  if (!json) return null;
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return null; }
  if (!isObj(raw)) return null;
  const version = typeof raw.version === 'number' ? raw.version : 1; // pre-versioned data is treated as v1
  if (version > STORAGE_VERSION) return null; // written by a newer app; don't guess
  // (future migrations: if (version === 1) raw = migrateV1toV2(raw) …)
  const seen = new Set<string>();
  const parcels = (Array.isArray(raw.parcels) ? raw.parcels : [])
    .map(sanitizeParcel)
    .filter((p): p is Parcel => !!p && !seen.has(p.id) && !!seen.add(p.id));
  const ids = new Set(parcels.map((p) => p.id));
  const seenInbox = new Set<string>();
  const inbox = (Array.isArray(raw.inbox) ? raw.inbox : [])
    .map(sanitizeInboxItem)
    .filter((i): i is InboxItem => !!i && ids.has(i.parcelId) && !seenInbox.has(i.id) && !!seenInbox.add(i.id))
    .slice(0, INBOX_CAP);
  return { version: STORAGE_VERSION, parcels, settings: sanitizeSettings(raw.settings, defaults), inbox, clock: sanitizeClock(raw.clock) };
}

export function loadPersisted(defaults: Settings): PersistedState | null {
  const ls = storage();
  if (!ls) return null;
  let json: string | null = null;
  try { json = ls.getItem(STORAGE_KEY); } catch { return null; }
  const parsed = parsePersisted(json, defaults);
  if (json && !parsed) { try { ls.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
  return parsed;
}

export function savePersisted(state: PersistedState): boolean {
  const ls = storage();
  if (!ls) return false;
  const parcels = state.parcels.map(({ refreshing: _r, ...rest }) => { void _r; return rest; });
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify({ ...state, parcels, inbox: state.inbox.slice(0, INBOX_CAP) }));
    return true;
  } catch {
    return false; // quota / private mode: keep running in memory
  }
}

export function clearPersisted(): void {
  const ls = storage();
  try { ls?.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
