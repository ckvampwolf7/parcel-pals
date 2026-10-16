/**
 * CHARACTERS PUBLIC API — owned by the Characters team. Keep these exports/props.
 * Art lives in ./art.tsx (pure SVG), motion in ./characters.css. See docs/characters.md.
 */
import { memo, useCallback, useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { CharacterKind, Locale, Mood } from '@/types';
import { useReducedMotion } from '@/store';
import { useT } from '@/i18n/useT';
import { t as translate } from '@/i18n';
import { PalSvg, ParcelBoxSvg, ANCHOR, BASELINE_Y, VIEWBOX } from './art';
import './characters.css';

export interface CharacterProps {
  kind: CharacterKind;
  mood?: Mood;            // default 'idle'
  size?: number;          // px, square box; default 96
  animated?: boolean;     // default true (still respects reduced motion)
  /** Accessible label. If omitted the character is decorative (aria-hidden). */
  title?: string;
  /** Direction of travel for 'moving' (scene moves left→right by default). */
  facing?: 'left' | 'right';
  className?: string;
}

/** All kinds / moods, in display order. */
export const CHARACTER_KINDS: readonly CharacterKind[] = ['truck', 'plane', 'bunny'];
export const MOODS: readonly Mood[] = ['idle', 'moving', 'waiting', 'sleeping', 'worried', 'happy', 'celebrating'];

/**
 * Geometry for placing a pal in a scene: the art uses a square viewBox of VIEWBOX units,
 * standing on y = BASELINE_Y. For a pal rendered at `size` px, its feet/wheels touch
 * `size * BASELINE_RATIO` px from the top, horizontally centred (ANCHOR).
 */
export const CHARACTER_GEOMETRY = { viewBox: VIEWBOX, baselineY: BASELINE_Y, anchor: ANCHOR, baselineRatio: BASELINE_Y / VIEWBOX } as const;

/** Below this size details are simplified (thicker outline, fewer effects). */
const TINY = 40;

/* Pause animations of pals that are off-screen (long lists). One shared observer. */
let io: IntersectionObserver | null = null;
function observer(): IntersectionObserver | null {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('pc--paused', !e.isIntersecting);
  }, { rootMargin: '64px' });
  return io;
}

const Art = memo(PalSvg);

export function Character({ kind, mood = 'idle', size = 96, animated = true, title, facing = 'right', className }: CharacterProps) {
  const reduced = useReducedMotion();
  const still = !animated || reduced;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const obs = still ? null : observer();
    if (!el || !obs) return;
    obs.observe(el);
    return () => { obs.unobserve(el); el.classList.remove('pc--paused'); };
  }, [still]);

  const cls = ['pc', `pc--${kind}`, `pc--${mood}`, size < TINY && 'pc--tiny', still && 'pc--static', className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={cls}
      data-testid="character" data-kind={kind} data-mood={mood}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ width: size, height: size }}
    >
      <Art kind={kind} mood={mood} flip={facing === 'left'} tight={size < TINY} />
    </div>
  );
}

/** "붕붕이, 열심히 가는 중" — ready-made accessible label for <Character title>. */
export function characterLabel(kind: CharacterKind, mood: Mood = 'idle', locale?: Locale): string {
  return translate('characters.alt', {
    name: translate(`common.char.${kind}`, undefined, locale),
    mood: translate(`characters.mood.${mood}`, undefined, locale),
  }, locale);
}

/* ───────────────────────────── ParcelBox ───────────────────────────── */

export interface ParcelBoxProps {
  size?: number; //      px, square; default 48
  /** Accessible label; decorative when omitted. */
  title?: string;
  /** Tiny happy face on the box (empty states). */
  face?: boolean;
  /** Gentle idle wobble (respects reduced motion). */
  animated?: boolean;
  className?: string;
}

/** Cute cardboard box with tape, for scenes / empty states / handoff moments. */
export function ParcelBox({ size = 48, title, face = false, animated = false, className }: ParcelBoxProps) {
  const reduced = useReducedMotion();
  const cls = ['pc-parcel', animated && !reduced && 'pc-parcel--wobble', size < TINY && 'pc--tiny', className].filter(Boolean).join(' ');
  return (
    <div className={cls} data-testid="parcel-box" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ width: size, height: size }}>
      <ParcelBoxSvg face={face} />
    </div>
  );
}

/* ───────────────────────────── CharacterPicker ───────────────────────────── */

export interface CharacterPickerProps {
  value: CharacterKind | 'auto';
  onChange: (v: CharacterKind | 'auto') => void;
  includeAuto?: boolean;
  /** accessible group label */
  label: string;
  /** Show the one-line explanation of 'auto' under the options (default true when includeAuto). */
  showAutoHint?: boolean;
}

type Opt = CharacterKind | 'auto';

/** Radio-group style picker showing each pal (used in Add Parcel + Settings). */
export function CharacterPicker({ value, onChange, includeAuto, label, showAutoHint = true }: CharacterPickerProps) {
  const { t } = useT();
  const hintId = useId();
  const opts: Opt[] = [...(includeAuto ? (['auto'] as const) : []), ...CHARACTER_KINDS];
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, opts.indexOf(value));

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const i = refs.current.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % opts.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + opts.length) % opts.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = opts.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(opts[next]);
  }, [opts, onChange]);

  const hint = includeAuto && showAutoHint;
  return (
    <div className="pc-picker-wrap">
      <div role="radiogroup" aria-label={label} aria-describedby={hint ? hintId : undefined}
        className="pc-picker" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }} onKeyDown={onKeyDown}>
        {opts.map((o, i) => {
          const checked = value === o;
          return (
            <button
              key={o}
              ref={(el) => { refs.current[i] = el; }}
              type="button" role="radio" aria-checked={checked}
              tabIndex={i === selectedIndex ? 0 : -1}
              data-testid={`character-option-${o}`}
              className={`pc-option pc-option--${o}`}
              onClick={() => onChange(o)}
            >
              <span className="pc-option-art" aria-hidden="true">
                {o === 'auto' ? (
                  <span className="pc-auto">
                    <Character kind="plane" size={34} mood={checked ? 'happy' : 'idle'} animated={checked} className="pc-auto-b" />
                    <Character kind="truck" size={34} mood={checked ? 'happy' : 'idle'} animated={checked} className="pc-auto-a" />
                  </span>
                ) : (
                  <Character kind={o} size={48} mood={checked ? 'happy' : 'idle'} animated={checked} />
                )}
              </span>
              <span className="pc-option-name">{t(`common.char.${o}`)}</span>
              <span className="pc-option-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 8.4l2.6 2.6L12 5.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </button>
          );
        })}
      </div>
      {hint && <p id={hintId} className="pc-picker-hint">{t('characters.picker.autoHint')}</p>}
    </div>
  );
}

/* ───────────────────────────── meta ───────────────────────────── */

export interface CharacterMeta {
  color: string; //          CSS colour (token)
  emoji: string; //          fallback / plain-text contexts
  /** CSS soft background colour that pairs with the pal (token) */
  softColor: string;
  nameKey: string; //        t(nameKey) → 붕붕이 / Vroomy
  soundKey: string; //       t(soundKey) → 부릉부릉! / Vroom!
  catchphraseKey: string; // t(catchphraseKey) → one-line intro
  taglineKey: string; //     t(taglineKey) → short role description
}

/** Per-character info (names come from i18n common.char.<kind>). */
export const CHARACTER_META: Record<CharacterKind, CharacterMeta> = {
  truck: { color: 'var(--c-char-truck)', emoji: '🚚', softColor: 'var(--c-tone-progress-soft)', nameKey: 'common.char.truck', soundKey: 'characters.truck.sound', catchphraseKey: 'characters.truck.catchphrase', taglineKey: 'characters.truck.tagline' },
  plane: { color: 'var(--c-char-plane)', emoji: '✈️', softColor: 'var(--c-tone-info-soft)', nameKey: 'common.char.plane', soundKey: 'characters.plane.sound', catchphraseKey: 'characters.plane.catchphrase', taglineKey: 'characters.plane.tagline' },
  bunny: { color: 'var(--c-char-bunny)', emoji: '🐰', softColor: 'var(--c-coral-soft)', nameKey: 'common.char.bunny', soundKey: 'characters.bunny.sound', catchphraseKey: 'characters.bunny.catchphrase', taglineKey: 'characters.bunny.tagline' },
};
