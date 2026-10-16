# Characters — 붕붕이 · 슝슝이 · 토토

Owner: Characters team. Code: `src/characters/` (`index.tsx` public API, `art.tsx` pure SVG art, `characters.css` motion, `Gallery.tsx` review sheet). Strings: `src/i18n/ns/characters.ts` (names stay in `common.char.<kind>`).

## The family

| Pal | Kind | Look | Signature |
|---|---|---|---|
| **붕붕이 / Vroomy** | `truck` | chubby orange (`--c-char-truck`) cab with the face on its door, sky-blue windshield like a fringe, a taped cardboard parcel riding on the bed, yellow headlight, chunky wheels | parcel pops up when celebrating, headlight dims when sleeping |
| **슝슝이 / Zoomy** | `plane` | round blue (`--c-char-plane`) bean-shaped fuselage, face on the nose, pilot goggles pushed up on the forehead, propeller, little flipper-wing, landing wheels | propeller spins, wing waves like an arm |
| **토토 / Toto** | `bunny` | pink (`--c-char-bunny`) chibi bunny, big head, long ears, pal-blue courier cap, parcel backpack with a brown strap | ears flap/droop, arms cheer, foot taps |

**Shared style rules** (keep these when adding a pal)
- Chunky rounded shapes, flat fills + **one** soft shade (darker band at the bottom) + one small light highlight stroke.
- Outline: `#2d2a45` (ink), 3.2 viewBox units (≈2.6px at 96px). Inner details use 2.2.
- **Halo**: every silhouette shape is drawn twice — first in a halo pass (fill+stroke = `--pc-halo`, stroke 8.2) then normally — giving a sticker rim that keeps the pals readable on dark backgrounds and on coloured scenes. Light: white, dark: `#f3f1ff`. No SVG filters anywhere.
- Same face for everyone (`Face` in `art.tsx`): oval ink eyes with two white glints, blush cheeks below-outside the eyes, mouth 9 units under the eye line. Faces sit toward the direction of travel (3/4 view).
- Colours are hex presentation attributes mirroring the tokens (so the SVG renders standalone for icons); CSS re-maps signature fills to `--c-char-*`, and halo / shadow / speed lines to theme-aware local vars (`--pc-halo`, `--pc-shadow`, `--pc-speed`). Theme is detected with `[data-theme='dark']` on any ancestor.

## Geometry / anchor (for scenes)

```
viewBox 0 0 120 120            (square; art is drawn facing right)
baseline (ground) y = 108      → 90% of the box height
anchor  (60, 108)              → bottom-centre: put this on the path
ground shadow ellipse at y=108 (moves/squashes with jumps)
```
`CHARACTER_GEOMETRY` exports `{ viewBox: 120, baselineY: 108, anchor: {x:60,y:108}, baselineRatio: 0.9 }`.
To stand a pal of `size` px on a path point `(px, py)`: `left = px - size/2`, `top = py - size*0.9`.

- `facing="left"` mirrors the whole pal around the vertical centre (anchor unchanged). Text-like effects (the "z"s) are un-mirrored.
- Effects (confetti, z, bubbles) may poke slightly outside the box (`overflow: visible`); leave ~10% headroom above.
- Below 40px (`pc--tiny`) the art uses a tighter viewBox (`4 6 112 112`) so the pal fills its avatar box; baseline is then at ~91%. Don't use < 40px on a path.

## Moods

Every pal supports every mood. The **un-animated state is the static pose**, so reduced motion (global kill switch, `useReducedMotion()`, or `animated={false}` → `.pc--static`) still reads the mood.

| Mood | Face | Static pose / effect | Motion (all transform/opacity) |
|---|---|---|---|
| `idle` | open eyes, small smile (Toto: ω mouth + nose) | — | slow breathe (3.4s), blink every ~5s; Zoomy's prop drifts, Toto's ear twitches |
| `moving` | open eyes, open smile | speed lines behind; exhaust puff / cloud puff / dust puff | Vroomy: road rumble + wheels spin; Zoomy: float/tilt + fast propeller; Toto: hop with squash & stretch, ears flap, shadow shrinks |
| `waiting` | eyes open, small flat mouth | "…" thought bubble | gentle sway, eyes look left↔right, dots bounce; Toto taps a foot, Vroomy's headlight pulses |
| `sleeping` | closed ︶ eyes, tiny "o" mouth | two "z"; Toto's ears flop sideways; Vroomy's headlight off | slow deep breaths, z's float up and fade |
| `worried` | worried brows, wobbly mouth, softer cheeks | one sweat drop; Toto's ears slightly down | *gentle* side-to-side sway (concerned, reassuring — never panicky shaking); drop slides and fades |
| `happy` | sparkly open eyes, open smile, rosier cheeks | two twinkles; Toto waves, Zoomy's wing lifts | bounce with squash; twinkles pulse; Zoomy's prop spins |
| `celebrating` | ^ ^ eyes, big open mouth | confetti + twinkles; Toto both arms up, Zoomy wing up, Vroomy's parcel pops up | big jump with squash & stretch, cheering arms/wing, falling confetti |

Performance: lean SVG (≈40–70 elements per pal incl. halo), no filters, CSS keyframes only. Off-screen pals are paused by one shared `IntersectionObserver` (`.pc--paused`). The art component is memoised.

## API (`@/characters`)

```tsx
<Character kind mood="idle" size={96} animated title="…" facing="right" className />
<CharacterPicker value onChange includeAuto label showAutoHint />
<ParcelBox size={48} title face animated className />   // cardboard box with tape (+ optional tiny face)
CHARACTER_META[kind]   // { color, emoji, softColor, nameKey, soundKey, catchphraseKey, taglineKey }
CHARACTER_KINDS, MOODS, CHARACTER_GEOMETRY
characterLabel(kind, mood?, locale?)  // "붕붕이, 열심히 가는 중" — use as <Character title>
```
- Root: `data-testid="character" data-kind data-mood`; `role="img"` + `aria-label` when `title`, else `aria-hidden`.
- Picker: `role="radiogroup"`, options `data-testid="character-option-<auto|truck|plane|bunny>"` with `role="radio"` + `aria-checked`, roving tabindex, ←/→/↑/↓ move **and select** (wrapping), Home/End; selected = primary border + soft fill + check badge (not colour-only) and the pal turns `happy`. With `includeAuto` it shows a one-line hint (`characters.picker.autoHint`) linked via `aria-describedby` (`showAutoHint={false}` to hide). Grid of equal columns — fits 4 options at 320px+.

## Brand art

`node scripts/render-icons.mjs` renders from the same art (via Vite SSR + Playwright Chromium) into `public/icons/`:
`icon.svg` (rounded square), `icon-192.png`, `icon-512.png` (purpose any, transparent corners), `maskable-512.png` (full-bleed, pal inside the central 66%), `apple-touch-icon.png` (180, full-bleed), `favicon-32.png`, `og-image.png` (1200×630, Jua wordmark + all three pals). Re-run it after changing the art.

## Reviewing

`Gallery.tsx` shows all pals × moods (light & dark side by side), sizes 28→200, 28px avatars, a plane→box→truck handoff at 64/80px, and the pickers. It is not routed. To view it, create a throwaway `characters-gallery.html` at the repo root (dev server serves it; never reference it from `index.html`):

```html
<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div>
<script type="module">
  import '@fontsource/jua/400.css';
  import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
  import '/src/styles/tokens.css'; import '/src/styles/global.css';
  import { createElement } from 'react'; import { createRoot } from 'react-dom/client';
  import Gallery from '/src/characters/Gallery.tsx';
  createRoot(document.getElementById('root')).render(createElement(Gallery));
</script></body></html>
```
Query params: `?static=1` (freeze), `?en=1`, `?section=moods|sizes|tiny|scene|picker`.

## Adding a pal

1. Add the kind to `CharacterKind` (lead), its colour token `--c-char-<kind>` and `common.char.<kind>`.
2. In `art.tsx`: add a body component `(p: Pass, mood) => …` drawing silhouette shapes with `paint(p, colour, 'pc-m')` (so the halo pass works), details only when `!p.halo` (give small ones `className="pc-d"` so they hide below 40px), a `FaceSpec`, and an entry in `BODIES`, `FX` (effect anchor points) and `SHADOW_RX`. Stand on y=108, roughly x 10–110, face toward the right.
3. Animated parts are `<g className="pc-…" style={origin(x, y)}>` with **no** transform attribute (wrap rotated shapes in an inner `<g transform>`).
4. In `characters.css`: `.pc--<kind> .pc-m { fill: var(--c-char-<kind>) }` plus per-mood rules; keep the base state = static pose.
5. i18n: `characters.<kind>.sound|tagline|catchphrase` in ko + en; `CHARACTER_META` entry.
6. Check the gallery at 28/48/96/200px in light + dark, and re-run `scripts/render-icons.mjs` if brand art changes.
