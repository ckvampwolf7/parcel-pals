/**
 * Pure geometry for the journey scene: where each stop sits, the winding path between stops and
 * length/point lookups along it. No DOM needed (the scene prefers SVGPathElement when available,
 * this math is the fallback and is what the unit tests exercise).
 */
import type { RouteStop, TransportMode } from '@/types';

export const SCENE_H = 244;
/** y of the ground line the stops wiggle around */
export const GROUND_Y = 174;
/** y the flight arc control points are pulled up to */
const ARC_Y = 22;
const PAD_X = 38;
/** up to 5 stops squeeze onto a 360px phone; longer (international) routes get room and scroll */
const minSpacing = (n: number) => (n > 5 ? 86 : 60);

export interface Pt { x: number; y: number }

export interface Segment {
  from: number;
  to: number;
  mode: TransportMode;
  /** cubic bezier control points: p0, c1, c2, p1 */
  p: [Pt, Pt, Pt, Pt];
  /** standalone path data (M … C …) */
  d: string;
}

export interface SceneLayout {
  width: number;
  height: number;
  points: Pt[];
  segments: Segment[];
  /** full path through all stops */
  d: string;
  spacing: number;
  /** true when the canvas is wider than the viewport (horizontal scroll) */
  scrolls: boolean;
}

const r = (n: number) => Math.round(n * 10) / 10;

/** Mode used to travel FROM stop i (falls back to the snapshot's current mode, then truck). */
export function segmentMode(stops: RouteStop[], i: number, fallback: TransportMode = 'truck'): TransportMode {
  return stops[i]?.modeToNext ?? fallback;
}

export function layoutScene(stops: RouteStop[], viewW: number, fallbackMode: TransportMode = 'truck'): SceneLayout {
  const n = Math.max(1, stops.length);
  const vw = Math.max(240, viewW);
  const fit = n > 1 ? (vw - PAD_X * 2) / (n - 1) : 0;
  const spacing = n > 1 ? Math.max(minSpacing(n), fit) : 0;
  const width = n > 1 ? Math.max(vw, Math.round(PAD_X * 2 + spacing * (n - 1))) : vw;
  const scrolls = width > vw + 1;
  const points: Pt[] = Array.from({ length: n }, (_, i) => ({
    x: n > 1 ? r(PAD_X + spacing * i) : vw / 2,
    y: GROUND_Y + (i % 2 === 0 ? -7 : 9),
  }));
  const segments: Segment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x;
    const mode = segmentMode(stops, i, fallbackMode);
    let c1: Pt, c2: Pt;
    if (mode === 'plane') {
      // a rounder, lower arc when stops are close together
      const top = Math.max(ARC_Y, GROUND_Y - dx * 1.35);
      c1 = { x: r(a.x + dx * 0.05), y: r(top) };
      c2 = { x: r(b.x - dx * 0.05), y: r(top) };
    } else {
      // gentle S-bends: alternate the bulge so the road winds over the hills
      const w = i % 2 === 0 ? 16 : -16;
      c1 = { x: r(a.x + dx * 0.42), y: r(a.y + w) };
      c2 = { x: r(b.x - dx * 0.42), y: r(b.y - w) };
    }
    const p: [Pt, Pt, Pt, Pt] = [a, c1, c2, b];
    segments.push({ from: i, to: i + 1, mode, p, d: `M${a.x} ${a.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}` });
  }
  const d = segments.length
    ? `M${points[0].x} ${points[0].y}` + segments.map((s) => `C${s.p[1].x} ${s.p[1].y} ${s.p[2].x} ${s.p[2].y} ${s.p[3].x} ${s.p[3].y}`).join('')
    : `M${points[0].x} ${points[0].y}`;
  return { width, height: SCENE_H, points, segments, d, spacing, scrolls };
}

export function bezierPoint(p: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
  return { x: a * p[0].x + b * p[1].x + c * p[2].x + e * p[3].x, y: a * p[0].y + b * p[1].y + c * p[2].y + e * p[3].y };
}

/** Lookup table of cumulative length per segment (for the DOM-free fallback). */
export interface Lut { lengths: number[]; cum: number[]; total: number; samples: Array<Array<{ t: number; l: number }>> }

export function buildLut(segments: Segment[], steps = 48): Lut {
  const lengths: number[] = [];
  const samples: Lut['samples'] = [];
  for (const s of segments) {
    let l = 0;
    let prev = s.p[0];
    const arr = [{ t: 0, l: 0 }];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const pt = bezierPoint(s.p, t);
      l += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      arr.push({ t, l });
      prev = pt;
    }
    lengths.push(l);
    samples.push(arr);
  }
  const cum = [0];
  lengths.forEach((l, i) => cum.push(cum[i] + l));
  return { lengths, cum, total: cum[cum.length - 1], samples };
}

/** Point at absolute length along the whole path (DOM-free). */
export function pointAtLength(layout: SceneLayout, lut: Lut, len: number): Pt {
  if (!layout.segments.length) return layout.points[0];
  const L = Math.min(lut.total, Math.max(0, len));
  let i = lut.cum.findIndex((c, k) => k > 0 && L <= c) - 1;
  if (i < 0) i = layout.segments.length - 1;
  const local = L - lut.cum[i];
  const arr = lut.samples[i];
  let k = 1;
  while (k < arr.length - 1 && arr[k].l < local) k++;
  const a = arr[k - 1], b = arr[k];
  const t = a.t + (b.t - a.t) * (b.l === a.l ? 0 : (local - a.l) / (b.l - a.l));
  return bezierPoint(layout.segments[i].p, t);
}

/**
 * Where on the stop axis (0 … n-1) the pal is. Engine progress is 0..1 along the stops; we keep the
 * result consistent with currentStopIndex so the pal never shows up at a stop it hasn't reached.
 */
export function stopAxisPosition(progress: number, currentStopIndex: number, stopCount: number): number {
  const n = Math.max(1, stopCount);
  if (n === 1) return 0;
  const raw = Math.min(1, Math.max(0, progress)) * (n - 1);
  const lo = Math.min(n - 1, Math.max(0, currentStopIndex));
  const hi = Math.min(n - 1, lo + 1);
  return Math.min(hi, Math.max(lo, raw));
}

/** Length along the path for a stop-axis position k, given per-segment lengths. */
export function lengthAtK(k: number, lengths: number[]): number {
  if (!lengths.length) return 0;
  const i = Math.min(lengths.length - 1, Math.max(0, Math.floor(k)));
  let acc = 0;
  for (let j = 0; j < i; j++) acc += lengths[j];
  return acc + lengths[i] * Math.min(1, Math.max(0, k - i));
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
