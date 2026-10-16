import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharacterKind } from '@/types';
import { NAMESPACES } from '@/i18n';
import { Character, CharacterPicker, CHARACTER_KINDS, CHARACTER_META, MOODS, ParcelBox, characterLabel } from './index';

describe('Character', () => {
  it.each(CHARACTER_KINDS.flatMap((k) => MOODS.map((m) => [k, m] as const)))('renders %s / %s', (kind, mood) => {
    const { container } = render(<Character kind={kind} mood={mood} />);
    const root = screen.getByTestId('character');
    expect(root).toHaveAttribute('data-kind', kind);
    expect(root).toHaveAttribute('data-mood', mood);
    expect(root.className).toContain(`pc--${mood}`);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('is decorative without a title', () => {
    render(<Character kind="truck" />);
    const root = screen.getByTestId('character');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).not.toHaveAttribute('role');
  });

  it('is an img with a label when titled', () => {
    render(<Character kind="bunny" mood="happy" title="토토" />);
    const img = screen.getByRole('img', { name: '토토' });
    expect(img).toHaveAttribute('data-testid', 'character');
    expect(img).not.toHaveAttribute('aria-hidden');
  });

  it('defaults to idle, 96px, and respects size/facing/animated', () => {
    const { rerender, container } = render(<Character kind="plane" />);
    const root = screen.getByTestId('character');
    expect(root).toHaveAttribute('data-mood', 'idle');
    expect(root.style.width).toBe('96px');
    rerender(<Character kind="plane" size={28} facing="left" animated={false} />);
    expect(root.style.width).toBe('28px');
    expect(root.className).toContain('pc--tiny');
    expect(root.className).toContain('pc--static');
    expect(container.querySelector('g[transform^="matrix(-1"]')).toBeTruthy();
  });

  it('builds localized labels', () => {
    expect(characterLabel('truck', 'moving', 'ko')).toBe('붕붕이, 열심히 가는 중');
    expect(characterLabel('plane', 'sleeping', 'en')).toBe('Zoomy, taking a nap');
  });
});

describe('ParcelBox', () => {
  it('renders decorative and labelled', () => {
    const { rerender } = render(<ParcelBox />);
    expect(screen.getByTestId('parcel-box')).toHaveAttribute('aria-hidden', 'true');
    rerender(<ParcelBox title="box" face />);
    expect(screen.getByRole('img', { name: 'box' })).toBeInTheDocument();
  });
});

function Harness({ includeAuto, initial }: { includeAuto?: boolean; initial: CharacterKind | 'auto' }) {
  const [v, setV] = useState(initial);
  return <CharacterPicker value={v} onChange={setV} includeAuto={includeAuto} label="Pal" />;
}

describe('CharacterPicker', () => {
  it('renders a radiogroup with the right options', () => {
    render(<Harness includeAuto initial="auto" />);
    expect(screen.getByRole('radiogroup', { name: 'Pal' })).toBeInTheDocument();
    for (const o of ['auto', 'truck', 'plane', 'bunny']) {
      const b = screen.getByTestId(`character-option-${o}`);
      expect(b).toHaveAttribute('role', 'radio');
    }
    expect(screen.getByTestId('character-option-auto')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('omits auto unless asked', () => {
    render(<Harness initial="truck" />);
    expect(screen.queryByTestId('character-option-auto')).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('selects on click', async () => {
    const user = userEvent.setup();
    render(<Harness includeAuto initial="auto" />);
    await user.click(screen.getByTestId('character-option-bunny'));
    expect(screen.getByTestId('character-option-bunny')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('character-option-auto')).toHaveAttribute('aria-checked', 'false');
  });

  it('supports arrow keys, Home/End and roving tabindex', async () => {
    const user = userEvent.setup();
    render(<Harness includeAuto initial="truck" />);
    const truck = screen.getByTestId('character-option-truck');
    expect(truck).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('character-option-plane')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(truck).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const plane = screen.getByTestId('character-option-plane');
    expect(plane).toHaveFocus();
    expect(plane).toHaveAttribute('aria-checked', 'true');
    expect(plane).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByTestId('character-option-auto')).toHaveAttribute('aria-checked', 'true'); // wraps
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('character-option-bunny')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByTestId('character-option-auto')).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByTestId('character-option-bunny')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('meta + i18n', () => {
  it('has meta and keys in both locales', () => {
    const ns = NAMESPACES.characters;
    expect(Object.keys(ns.ko).sort()).toEqual(Object.keys(ns.en).sort());
    for (const k of CHARACTER_KINDS) {
      const m = CHARACTER_META[k];
      expect(m.color).toContain(`--c-char-${k}`);
      expect(m.emoji).toBeTruthy();
      for (const key of [m.soundKey, m.catchphraseKey, m.taglineKey]) expect(ns.ko[key.replace('characters.', '')]).toBeTruthy();
    }
    for (const mood of MOODS) expect(ns.en[`mood.${mood}`]).toBeTruthy();
  });
});
