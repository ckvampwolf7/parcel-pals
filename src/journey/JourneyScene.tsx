/**
 * The signature illustrated journey: sky that follows sim time, rolling hills, a winding road through
 * every stop (flight legs arc through the sky), cute landmarks, and the pal riding along at the real
 * progress. Motion is driven imperatively (rAF + refs) so React never re-renders per frame.
 *
 * Honesty rule: the pal only moves when the engine's progress actually changes. On first paint it is
 * simply placed at its current position (only the "traveled" trail draws itself in).
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CharacterKind, Parcel, RouteStop, TrackingSnapshot, TransportMode } from '@/types';
import { Character } from '@/characters';
import { moodFor } from '@/engine';
import { useNowFor, useReducedMotion } from '@/store';
import { useT } from '@/i18n/useT';
import {
  buildLut, easeInOutCubic, layoutScene, lengthAtK, pointAtLength, stopAxisPosition, type Pt, type SceneLayout,
} from './geometry';
import { Landmark, type LandmarkKind } from './Landmark';
import { Sky, skyPhase } from './Sky';
import { Celebration } from './Celebration';
import { ModeGlyph } from './ModeGlyph';

/** Remember what we last showed per parcel so a return visit doesn't replay anything. */
const lastShown = new Map<string, number>();

export interface JourneySceneProps {
  parcel: Parcel;
  snapshot: TrackingSnapshot;
  /** speech-bubble line (characterLine) */
  line: string;
  /** optional "what happens next" line under the bubble */
  next?: string | null;
  /** screen-reader text equivalent of the scene */
  description: string;
}

export function sceneStops(snapshot: TrackingSnapshot, fallback: { origin: string; destination: string }): RouteStop[] {
  if (snapshot.stops.length >= 2) return snapshot.stops;
  return [
    { id: '_o', kind: 'origin', name: { ko: fallback.origin, en: fallback.origin }, modeToNext: snapshot.currentMode },
    { id: '_d', kind: 'destination', name: { ko: fallback.destination, en: fallback.destination } },
  ];
}

/** Which stop the international → domestic handoff happened at. */
export function handoffStopIndex(snapshot: TrackingSnapshot, stops: RouteStop[]): number {
  if (!snapshot.handoff) return -1;
  const t = new Date(snapshot.handoff.time).getTime();
  let best = -1, bestDt = Infinity;
  for (const c of snapshot.checkpoints) {
    if (c.stopIndex === undefined) continue;
    const dt = Math.abs(new Date(c.time).getTime() - t);
    if (dt < bestDt) { bestDt = dt; best = c.stopIndex; }
  }
  if (best >= 0 && bestDt < 36e5 * 6) return best;
  const customs = stops.findIndex((s) => s.kind === 'customs');
  if (customs >= 0) return customs;
  const lastAirport = stops.map((s) => s.kind).lastIndexOf('airport');
  return lastAirport >= 0 ? Math.min(stops.length - 1, lastAirport + 1) : -1;
}

function pickupLandmark(snapshot: TrackingSnapshot): LandmarkKind | null {
  const k = snapshot.pickup?.kind;
  if (k === 'convenience_store') return 'store';
  if (k === 'locker') return 'locker';
  if (k === 'branch' || k === 'post_office') return 'branch';
  return snapshot.status === 'available_for_pickup' ? 'store' : null;
}

function hillsPath(width: number, base: number, amp: number, period: number, phase: number, bottom: number): string {
  let d = `M0 ${bottom}L0 ${base}`;
  const half = period / 2;
  for (let x = -phase, i = 0; x < width + period; x += half, i++) {
    const cx = x + half / 2;
    const cy = base + (i % 2 === 0 ? -amp : amp * 0.35);
    d += `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(x + half).toFixed(1)} ${base}`;
  }
  return d + `L${width} ${bottom}Z`;
}

export const JourneyScene = memo(function JourneyScene({ parcel, snapshot, line, next, description }: JourneySceneProps) {
  const { t, lt } = useT();
  const reduced = useReducedMotion();
  const now = useNowFor(parcel, 15000);
  const hour = now.getHours() + now.getMinutes() / 60;
  const phase = skyPhase(hour);

  const cardRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const segRefs = useRef<Array<SVGPathElement | null>>([]);
  const palRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const shownK = useRef<number | null>(null);
  const lastPt = useRef<Pt>({ x: 0, y: 0 });
  const userScrolled = useRef(false);
  const rafRef = useRef(0);

  const [viewW, setViewW] = useState(0);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setViewW(Math.round(el.clientWidth) || 328);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stops = useMemo(
    () => sceneStops(snapshot, { origin: t('journey.stop.origin'), destination: t('journey.stop.destination') }),
    [snapshot, t],
  );
  const layout: SceneLayout = useMemo(() => layoutScene(stops, viewW || 328, snapshot.currentMode), [stops, viewW, snapshot.currentMode]);
  const lut = useMemo(() => buildLut(layout.segments), [layout]);

  const status = snapshot.status;
  const delivered = status === 'delivered';
  const targetK = delivered ? stops.length - 1 : stopAxisPosition(snapshot.progress, snapshot.currentStopIndex, stops.length);
  const reachedIdx = Math.floor(targetK + 1e-6);
  const palSize = viewW && viewW < 360 ? 54 : 60;
  const mood = moodFor(snapshot);
  const pickupKind = pickupLandmark(snapshot);
  const handoffIdx = handoffStopIndex(snapshot, stops);
  const helperKind: CharacterKind = parcel.character === 'truck' ? 'plane' : 'truck';
  const warn = status === 'exception' || status === 'attempt_fail';
  const showMode = !delivered && status !== 'pending' && status !== 'info_received' && status !== 'available_for_pickup' && !warn;
  const mode: TransportMode = snapshot.currentMode;

  // ── measuring helpers (DOM when available, math fallback for tests) ──
  const lengths = useCallback((): number[] => {
    const segs = segRefs.current;
    if (segs.length === layout.segments.length && segs.every((s) => s && typeof s.getTotalLength === 'function')) {
      try { return segs.map((s) => s!.getTotalLength()); } catch { /* jsdom */ }
    }
    return lut.lengths;
  }, [layout, lut]);
  const pointAt = useCallback((len: number): Pt => {
    const p = pathRef.current;
    if (p && typeof p.getPointAtLength === 'function' && layout.segments.length) {
      try { const q = p.getPointAtLength(len); return { x: q.x, y: q.y }; } catch { /* jsdom */ }
    }
    return pointAtLength(layout, lut, len);
  }, [layout, lut]);

  const placeTail = useCallback(() => {
    const tail = tailRef.current, sc = scrollerRef.current;
    if (!tail) return;
    const w = cardRef.current?.clientWidth || viewW || 328;
    const x = lastPt.current.x - (sc?.scrollLeft ?? 0);
    tail.style.left = `${Math.min(w - 30, Math.max(30, x))}px`;
  }, [viewW]);

  const apply = useCallback((k: number, trail?: number, follow = true) => {
    const ls = lengths();
    const L = lengthAtK(k, ls);
    const pt = pointAt(L);
    lastPt.current = pt;
    const pal = palRef.current;
    if (pal) {
      const dx = (delivered || status === 'available_for_pickup') && k >= stops.length - 1.01 ? -Math.round(palSize * 0.55) : 0;
      pal.style.transform = `translate(${(pt.x - palSize / 2 + dx).toFixed(1)}px, ${(pt.y - palSize + 7).toFixed(1)}px)`;
    }
    const total = ls.reduce((a, b) => a + b, 0);
    if (trailRef.current) trailRef.current.style.strokeDasharray = `${(trail ?? L).toFixed(1)} ${(total + 20).toFixed(1)}`;
    const sc = scrollerRef.current;
    if (follow && sc && layout.scrolls && !userScrolled.current) {
      sc.scrollLeft = Math.max(0, pt.x - sc.clientWidth / 2);
    }
    placeTail();
  }, [lengths, pointAt, delivered, status, stops.length, palSize, layout.scrolls, placeTail]);

  // ── drive the pal whenever the real position changes ──
  useLayoutEffect(() => {
    if (!viewW) return;
    cancelAnimationFrame(rafRef.current);
    const from = shownK.current ?? lastShown.get(parcel.id) ?? null;
    const to = targetK;
    lastShown.set(parcel.id, to);
    const firstPaint = shownK.current === null;
    shownK.current = to;

    // first paint / reduced motion / no change / going backwards: no travel animation
    if (reduced || from === null || to <= from + 1e-4) {
      if (firstPaint && !reduced) {
        // trail draws itself in (pal stays put — no fake movement)
        apply(to, 0);
        const L = lengthAtK(to, lengths());
        const start = performance.now();
        const step = (ts: number) => {
          const p = Math.min(1, (ts - start) / 900);
          if (trailRef.current) trailRef.current.style.strokeDasharray = `${(L * easeInOutCubic(p)).toFixed(1)} ${(L + 4000).toFixed(1)}`;
          if (p < 1) rafRef.current = requestAnimationFrame(step);
          else apply(to);
        };
        rafRef.current = requestAnimationFrame(step);
      } else {
        apply(to);
      }
      return;
    }
    // real movement: animate along the path
    const dur = Math.min(2600, 700 + 650 * (to - from));
    const start = performance.now();
    apply(from);
    const step = (ts: number) => {
      const p = Math.min(1, (ts - start) / dur);
      apply(from + (to - from) * easeInOutCubic(p));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetK, viewW, layout, reduced, apply, lengths, parcel.id]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // user takes over the camera once they touch the scroller
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const take = () => { userScrolled.current = true; };
    sc.addEventListener('pointerdown', take);
    sc.addEventListener('wheel', take, { passive: true });
    sc.addEventListener('touchstart', take, { passive: true });
    sc.addEventListener('keydown', take);
    sc.addEventListener('scroll', placeTail, { passive: true });
    return () => {
      sc.removeEventListener('pointerdown', take); sc.removeEventListener('wheel', take);
      sc.removeEventListener('touchstart', take); sc.removeEventListener('keydown', take);
      sc.removeEventListener('scroll', placeTail);
    };
  }, [placeTail]);

  const W = layout.width, H = layout.height;
  const lastIdx = stops.length - 1;
  const palNear = handoffIdx >= 0 && Math.abs(targetK - handoffIdx) < 0.34;

  return (
    <figure className="jr-scene-wrap">
      <div
        ref={cardRef}
        className="jr-scene"
        data-testid="journey-scene"
        data-progress={String(Math.round(Math.min(1, Math.max(0, snapshot.progress)) * 1000) / 1000)}
        data-phase={phase}
        data-status={status}
        data-char={parcel.character}
        style={{ height: H }}
      >
        {viewW > 0 && <Sky width={viewW} height={H} hour={hour} phase={phase} />}
        <div
          ref={scrollerRef}
          className={`jr-scroller ${layout.scrolls ? 'is-scrolling' : ''}`}
          tabIndex={layout.scrolls ? 0 : undefined}
          role={layout.scrolls ? 'region' : undefined}
          aria-label={layout.scrolls ? t('journey.scene.scrollLabel') : undefined}
        >
          <div className="jr-canvas" style={{ width: W, height: H }}>
            <svg className="jr-ground" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
              <path className="jr-hill jr-hill--far" d={hillsPath(W, 124, 26, 230, 40, H)} />
              <path className="jr-hill jr-hill--mid" d={hillsPath(W, 148, 16, 170, 95, H)} />
              <path className="jr-hill jr-hill--near" d={`M0 ${H}L0 188Q${W * 0.25} 178 ${W * 0.5} 188T${W} 186L${W} ${H}Z`} />
              {/* little trees & flowers for texture */}
              {Array.from({ length: Math.ceil(W / 70) }, (_, i) => {
                const x = 22 + i * 70 + (i % 3) * 9;
                return i % 2 === 0
                  ? <g key={i} className="jr-tree" transform={`translate(${x} ${137 + (i % 4) * 3})`}><rect x={-1.5} y={-2} width={3} height={8} /><circle cy={-8} r={8} /></g>
                  : <circle key={i} className="jr-flower" cx={x} cy={226 + (i % 3) * 5} r={2.4} />;
              })}
              {stops.map((s, i) => (
                <Landmark
                  key={s.id}
                  kind={i === lastIdx && pickupKind ? pickupKind : s.kind}
                  x={layout.points[i].x}
                  y={layout.points[i].y}
                  reached={i <= reachedIdx}
                />
              ))}
              {layout.segments.map((s, i) => (
                <g key={i} className={`jr-seg jr-seg--${s.mode === 'plane' ? 'air' : s.mode === 'ship' ? 'sea' : 'road'}`}>
                  {s.mode === 'ship' && <path className="jr-sea" d={s.d} />}
                  <path ref={(el) => { segRefs.current[i] = el; }} className="jr-seg__bed" d={s.d} />
                  <path className="jr-seg__dash" d={s.d} />
                </g>
              ))}
              <path ref={pathRef} className="jr-path-measure" d={layout.d} />
              <path ref={trailRef} className="jr-trail" d={layout.d} style={{ strokeDasharray: `0 ${lut.total + 20}` }} />
              {layout.points.map((p, i) => (
                <circle
                  key={i}
                  className={`jr-dot ${i <= reachedIdx ? 'is-reached' : ''} ${i === reachedIdx && !delivered ? 'is-current' : ''}`}
                  cx={p.x} cy={p.y} r={i === lastIdx ? 7 : 5.5}
                />
              ))}
            </svg>
            {stops.map((s, i) => {
              const name = i === lastIdx && snapshot.pickup ? lt(snapshot.pickup.place) : lt(s.name);
              return (
                <span
                  key={s.id}
                  className={`jr-label ${i <= reachedIdx ? 'is-reached' : ''} ${i === reachedIdx ? 'is-current' : ''}`}
                  style={{
                    left: i === 0 ? 4 : i === lastIdx ? undefined : layout.points[i].x,
                    right: i === lastIdx && i > 0 ? Math.max(4, W - layout.points[i].x - 30) : undefined,
                    transform: i === 0 || (i === lastIdx && i > 0) ? 'none' : undefined,
                    top: layout.points[i].y + 12,
                    maxWidth: Math.max(60, Math.min(layout.spacing * 2 - 12, 118)),
                  }}
                  title={name}
                  aria-hidden="true"
                >
                  {name}
                </span>
              );
            })}
            {handoffIdx >= 0 && (
              <div
                className={`jr-helper ${palNear ? 'is-near' : ''}`}
                style={{ transform: `translate(${layout.points[handoffIdx].x - 44}px, ${layout.points[handoffIdx].y - 44}px)` }}
                aria-hidden="true"
              >
                <Character kind={helperKind} mood={palNear ? 'happy' : 'idle'} size={36} facing="right" />
                {palNear && <span className="jr-handbox" />}
              </div>
            )}
            <div ref={palRef} className="jr-pal" style={{ width: palSize, height: palSize }} data-mode={mode}>
              {!reduced && (status === 'in_transit' || status === 'customs' || status === 'out_for_delivery') && mood === 'moving' && mode !== 'plane' && (
                <span className="jr-puffs" aria-hidden="true"><i /><i /><i /></span>
              )}
              <Character kind={parcel.character} mood={mood} size={palSize} facing="right" />
              {showMode && (
                <span className="jr-mode" aria-hidden="true"><ModeGlyph mode={mode} /></span>
              )}
              {warn && (
                <svg className="jr-warn" viewBox="0 0 24 34" aria-hidden="true" focusable="false">
                  <path className="jr-warn__post" d="M12 18v15" />
                  <path className="jr-warn__sign" d="M12 2.5 22.5 20h-21z" />
                  <path className="jr-warn__mark" d="M12 8.5v5.5M12 16.8h.01" />
                </svg>
              )}
            </div>
          </div>
        </div>
        {delivered && <Celebration reduced={reduced} label={t('journey.scene.celebrate')} />}
      </div>
      <div className="jr-bubble" data-testid="speech-bubble" aria-live="polite" aria-atomic="true">
        <span ref={tailRef} className="jr-bubble__tail" aria-hidden="true" />
        <span className="jr-bubble__who">{t(`common.char.${parcel.character}`)}</span>
        <p className="jr-bubble__line">{line}</p>
        {next && <p className="jr-bubble__next">{next}</p>}
      </div>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
});
