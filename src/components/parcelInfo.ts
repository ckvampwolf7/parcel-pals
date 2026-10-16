/**
 * Small read-only helpers about parcels for UI-team screens (Home, Inbox, Add).
 * Defensive about optional snapshot fields other teams may add (`stale`, `pickup`).
 */
import type { Locale, LocalizedText, Parcel, StatusTag, TrackingSnapshot } from '@/types';
import { getCarrier } from '@/engine';

export function carrierName(carrierId: string, locale: Locale): string {
  const c = getCarrier(carrierId);
  if (!c) return carrierId;
  return locale === 'ko' ? c.nameKo : c.nameEn;
}

export function lastCheckpoint(p: Parcel) {
  return p.snapshot?.checkpoints.at(-1);
}

export function isDelivered(p: Parcel): boolean {
  return p.snapshot?.status === 'delivered';
}

/** `snapshot.stale` (optional, Engine team): no news for longer than normal. */
export function isStale(s: TrackingSnapshot | null | undefined): boolean {
  return !!(s && (s as TrackingSnapshot & { stale?: unknown }).stale);
}

/** `snapshot.pickup` (optional, Engine team): where to pick a parcel up. Accepts a few plausible shapes. */
export function pickupPlace(s: TrackingSnapshot | null | undefined, locale: Locale): string | undefined {
  const raw = s ? (s as TrackingSnapshot & { pickup?: unknown }).pickup : undefined;
  if (!raw) return undefined;
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v || undefined;
    if (v && typeof v === 'object' && ('ko' in v || 'en' in v)) {
      const t = v as Partial<LocalizedText>;
      return t[locale] || t.ko || t.en || undefined;
    }
    return undefined;
  };
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    return pick(raw) ?? pick(o.name) ?? pick(o.place) ?? pick(o.location) ?? pick(o.label);
  }
  return pick(raw);
}

/** Lower = more urgent (for picking the hero card). */
const RANK: Record<StatusTag, number> = {
  out_for_delivery: 0, available_for_pickup: 1, attempt_fail: 2, exception: 3, customs: 5, in_transit: 4,
  info_received: 6, pending: 7, expired: 8, delivered: 9,
};
export function urgency(p: Parcel): number {
  return RANK[p.snapshot?.status ?? 'pending'] ?? 7;
}

/** Parcel arriving soonest among active (not delivered) ones: out-for-delivery, then pickup, then earliest ETA. */
export function soonest(parcels: Parcel[]): Parcel | undefined {
  const active = parcels.filter((p) => !isDelivered(p) && p.snapshot);
  if (!active.length) return undefined;
  const key = (p: Parcel) => Math.min(urgency(p), 2);
  return [...active].sort((a, b) => key(a) - key(b)
    || (a.snapshot?.eta?.latest ?? '9999').localeCompare(b.snapshot?.eta?.latest ?? '9999'))[0];
}

/** Same calendar day (local time)? */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Is the ETA (latest bound) today in sim time, or the parcel is out for delivery? */
export function arrivesToday(p: Parcel, now: Date): boolean {
  const s = p.snapshot;
  if (!s || s.status === 'delivered') return false;
  if (s.status === 'out_for_delivery') return true;
  return !!s.eta && sameDay(new Date(s.eta.latest), now);
}

/** When the parcel was delivered (time of the delivered checkpoint). */
export function deliveredAt(p: Parcel): string | undefined {
  const cps = p.snapshot?.checkpoints ?? [];
  for (let i = cps.length - 1; i >= 0; i--) if (cps[i].status === 'delivered') return cps[i].time;
  return undefined;
}
