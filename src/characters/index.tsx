/**
 * CHARACTERS PUBLIC API — owned by the Character team. Keep these exports/props.
 * LEAD STUB: emoji in a colored blob. Replace with real SVG characters.
 */
import type { CharacterKind, Mood } from '@/types';

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

const EMOJI: Record<CharacterKind, string> = { truck: '🚚', plane: '✈️', bunny: '🐰' };

export function Character({ kind, mood = 'idle', size = 96, title, className }: CharacterProps) {
  return (
    <div
      className={className}
      data-testid="character" data-kind={kind} data-mood={mood}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: size * 0.5, background: `var(--c-char-${kind})` }}
    >
      {EMOJI[kind]}
    </div>
  );
}

export interface CharacterPickerProps {
  value: CharacterKind | 'auto';
  onChange: (v: CharacterKind | 'auto') => void;
  includeAuto?: boolean;
  /** accessible group label */
  label: string;
}

/** Radio-group style picker showing each pal (used in Add Parcel + Settings). */
export function CharacterPicker({ value, onChange, includeAuto, label }: CharacterPickerProps) {
  const opts: Array<CharacterKind | 'auto'> = [...(includeAuto ? (['auto'] as const) : []), 'truck', 'plane', 'bunny'];
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 8 }}>
      {opts.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} data-testid={`character-option-${o}`} onClick={() => onChange(o)}>
          {o === 'auto' ? '✨' : EMOJI[o]}
        </button>
      ))}
    </div>
  );
}

/** Per-character info (names come from i18n common.char.<kind>). */
export const CHARACTER_META: Record<CharacterKind, { color: string; emoji: string }> = {
  truck: { color: 'var(--c-char-truck)', emoji: '🚚' },
  plane: { color: 'var(--c-char-plane)', emoji: '✈️' },
  bunny: { color: 'var(--c-char-bunny)', emoji: '🐰' },
};
