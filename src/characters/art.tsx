/**
 * Pure SVG art for the three pals + the parcel box.
 * No React hooks, no store, no CSS imports — so it can be rendered on the server
 * (scripts/render-icons.mjs uses it for the app icons).
 *
 * Coordinate system: square viewBox 0 0 120 120, ground/baseline at y = 108,
 * anchor point (60, 108) = bottom-centre of the pal. Facing right by default.
 *
 * Every colour is a presentation attribute (hex that mirrors the design tokens),
 * so the SVG also renders standalone; characters.css re-maps the theme-dependent
 * bits (halo, shadow) and the signature colours to tokens.
 *
 * Animation contract: any element that a CSS keyframe animates is a <g> whose own
 * `transform` attribute is empty (CSS transform would override it) and whose
 * transform-origin is set inline in viewBox units.
 */
import type { ReactNode } from 'react';
import type { CharacterKind, Mood } from '@/types';

export const VIEWBOX = 120;
export const BASELINE_Y = 108;
export const ANCHOR = { x: 60, y: BASELINE_Y } as const;

/* ───────── palette (mirrors tokens.css; see docs/characters.md) ───────── */
export const INK = '#2d2a45';
const HALO = '#ffffff';
const SW = 3.2; //        main outline width (viewBox units)
const SW_THIN = 2.2; //   inner detail outline
const HALO_EXTRA = 5; //  halo = outline + this
const WHITE = '#ffffff';
const CHEEK = '#ff5d7a';
const TONGUE = '#ff8a96';
const SUN = '#ffc93c';
const SUN_SHADE = '#f2a100';
const GLASS = '#d4efff';
const TIRE = '#4a4568';
const HUB = '#ece9f7';
const BOX = '#eab676';
const BOX_SHADE = '#d0955a';
const BOX_TAPE = '#fff1d6';

export const PAL_COLORS: Record<CharacterKind, { main: string; shade: string; light: string }> = {
  truck: { main: '#ff9a3c', shade: '#ef7b22', light: '#ffc996' },
  plane: { main: '#4c8dff', shade: '#3270e8', light: '#a9c9ff' },
  bunny: { main: '#ff8fb1', shade: '#f46c97', light: '#ffd1df' },
};

interface Pass {
  /** halo pass: draw only the silhouette in the halo colour, thicker */
  halo: boolean;
}

type Paint = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinejoin: 'round';
  strokeLinecap: 'round';
  className: string;
};

/** Fill + outline for a silhouette shape (or halo version in the halo pass). */
function paint(p: Pass, fill: string, extraClass = ''): Paint {
  return p.halo
    ? { fill: HALO, stroke: HALO, strokeWidth: SW + HALO_EXTRA, strokeLinejoin: 'round', strokeLinecap: 'round', className: 'pc-hl' }
    : { fill, stroke: INK, strokeWidth: SW, strokeLinejoin: 'round', strokeLinecap: 'round', className: ('pc-o ' + extraClass).trim() };
}
/** Inner detail with a thin outline (hidden below 40px via .pc-d). */
const thin = (fill: string) => ({ fill, stroke: INK, strokeWidth: SW_THIN, strokeLinejoin: 'round' as const, className: 'pc-d' });
const origin = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

/* ───────────────────────────── face ───────────────────────────── */

type MouthKind = 'smile' | 'omega' | 'open' | 'big' | 'o' | 'flat' | 'wobbly';
interface FaceSpec {
  x: number; //  centre between the eyes
  y: number; //  eye centre line
  gap: number; // eye distance
  bunny?: boolean;
  /** solid cheek colour for bodies where a translucent pink would turn muddy (blue plane) */
  cheek?: string;
}

function mouthFor(mood: Mood, bunny: boolean): MouthKind {
  switch (mood) {
    case 'idle': return bunny ? 'omega' : 'smile';
    case 'moving': return 'open';
    case 'waiting': return 'flat';
    case 'sleeping': return 'o';
    case 'worried': return 'wobbly';
    case 'happy': return 'open';
    case 'celebrating': return 'big';
  }
}

function Mouth({ kind }: { kind: MouthKind }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'smile': return <path d="M -4.6 0 Q 0 4.6 4.6 0" {...line} />;
    case 'omega': return <path d="M -4.8 0.2 Q -2.4 3.8 0 0.8 Q 2.4 3.8 4.8 0.2" {...line} />;
    case 'flat': return <path d="M -3.4 1.6 Q 0 0.6 3.4 1.6" {...line} />;
    case 'wobbly': return <path d="M -4.6 2.4 Q -2.3 0.4 0 2 Q 2.3 3.6 4.6 1.6" {...line} />;
    case 'o': return <ellipse cx={0} cy={2.2} rx={2.1} ry={2.5} fill={INK} />;
    case 'open':
    case 'big':
      return (
        <g transform={kind === 'big' ? 'scale(1.3)' : undefined}>
          <path d="M -5.6 0 Q 0 1.2 5.6 0 Q 5.2 7.6 0 8 Q -5.2 7.6 -5.6 0 Z" fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M -3.1 5.7 Q 0 3.5 3.1 5.7 Q 1.8 7.5 0 7.6 Q -1.8 7.5 -3.1 5.7 Z" fill={TONGUE} />
        </g>
      );
  }
}

function Eye({ cx, cy, mood }: { cx: number; cy: number; mood: Mood }) {
  if (mood === 'sleeping') {
    return <path d={`M ${cx - 4.6} ${cy - 0.6} Q ${cx} ${cy + 4} ${cx + 4.6} ${cy - 0.6}`} fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />;
  }
  if (mood === 'celebrating') {
    return <path d={`M ${cx - 4.8} ${cy + 1.8} Q ${cx} ${cy - 5} ${cx + 4.8} ${cy + 1.8}`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
  }
  const ry = mood === 'worried' ? 5.4 : 5.9;
  const big = mood === 'happy';
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={4.5} ry={ry} fill={INK} />
      <circle cx={cx + 1.5} cy={cy - 2.3} r={big ? 2.1 : 1.8} fill={WHITE} />
      <circle cx={cx - 1.5} cy={cy + 2.5} r={big ? 1.1 : 0.85} fill={WHITE} opacity={0.85} />
    </g>
  );
}

function Face({ spec, mood }: { spec: FaceSpec; mood: Mood }) {
  const { x, y, gap, bunny = false, cheek = CHEEK } = spec;
  const ex = gap / 2;
  const solid = cheek !== CHEEK;
  const cheekOpacity = (mood === 'happy' || mood === 'celebrating' ? 0.62 : mood === 'worried' ? 0.32 : 0.48) * (solid ? 1.5 : 1);
  const mouthY = bunny ? y + 10.5 : y + 9;
  return (
    <g className="pc-face" style={origin(x, y + 4)}>
      <ellipse className="pc-cheek" cx={x - ex - 4.6} cy={y + 7.6} rx={4.8} ry={3} fill={cheek} opacity={cheekOpacity} />
      <ellipse className="pc-cheek" cx={x + ex + 4.6} cy={y + 7.6} rx={4.8} ry={3} fill={cheek} opacity={cheekOpacity} />
      <g className="pc-eyes" style={origin(x, y)}>
        <Eye cx={x - ex} cy={y} mood={mood} />
        <Eye cx={x + ex} cy={y} mood={mood} />
      </g>
      {mood === 'worried' && (
        <g className="pc-brows" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round">
          <path d={`M ${x - ex - 4.2} ${y - 8.4} Q ${x - ex} ${y - 9.6} ${x - ex + 3.4} ${y - 11.4}`} />
          <path d={`M ${x + ex - 3.4} ${y - 11.4} Q ${x + ex} ${y - 9.6} ${x + ex + 4.2} ${y - 8.4}`} />
        </g>
      )}
      {bunny && <ellipse cx={x} cy={y + 6.4} rx={2.7} ry={1.9} fill="#d9466f" />}
      <g transform={`translate(${x} ${mouthY})`}>
        <Mouth kind={mouthFor(mood, bunny)} />
      </g>
    </g>
  );
}

/* ───────────────────────────── parcel box (shared) ───────────────────────────── */

/** Small cardboard box in 3/4 view; (x,y) = bottom-left of the front face. */
function Box({ p, x, y, w, h }: { p: Pass; x: number; y: number; w: number; h: number }) {
  const d = Math.round(w * 0.22); // depth of the top/side faces
  const outline = `M ${x} ${y} L ${x} ${y - h} L ${x + d} ${y - h - d} L ${x + w + d} ${y - h - d} L ${x + w + d} ${y - d} L ${x + w} ${y} Z`;
  if (p.halo) return <path d={outline} {...paint(p, BOX)} />;
  const tx = x + w / 2;
  return (
    <g>
      <path d={outline} {...paint(p, BOX)} />
      {/* side face */}
      <path d={`M ${x + w} ${y} L ${x + w} ${y - h} L ${x + w + d} ${y - h - d} L ${x + w + d} ${y - d} Z`} fill={BOX_SHADE} />
      {/* top face */}
      <path d={`M ${x} ${y - h} L ${x + d} ${y - h - d} L ${x + w + d} ${y - h - d} L ${x + w} ${y - h} Z`} fill="#f5cc94" />
      {/* tape */}
      <path d={`M ${tx - 3.2} ${y} L ${tx - 3.2} ${y - h} L ${tx - 3.2 + d} ${y - h - d} L ${tx + 3.2 + d} ${y - h - d} L ${tx + 3.2} ${y - h} L ${tx + 3.2} ${y} Z`} fill={BOX_TAPE} className="pc-d" />
      {/* inner edges */}
      <path d={`M ${x} ${y - h} L ${x + w} ${y - h} L ${x + w} ${y} M ${x + w} ${y - h} L ${x + w + d} ${y - h - d}`} fill="none" stroke={INK} strokeWidth={SW_THIN} strokeLinejoin="round" strokeLinecap="round" />
      <path d={outline} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" className="pc-o" />
    </g>
  );
}

/* ───────────────────────────── 붕붕이 / Vroomy (truck) ───────────────────────────── */

const TRUCK_FACE: FaceSpec = { x: 81, y: 65, gap: 19 };

function Wheel({ p, cx, cy }: { p: Pass; cx: number; cy: number }) {
  const r = 11;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} {...paint(p, TIRE)} />
      {!p.halo && (
        <g className="pc-spin" style={origin(cx, cy)}>
          <path d={`M ${cx - 7.4} ${cy - 2.6} A 7.8 7.8 0 0 1 ${cx - 2.6} ${cy - 7.4}`} fill="none" stroke="#8a85ad" strokeWidth={2} strokeLinecap="round" className="pc-d" />
          <circle cx={cx} cy={cy} r={4.8} fill={HUB} stroke={INK} strokeWidth={SW_THIN} />
          <circle cx={cx + 1.6} cy={cy - 1.6} r={1.3} fill={INK} />
        </g>
      )}
    </g>
  );
}

function Truck({ p, mood }: { p: Pass; mood: Mood }) {
  const c = PAL_COLORS.truck;
  const cab = 'M 52 96 L 52 38 Q 52 25 65 25 L 81 25 Q 103 25 106 50 L 107 89 Q 107 96 100 96 Z';
  const bed = 'M 13 67 Q 13 60 20 60 L 54 60 L 54 96 L 20 96 Q 13 96 13 89 Z';
  return (
    <>
      {/* cargo: the parcel riding on the back */}
      <g className="pc-cargo" style={origin(34, 62)}>
        <g transform="rotate(-4 34 62)">
          <Box p={p} x={17} y={63} w={28} h={24} />
        </g>
      </g>
      {/* exhaust pipe */}
      <rect x={7} y={86} width={8} height={5} rx={2.5} {...paint(p, '#b9b5d0')} />
      <path d={bed} {...paint(p, c.main, 'pc-m')} />
      {!p.halo && (
        <g className="pc-d">
          <path d="M 15 86 L 52 86 L 52 94 L 20 94 Q 15 94 15 89 Z" fill={c.shade} />
          <rect x={21} y={69} width={25} height={8} rx={4} fill="#fff4e3" stroke={INK} strokeWidth={SW_THIN} />
          <path d="M 30 73 h 7" stroke={c.main} strokeWidth={2.6} strokeLinecap="round" />
          <path d={bed} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" className="pc-o" />
        </g>
      )}
      <path d={cab} {...paint(p, c.main, 'pc-m')} />
      {!p.halo && (
        <>
          {/* one soft shade + one highlight */}
          <path d="M 54 85 L 105 85 L 105 89 Q 105 94 100 94 L 54 94 Z" fill={c.shade} />
          <path d="M 57 40 Q 57 31 64 30" fill="none" stroke={c.light} strokeWidth={3} strokeLinecap="round" className="pc-d" />
          {/* windshield */}
          <path d="M 60 37 Q 60 32 65 32 L 81 32 Q 96 32 99 47 Q 99.6 50 96.6 50 L 63 50 Q 60 50 60 47 Z" {...thin(GLASS)} />
          <path d="M 70 35 L 64 47 M 77 35 L 72 45" stroke={WHITE} strokeWidth={2.6} strokeLinecap="round" className="pc-d" />
          <path d={cab} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" className="pc-o" />
          {/* headlight */}
          <ellipse cx={106.5} cy={74} rx={3} ry={5} fill={SUN} stroke={INK} strokeWidth={SW_THIN} className="pc-lamp" />
          <Face spec={TRUCK_FACE} mood={mood} />
        </>
      )}
      {/* bumper */}
      <rect x={95} y={88} width={17} height={9} rx={4.5} {...paint(p, '#dcd8ec')} />
      <Wheel p={p} cx={31} cy={96} />
      <Wheel p={p} cx={84} cy={96} />
    </>
  );
}

/* ───────────────────────────── 슝슝이 / Zoomy (plane) ───────────────────────────── */

const PLANE_FACE: FaceSpec = { x: 78, y: 64, gap: 18, cheek: '#ff9cc2' };

function Plane({ p, mood }: { p: Pass; mood: Mood }) {
  const c = PAL_COLORS.plane;
  const body = 'M 101 67 C 101 47 86 36 66 36 C 47 36 34 46 21 55 C 13 60 13 72 21 77 C 34 86 47 97 66 97 C 86 97 101 87 101 67 Z';
  return (
    <>
      {/* landing gear */}
      <g>
        <path d="M 50 92 L 49 101 M 82 92 L 82 101" stroke={p.halo ? HALO : INK} strokeWidth={p.halo ? 3 + HALO_EXTRA : 3} strokeLinecap="round" className={p.halo ? 'pc-hl' : 'pc-o'} fill="none" />
        <circle cx={49} cy={103} r={4.6} {...paint(p, TIRE)} />
        <circle cx={82} cy={103} r={4.6} {...paint(p, TIRE)} />
      </g>
      {/* tail fin */}
      <path d="M 19 62 L 12 33 Q 11 27 17 29 Q 26 33 39 49 Z" {...paint(p, c.main, 'pc-m')} />
      {!p.halo && <path d="M 15.5 38 Q 22 40 27 44" fill="none" stroke={SUN} strokeWidth={4} strokeLinecap="round" className="pc-d" />}
      <path d={body} {...paint(p, c.main, 'pc-m')} />
      {!p.halo && (
        <>
          <path d="M 21 74 C 34 86 48 94 66 94 C 84 94 96 86 99 76 C 92 85 81 88 66 88 C 48 88 34 83 21 74 Z" fill={c.shade} />
          <path d="M 44 44 Q 52 40 60 39.5" fill="none" stroke={c.light} strokeWidth={3} strokeLinecap="round" className="pc-d" />
          <path d={body} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" className="pc-o" />
          <Face spec={PLANE_FACE} mood={mood} />
        </>
      )}
      {/* pilot goggles pushed up on the forehead */}
      <g className="pc-goggles">
        {!p.halo && <path d="M 58 40.5 Q 77 33 96 46" fill="none" stroke="#8a5a2b" strokeWidth={4} strokeLinecap="round" className="pc-d" />}
        <circle cx={71} cy={37.5} r={6.4} {...paint(p, SUN)} />
        <circle cx={85} cy={39.5} r={6.4} {...paint(p, SUN)} />
        {!p.halo && (
          <>
            <circle cx={71} cy={37.5} r={3.4} fill={GLASS} />
            <circle cx={85} cy={39.5} r={3.4} fill={GLASS} />
            <circle cx={72.2} cy={36.4} r={1.2} fill={WHITE} />
            <circle cx={86.2} cy={38.4} r={1.2} fill={WHITE} />
          </>
        )}
      </g>
      {/* wing (raised like an arm when celebrating) */}
      <g className="pc-wing" style={origin(50, 79)}>
        <path d="M 38 79 Q 52 73 61 79 Q 62 82 59 85 L 44 99 Q 40 102.5 35 102 Q 28.5 101 30.5 95 Q 33 86 38 79 Z" {...paint(p, c.main, 'pc-m')} />
        {!p.halo && <path d="M 35 96 Q 41 97 47 92" fill="none" stroke={c.shade} strokeWidth={3.4} strokeLinecap="round" className="pc-d" />}
      </g>
      {/* spinner + propeller */}
      <circle cx={102} cy={67} r={5.6} {...paint(p, SUN)} />
      <g className="pc-prop" style={origin(107, 67)}>
        <ellipse cx={107} cy={67} rx={3.2} ry={17} {...paint(p, '#fff6dc')} />
        {!p.halo && <path d="M 107 53 v 4 M 107 77 v 4" stroke={SUN_SHADE} strokeWidth={2.4} strokeLinecap="round" className="pc-d" />}
      </g>
    </>
  );
}

/* ───────────────────────────── 토토 / Toto (bunny) ───────────────────────────── */

const BUNNY_FACE: FaceSpec = { x: 69, y: 59, gap: 19, bunny: true };

function Bunny({ p, mood }: { p: Pass; mood: Mood }) {
  const c = PAL_COLORS.bunny;
  return (
    <>
      {/* ears (behind head) */}
      <g className="pc-ear-b" style={origin(52, 38)}>
        <ellipse cx={0} cy={0} rx={8.2} ry={19} transform="translate(49 22) rotate(-14)" {...paint(p, c.main, 'pc-m')} />
        {!p.halo && <ellipse cx={0} cy={2} rx={3.8} ry={12.5} transform="translate(49 22) rotate(-14)" fill={c.light} className="pc-d" />}
      </g>
      <g className="pc-ear-f" style={origin(72, 38)}>
        <ellipse cx={0} cy={0} rx={8.6} ry={19.5} transform="translate(76 21) rotate(12)" {...paint(p, c.main, 'pc-m')} />
        {!p.halo && <ellipse cx={0} cy={2} rx={4} ry={13} transform="translate(76 21) rotate(12)" fill={c.light} className="pc-d" />}
      </g>
      {/* backpack parcel */}
      <Box p={p} x={22} y={99} w={21} h={26} />
      {/* back arm */}
      <g className="pc-arm-b" style={origin(48, 82)}>
        <ellipse cx={0} cy={0} rx={5.6} ry={7.6} transform="translate(45 89) rotate(25)" {...paint(p, c.main, 'pc-m')} />
      </g>
      {/* feet */}
      <g className="pc-foot-b" style={origin(52, 104)}>
        <ellipse cx={51} cy={104} rx={9} ry={4.8} {...paint(p, c.main, 'pc-m')} />
      </g>
      <g className="pc-foot-f" style={origin(66, 104)}>
        <ellipse cx={72} cy={104} rx={9.5} ry={4.8} {...paint(p, c.main, 'pc-m')} />
      </g>
      {/* body */}
      <ellipse cx={61} cy={88} rx={21} ry={17} {...paint(p, c.main, 'pc-m')} />
      {!p.halo && (
        <>
          <ellipse cx={64} cy={92} rx={11.5} ry={10} fill="#fff1f5" />
          <path d="M 45 75 Q 55 86 57 104" fill="none" stroke="#a9733d" strokeWidth={4} strokeLinecap="round" className="pc-d" />
        </>
      )}
      {/* head */}
      <ellipse cx={63} cy={57} rx={30} ry={25} {...paint(p, c.main, 'pc-m')} />
      {!p.halo && (
        <>
          <path d="M 38 66 Q 46 80 63 81 Q 80 80 88 67 Q 80 76 63 76 Q 46 76 38 66 Z" fill={c.shade} />
          <ellipse cx={63} cy={57} rx={30} ry={25} fill="none" stroke={INK} strokeWidth={SW} className="pc-o" />
          <Face spec={BUNNY_FACE} mood={mood} />
        </>
      )}
      {/* courier cap */}
      <g className="pc-cap">
        <path d="M 74 39.5 Q 88 37 97 42 Q 96 46 88 46 L 75 45 Z" {...paint(p, '#3e50e6')} />
        <path d="M 46 42 Q 46 25 63 25 Q 80 25 80 42 Q 63 37 46 42 Z" {...paint(p, '#5468ff')} />
        {!p.halo && (
          <>
            <circle cx={63} cy={32.5} r={3.6} fill={SUN} stroke={INK} strokeWidth={1.8} />
            <path d="M 52 31 Q 54 28 57 27" fill="none" stroke="#9aa6ff" strokeWidth={2.4} strokeLinecap="round" className="pc-d" />
          </>
        )}
      </g>
      {/* front arm */}
      <g className="pc-arm-f" style={origin(76, 82)}>
        <ellipse cx={0} cy={0} rx={5.8} ry={7.8} transform="translate(80 89) rotate(-22)" {...paint(p, c.main, 'pc-m')} />
      </g>
    </>
  );
}

/* ───────────────────────────── mood effects ───────────────────────────── */

interface FxAnchor {
  z: [number, number]; //      sleeping "z" start
  drop: [number, number]; //   worried sweat drop
  dots: [number, number]; //   waiting dots
  sparkles: Array<[number, number]>;
  lines: number[]; //          speed line y's
}
const FX: Record<CharacterKind, FxAnchor> = {
  truck: { z: [94, 18], drop: [101, 56], dots: [92, 12], sparkles: [[44, 22], [112, 30]], lines: [44, 58, 76] },
  plane: { z: [96, 24], drop: [98, 52], dots: [92, 16], sparkles: [[38, 24], [113, 40]], lines: [52, 66, 80] },
  bunny: { z: [92, 16], drop: [92, 46], dots: [90, 10], sparkles: [[28, 34], [104, 28]], lines: [56, 72, 88] },
};

function Z({ x, y, s, flip, cls }: { x: number; y: number; s: number; flip: boolean; cls: string }) {
  // a "z" drawn as a path so it doesn't depend on fonts; un-mirrored when the pal faces left
  const d = `M ${x} ${y} h ${s} l ${-s} ${s * 1.05} h ${s}`;
  return (
    <g className={cls} style={origin(x + s / 2, y + s / 2)}>
      <g transform={flip ? `matrix(-1 0 0 1 ${2 * x + s} 0)` : undefined}>
        <path d={d} fill="none" stroke={HALO} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" className="pc-hl" />
        <path d={d} fill="none" stroke="#7d6cf0" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Sparkle({ x, y, r, cls, color = SUN }: { x: number; y: number; r: number; cls: string; color?: string }) {
  const k = r * 0.28;
  const d = `M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`;
  return (
    <g className={cls} style={origin(x, y)}>
      <path d={d} fill={color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  );
}

const CONFETTI: Array<{ x: number; y: number; c: string; shape: 'r' | 'c'; rot: number }> = [
  { x: 14, y: 22, c: '#ff7b6b', shape: 'r', rot: 20 },
  { x: 30, y: 8, c: '#ffc93c', shape: 'c', rot: 0 },
  { x: 50, y: 4, c: '#2fbf9b', shape: 'r', rot: -30 },
  { x: 72, y: 3, c: '#a88bff', shape: 'r', rot: 45 },
  { x: 92, y: 8, c: '#8fd3ff', shape: 'c', rot: 0 },
  { x: 108, y: 20, c: '#ff7b6b', shape: 'r', rot: -15 },
  { x: 8, y: 44, c: '#a88bff', shape: 'c', rot: 0 },
  { x: 112, y: 46, c: '#2fbf9b', shape: 'r', rot: 35 },
];

function Fx({ kind, mood, flip }: { kind: CharacterKind; mood: Mood; flip: boolean }) {
  const a = FX[kind];
  switch (mood) {
    case 'moving':
      return (
        <g className="pc-fx">
          {a.lines.map((y, i) => (
            <g key={y} className={`pc-line pc-line-${i}`} style={origin(10, y)}>
              <path d={`M ${3 + i * 2} ${y} h ${i === 1 ? 12 : 8}`} stroke={INK} strokeWidth={3} strokeLinecap="round" className="pc-speed" />
            </g>
          ))}
          {kind === 'plane' && (
            <g className="pc-puff" style={origin(12, 92)}>
              <path d="M 4 96 a 4.5 4.5 0 0 1 5 -6 a 5.5 5.5 0 0 1 10 1 a 4 4 0 0 1 2 7 Z" fill={WHITE} stroke={INK} strokeWidth={2} strokeLinejoin="round" opacity={0.95} />
            </g>
          )}
          {kind === 'truck' && (
            <g className="pc-puff" style={origin(5, 88)}>
              <circle cx={4} cy={88} r={3.6} fill="#e6e3f2" stroke={INK} strokeWidth={1.8} />
            </g>
          )}
          {kind === 'bunny' && (
            <g className="pc-puff" style={origin(36, 104)}>
              <circle cx={34} cy={105} r={3.4} fill="#efe5d8" stroke={INK} strokeWidth={1.6} opacity={0.9} />
              <circle cx={27} cy={103} r={2.4} fill="#efe5d8" stroke={INK} strokeWidth={1.4} opacity={0.8} className="pc-d" />
            </g>
          )}
        </g>
      );
    case 'waiting': {
      const [x, y] = a.dots;
      return (
        <g className="pc-fx">
          <path d={`M ${x - 4} ${y + 8} Q ${x - 6} ${y} ${x + 2} ${y - 1} L ${x + 22} ${y - 1} Q ${x + 28} ${y} ${x + 27} ${y + 6} Q ${x + 26} ${y + 11} ${x + 20} ${y + 11} L ${x + 4} ${y + 11} L ${x - 3} ${y + 15} Z`}
            fill={WHITE} stroke={INK} strokeWidth={2} strokeLinejoin="round" className="pc-bubble" />
          {[0, 1, 2].map((i) => (
            <g key={i} className={`pc-dot pc-dot-${i}`} style={origin(x + 5 + i * 7.5, y + 5)}>
              <circle cx={x + 5 + i * 7.5} cy={y + 5} r={2.3} fill={INK} />
            </g>
          ))}
        </g>
      );
    }
    case 'sleeping': {
      const [x, y] = a.z;
      return (
        <g className="pc-fx">
          <Z x={x} y={y + 8} s={7} flip={flip} cls="pc-z pc-z-0" />
          <Z x={x + 9} y={y - 4} s={9} flip={flip} cls="pc-z pc-z-1 pc-x" />
        </g>
      );
    }
    case 'worried': {
      const [x, y] = a.drop;
      return (
        <g className="pc-fx">
          <g className="pc-drop" style={origin(x, y)}>
            <path d={`M ${x} ${y - 7} Q ${x + 5.5} ${y + 0.5} ${x + 4.2} ${y + 3.4} Q ${x} ${y + 7.4} ${x - 4.2} ${y + 3.4} Q ${x - 5.5} ${y + 0.5} ${x} ${y - 7} Z`}
              fill="#bfe6ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={x - 1.4} cy={y + 2.2} r={1.1} fill={WHITE} />
          </g>
        </g>
      );
    }
    case 'happy':
      return (
        <g className="pc-fx">
          <Sparkle x={a.sparkles[0][0]} y={a.sparkles[0][1]} r={5.5} cls="pc-tw pc-tw-0" />
          <Sparkle x={a.sparkles[1][0]} y={a.sparkles[1][1]} r={4.5} cls="pc-tw pc-tw-1 pc-x" color="#ff9fbd" />
        </g>
      );
    case 'celebrating':
      return (
        <g className="pc-fx">
          {CONFETTI.map((k, i) => (
            <g key={i} className={`pc-conf pc-conf-${i}${i % 2 ? ' pc-x' : ''}`} style={origin(k.x, k.y)}>
              {k.shape === 'r'
                ? <rect x={k.x - 2.5} y={k.y - 4} width={5} height={8} rx={1.5} fill={k.c} stroke={INK} strokeWidth={1.4} transform={`rotate(${k.rot} ${k.x} ${k.y})`} />
                : <circle cx={k.x} cy={k.y} r={3} fill={k.c} stroke={INK} strokeWidth={1.4} />}
            </g>
          ))}
          <Sparkle x={a.sparkles[0][0]} y={a.sparkles[0][1] + 4} r={5} cls="pc-tw pc-tw-0" />
          <Sparkle x={a.sparkles[1][0]} y={a.sparkles[1][1] + 4} r={5} cls="pc-tw pc-tw-1" color="#8fd3ff" />
        </g>
      );
    default:
      return null;
  }
}

/* ───────────────────────────── assembly ───────────────────────────── */

const BODIES: Record<CharacterKind, (props: { p: Pass; mood: Mood }) => ReactNode> = {
  truck: Truck,
  plane: Plane,
  bunny: Bunny,
};

export interface PalSvgProps {
  kind: CharacterKind;
  mood: Mood;
  flip?: boolean;
  /** Draw the light rim behind the silhouette (default true). */
  halo?: boolean;
  /** Draw the ground shadow (default true). */
  shadow?: boolean;
  /** Draw mood effects (z, sweat, confetti…) (default true). */
  fx?: boolean;
  /** Zoom in a little (used below 40px so the pal fills its avatar box). Baseline moves to 91% of the box. */
  tight?: boolean;
}

/** viewBox used for tiny avatars (see `tight`). */
export const TIGHT_VIEWBOX = '4 6 112 112';

const SHADOW_RX: Record<CharacterKind, number> = { truck: 47, plane: 40, bunny: 30 };

/** The pal as an <svg> (viewBox 0 0 120 120, baseline y=108). Decorative: wrap it to add a11y. */
export function PalSvg({ kind, mood, flip = false, halo = true, shadow = true, fx = true, tight = false }: PalSvgProps) {
  const Body = BODIES[kind];
  const flipT = flip ? `matrix(-1 0 0 1 ${VIEWBOX} 0)` : undefined;
  return (
    <svg className="pc-svg" viewBox={tight ? TIGHT_VIEWBOX : `0 0 ${VIEWBOX} ${VIEWBOX}`} width="100%" height="100%" aria-hidden="true" focusable="false" overflow="visible">
      {shadow && (
        <g className="pc-shadow" style={origin(60, BASELINE_Y)}>
          <ellipse cx={kind === 'truck' ? 60 : 61} cy={BASELINE_Y} rx={SHADOW_RX[kind]} ry={3.6} fill={INK} opacity={0.13} className="pc-shadow-e" />
        </g>
      )}
      <g transform={flipT}>
        <g className="pc-body" style={origin(ANCHOR.x, ANCHOR.y)}>
          {halo && (
            <g className="pc-halo">
              <Body p={{ halo: true }} mood={mood} />
            </g>
          )}
          <Body p={{ halo: false }} mood={mood} />
        </g>
        {fx && <Fx kind={kind} mood={mood} flip={flip} />}
      </g>
    </svg>
  );
}

/** Standalone cardboard box (viewBox 0 0 64 64). */
export function ParcelBoxSvg({ face = false }: { face?: boolean }) {
  const p: Pass = { halo: false };
  return (
    <svg className="pc-svg pc-box" viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">
      <ellipse cx={30} cy={58} rx={24} ry={3} fill={INK} opacity={0.13} className="pc-shadow-e" />
      <g transform="translate(-6 -8)">
        <g className="pc-halo">
          <Box p={{ halo: true }} x={12} y={65} w={38} h={34} />
        </g>
        <Box p={p} x={12} y={65} w={38} h={34} />
        {/* little "fragile heart" sticker */}
        <path d="M 22 53 c -2 -2.6 -6 -0.6 -4 2.2 l 4 3.8 l 4 -3.8 c 2 -2.8 -2 -4.8 -4 -2.2 Z" fill="#ff7b6b" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        {face && (
          <g>
            <ellipse cx={37} cy={50} rx={2.6} ry={3.3} fill={INK} />
            <ellipse cx={45} cy={50} rx={2.6} ry={3.3} fill={INK} />
            <circle cx={37.9} cy={48.8} r={1} fill={WHITE} />
            <circle cx={45.9} cy={48.8} r={1} fill={WHITE} />
            <path d="M 39 55 Q 41 57.4 43 55" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}
