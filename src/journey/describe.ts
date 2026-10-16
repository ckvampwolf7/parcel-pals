/** Text equivalents of the journey: where the pal is, for the "지금 어디쯤?" card and screen readers. */
import type { LocalizedText, Parcel, RouteStop, TrackingSnapshot } from '@/types';
import { stopAxisPosition } from './geometry';

type T = (key: string, params?: Record<string, string | number>) => string;
type LT = (text: LocalizedText | undefined) => string;

export interface PositionInfo {
  /** position on the stop axis 0 … n-1 */
  k: number;
  /** index of the stop reached / last departed */
  cur: number;
  /** next stop index, or -1 at the end */
  next: number;
  /** standing at `cur` (not between stops) */
  atStop: boolean;
}

export function positionInfo(snapshot: TrackingSnapshot, stops: RouteStop[]): PositionInfo {
  const n = stops.length;
  const k = snapshot.status === 'delivered' ? n - 1 : stopAxisPosition(snapshot.progress, snapshot.currentStopIndex, n);
  const cur = Math.min(n - 1, Math.floor(k + 1e-6));
  const atStop = k - cur < 0.04;
  return { k, cur, next: cur + 1 < n ? cur + 1 : -1, atStop };
}

/** One sentence: where is it now (distance-free wording). */
export function whereLine(snapshot: TrackingSnapshot, stops: RouteStop[], t: T, lt: LT): string {
  const s = snapshot.status;
  const { cur, next, atStop } = positionInfo(snapshot, stops);
  const name = (i: number) => lt(stops[i]?.name);
  if (s === 'pending') return t('journey.where.pending');
  if (s === 'delivered') return t('journey.where.delivered', { stop: name(stops.length - 1) });
  if (s === 'available_for_pickup') {
    return t('journey.where.pickup', { place: snapshot.pickup ? lt(snapshot.pickup.place) : name(stops.length - 1) });
  }
  if (s === 'exception' || s === 'attempt_fail') return t('journey.where.problem', { stop: name(cur) });
  if (cur === 0 && atStop) return t('journey.where.ready', { stop: name(0) });
  if (atStop && next >= 0) return t('journey.where.atStop', { stop: name(cur), next: name(next) });
  if (next >= 0) return t('journey.where.moving', { from: name(cur), to: name(next) });
  return t('journey.where.delivered', { stop: name(cur) });
}

/** Full screen-reader description of the scene. */
export function describeJourney(parcel: Parcel, snapshot: TrackingSnapshot, stops: RouteStop[], t: T, lt: LT): string {
  const n = stops.length;
  const { cur, next, atStop } = positionInfo(snapshot, stops);
  const parts = [t('journey.sr.journey', { name: parcel.nickname, n, route: stops.map((s) => lt(s.name)).join(' → ') })];
  if (snapshot.status === 'delivered') parts.push(t('journey.sr.delivered', { stop: lt(stops[n - 1]?.name) }));
  else if (atStop || next < 0) parts.push(t('journey.sr.at', { n, i: cur + 1, stop: lt(stops[cur]?.name) }));
  else parts.push(t('journey.sr.between', { from: lt(stops[cur]?.name), to: lt(stops[next]?.name), mode: t(`journey.mode.${snapshot.currentMode}`) }));
  if (snapshot.status !== 'delivered') parts.push(t('journey.sr.progress', { pct: Math.round(Math.min(1, Math.max(0, snapshot.progress)) * 100) }));
  return parts.join(' ');
}
