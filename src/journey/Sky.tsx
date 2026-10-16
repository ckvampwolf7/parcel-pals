/**
 * Sky layer of the journey scene. Follows the SIMULATION local time: dawn / day / sunset / night
 * (stars + moon). The gradient itself lives in CSS (keyed by data-phase on the scene card).
 */
import { memo } from 'react';

export type SkyPhase = 'dawn' | 'day' | 'sunset' | 'night';

export function skyPhase(hour: number): SkyPhase {
  if (hour < 5 || hour >= 20) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 17) return 'day';
  return 'sunset';
}

// deterministic "random" so the stars don't jump on re-render
const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export const Sky = memo(function Sky({ width, height, hour, phase }: { width: number; height: number; hour: number; phase: SkyPhase }) {
  const night = phase === 'night';
  // sun travels 6:00 → 19:00 along a low arc
  const t = Math.min(1, Math.max(0, (hour - 6) / 13));
  const sun = { x: 34 + t * (width - 68), y: 78 - Math.sin(Math.PI * t) * 52 };
  const stars = night || phase === 'dawn'
    ? Array.from({ length: Math.round(width / 16) }, (_, i) => ({ x: rnd(i, 1) * width, y: 6 + rnd(i, 2) * 112, r: 0.6 + rnd(i, 3) * 1.3, d: rnd(i, 4) * 4 }))
    : [];
  return (
    <svg className="jr-sky" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      {stars.map((s, i) => (
        <circle key={i} className="jr-star" cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: `${s.d}s` }} />
      ))}
      {night ? (
        <g transform={`translate(${width - 58} 40)`} className="jr-moon">
          <circle r={26} className="jr-moon__glow" />
          <path className="jr-moon__body" d="M6 -15a16 16 0 1 0 9 26a13 13 0 1 1 -9 -26z" />
          <circle cx={-3} cy={3} r={1.6} className="jr-moon__crater" />
        </g>
      ) : (
        <g transform={`translate(${sun.x} ${sun.y})`} className="jr-sun">
          <circle r={30} className="jr-sun__glow" />
          <circle r={15} className="jr-sun__body" />
        </g>
      )}
      <g className="jr-clouds">
        <Cloud x={width * 0.12} y={34} s={1} cls="jr-cloud jr-cloud--a" />
        <Cloud x={width * 0.55} y={64} s={0.75} cls="jr-cloud jr-cloud--b" />
        <Cloud x={width * 0.86} y={22} s={0.6} cls="jr-cloud jr-cloud--c" />
      </g>
    </svg>
  );
});

function Cloud({ x, y, s, cls }: { x: number; y: number; s: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={cls}>
        <path d="M-28 8a10 10 0 0 1 4-19 14 14 0 0 1 26-4 11 11 0 0 1 20 6 9 9 0 0 1 4 17z" />
      </g>
    </g>
  );
}
