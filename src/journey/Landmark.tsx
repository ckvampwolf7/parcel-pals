/**
 * Little picture-book landmarks for each stop kind. Drawn in a local box where (0,0) is the ground
 * point under the stop and the drawing grows upward (~ -52…0). Colors come from journey.css classes.
 */
import type { ReactNode } from 'react';
import type { StopKind } from '@/types';

export type LandmarkKind = StopKind | 'store' | 'locker' | 'branch';

export function Landmark({ kind, x, y, reached }: { kind: LandmarkKind; x: number; y: number; reached: boolean }) {
  return (
    <g className={`jr-lm jr-lm--${kind} ${reached ? 'is-reached' : ''}`} transform={`translate(${x} ${y - 9})`}>
      <ellipse className="jr-lm__ground" cx={0} cy={1} rx={27} ry={5} />
      {DRAW[kind]}
    </g>
  );
}

const DRAW: Record<LandmarkKind, ReactNode> = {
  // little shop with a striped awning and a box waiting out front
  origin: (
    <g className="jr-o">
      <rect className="f-wall" x={-19} y={-30} width={34} height={30} rx={3} />
      <rect className="f-window" x={-15} y={-20} width={10} height={9} rx={2} />
      <rect className="f-door" x={-2} y={-17} width={10} height={17} rx={2} />
      <path className="f-coral" d="M-23 -36h42v8a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0z" />
      <path className="f-white jr-no" d="M-16 -36h7v8h-7zM-2 -36h7v8h-7zM12 -36h7v6h-7z" opacity={0.85} />
      <path className="f-coral" d="M-23 -36l4-8h34l4 8z" />
      <g transform="translate(20 -1)">
        <rect className="f-kraft" x={-1} y={-11} width={13} height={11} rx={1.5} />
        <path className="jr-tape" d="M5.5 -11v11" />
      </g>
    </g>
  ),
  // warehouse with a roll-up door and a tiny conveyor of boxes
  hub: (
    <g className="jr-o">
      <path className="f-lilac-soft" d="M-25 0v-28l25-12 25 12v28z" />
      <path className="f-lilac" d="M-28 -27l28-14 28 14-3 4-25-12-25 12z" />
      <rect className="f-door" x={-11} y={-20} width={22} height={20} rx={2} />
      <path className="jr-line" d="M-11 -15h22M-11 -10h22M-11 -5h22" />
      <circle className="f-window" cx={0} cy={-29} r={3.5} />
      <g transform="translate(28 0)">
        <path className="jr-line" d="M-7 -3h14" />
        <rect className="f-kraft jr-belt-box" x={-6} y={-10} width={6} height={6} rx={1} />
        <rect className="f-kraft jr-belt-box jr-belt-box--2" x={1} y={-10} width={6} height={6} rx={1} />
      </g>
    </g>
  ),
  // control tower + low terminal
  airport: (
    <g className="jr-o">
      <rect className="f-wall" x={2} y={-14} width={24} height={14} rx={2} />
      <path className="f-window jr-no" d="M6 -10h4v4h-4zM13 -10h4v4h-4zM20 -10h3v4h-3z" />
      <rect className="f-wall" x={-12} y={-36} width={11} height={36} rx={2} />
      <path className="f-sky" d="M-21 -48h29l-4 12h-21z" />
      <rect className="f-glass" x={-17} y={-46} width={21} height={6} rx={2} />
      <rect className="f-wall" x={-20} y={-53} width={27} height={5} rx={2.5} />
      <path className="jr-line" d="M-6.5 -53v-7" />
      <circle className="f-coral jr-beacon" cx={-6.5} cy={-61} r={2.5} />
    </g>
  ),
  // customs booth with a striped barrier and a big friendly stamp
  customs: (
    <g className="jr-o">
      <rect className="f-sun-soft" x={-24} y={-28} width={18} height={28} rx={2} />
      <rect className="f-sun" x={-26} y={-32} width={22} height={6} rx={2} />
      <rect className="f-glass" x={-20} y={-21} width={10} height={8} rx={1.5} />
      <rect className="f-wall" x={-6} y={-20} width={4} height={20} rx={1} />
      <rect className="f-white" x={-4} y={-18} width={30} height={5} rx={2.5} />
      <path className="f-coral jr-no" d="M2 -18h5v5h-5zM12 -18h5v5h-5zM22 -18h4v5h-4z" />
      <g transform="translate(15 -36) rotate(-12)" className="jr-stamp">
        <circle className="f-stamp" r={9} />
        <path className="jr-stamp__check" d="M-4 0l3 3 5-6" />
      </g>
    </g>
  ),
  // neighborhood depot with a flag
  local: (
    <g className="jr-o">
      <rect className="f-mint-soft" x={-18} y={-26} width={36} height={26} rx={3} />
      <rect className="f-mint" x={-21} y={-31} width={42} height={7} rx={3} />
      <rect className="f-door" x={-7} y={-16} width={14} height={16} rx={2} />
      <path className="jr-line" d="M-7 -11h14M-7 -6h14" />
      <rect className="f-window" x={-15} y={-20} width={6} height={6} rx={1.5} />
      <rect className="f-window" x={9} y={-20} width={6} height={6} rx={1.5} />
      <path className="jr-line" d="M16 -31v-17" />
      <path className="f-mint jr-flag" d="M16 -48l11 4-11 4z" />
    </g>
  ),
  // cozy house: pitched roof, chimney, warm window, round door
  destination: (
    <g className="jr-o">
      <rect className="f-coral" x={8} y={-46} width={6} height={12} rx={1} />
      <rect className="f-wall" x={-19} y={-28} width={38} height={28} rx={3} />
      <path className="f-coral" d="M-24 -26 0 -47l24 21a2 2 0 0 1-2 3.2L0 -42-22 -22.8a2 2 0 0 1-2-3.2z" />
      <path className="f-sun" d="M-6 0v-12a6 6 0 0 1 12 0v12z" />
      <circle className="jr-knob" cx={3} cy={-6} r={1} />
      <rect className="f-window" x={-16} y={-21} width={8} height={8} rx={2} />
      <rect className="f-window" x={9} y={-21} width={8} height={8} rx={2} />
      <path className="f-heart jr-no" d="M0 -31.5c-1.4-2.4-5-1.6-5 1 0 2.2 3 3.8 5 5.6 2-1.8 5-3.4 5-5.6 0-2.6-3.6-3.4-5-1z" />
    </g>
  ),
  // convenience store pickup (편의점)
  store: (
    <g className="jr-o">
      <rect className="f-wall" x={-22} y={-30} width={44} height={30} rx={3} />
      <rect className="f-mint" x={-24} y={-36} width={48} height={9} rx={3} />
      <path className="f-sun jr-no" d="M-24 -29h48v3h-48z" />
      <rect className="f-glass" x={-18} y={-22} width={22} height={14} rx={2} />
      <rect className="f-door" x={7} y={-22} width={11} height={22} rx={2} />
      <text className="jr-sign" x={0} y={-29.5} textAnchor="middle">24</text>
    </g>
  ),
  // parcel locker bank
  locker: (
    <g className="jr-o">
      <rect className="f-sky" x={-22} y={-36} width={44} height={36} rx={3} />
      <path className="jr-line" d="M-22 -24h44M-22 -12h44M-7 -36v36M8 -36v36" />
      <rect className="f-sun" x={-5} y={-22} width={11} height={8} rx={1.5} />
      <circle className="jr-knob" cx={4} cy={-30} r={1} />
      <circle className="jr-knob" cx={-10} cy={-6} r={1} />
    </g>
  ),
  // carrier branch / post office counter
  branch: (
    <g className="jr-o">
      <rect className="f-wall" x={-20} y={-30} width={40} height={30} rx={3} />
      <path className="f-coral" d="M-24 -28 0 -42l24 14z" />
      <rect className="f-door" x={-6} y={-16} width={12} height={16} rx={2} />
      <rect className="f-window" x={-16} y={-22} width={7} height={7} rx={1.5} />
      <rect className="f-window" x={9} y={-22} width={7} height={7} rx={1.5} />
      <rect className="f-white" x={-7} y={-28} width={14} height={7} rx={1.5} />
      <path className="jr-line" d="M-7 -28l7 4 7-4" />
    </g>
  ),
};
