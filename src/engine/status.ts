/** Status presentation helpers: tone, label, mood. */
import type { Mood, StatusTag, TrackingSnapshot } from '@/types';
import { t } from '@/i18n';
import type { Locale } from '@/types';
import { isNight, isRestDay } from './calendar';

export type StatusTone = 'neutral' | 'info' | 'progress' | 'warning' | 'danger' | 'success';

export const STATUS_TAGS: StatusTag[] = [
  'pending', 'info_received', 'in_transit', 'customs', 'out_for_delivery', 'available_for_pickup',
  'attempt_fail', 'delivered', 'exception', 'expired',
];

/** Tone drives colors: CSS var `--c-tone-<tone>` / `--c-tone-<tone>-soft` (see styles/tokens.css). */
export function statusTone(status: StatusTag): StatusTone {
  switch (status) {
    case 'delivered': return 'success';
    case 'out_for_delivery': case 'available_for_pickup': return 'progress';
    case 'attempt_fail': case 'expired': return 'warning';
    case 'exception': return 'danger';
    case 'pending': return 'neutral';
    default: return 'info';
  }
}

export function statusLabel(status: StatusTag, locale: Locale): string {
  return t(`engine.status.${status}`, undefined, locale);
}

/** True when the parcel is currently travelling between two stops (not parked at a stop). */
export function isMoving(snapshot: TrackingSnapshot): boolean {
  const n = snapshot.stops.length;
  if (n < 2 || snapshot.status === 'delivered') return false;
  const pos = snapshot.progress * (n - 1);
  return pos - snapshot.currentStopIndex > 0.01 && pos < n - 1 - 1e-6 && Math.abs(pos - Math.round(pos)) > 0.01;
}

/**
 * Mood the parcel's character should show right now.
 * `now` defaults to the snapshot's own time (sim time), so the 1-arg call stays meaningful.
 */
export function moodFor(snapshot: TrackingSnapshot | null, now?: Date): Mood {
  if (!snapshot) return 'waiting';
  const at = (now ?? new Date(snapshot.updatedAt)).getTime();
  switch (snapshot.status) {
    case 'delivered': return 'celebrating';
    case 'attempt_fail': case 'exception': return 'worried';
    case 'expired': return 'sleeping';
    default: break;
  }
  if (snapshot.delayed) return 'worried';
  switch (snapshot.status) {
    case 'out_for_delivery': case 'available_for_pickup': return 'happy';
    case 'pending': return 'waiting';
    case 'info_received': return isNight(at) ? 'sleeping' : 'waiting';
    default: break;
  }
  // in_transit / customs
  if (isMoving(snapshot)) return 'moving';
  if (isNight(at) || isRestDay(new Date(at))) return 'sleeping';
  if (snapshot.stale) return 'sleeping';
  return snapshot.status === 'customs' ? 'waiting' : 'idle';
}
