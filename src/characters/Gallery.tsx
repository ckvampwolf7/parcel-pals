/**
 * Dev-only review sheet for the pals (not routed by the app).
 * Mount it via a throwaway root html (see docs/characters.md):
 *   characters-gallery.html?static=1&en=1
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { CharacterKind } from '@/types';
import { actions } from '@/store';
import { Character, CharacterPicker, CHARACTER_KINDS, MOODS, ParcelBox, characterLabel } from './index';

const DARK_VARS = {
  '--c-bg': '#1b1930', '--c-bg-deep': '#141226', '--c-surface': '#25223e', '--c-surface-2': '#2e2b4a', '--c-line': '#3a3658',
  '--c-ink': '#f3f1ff', '--c-ink-2': '#c3bfe0', '--c-ink-3': '#8d88b0', '--c-primary': '#7d8cff', '--c-primary-soft': '#2f3366',
  '--c-on-primary': '#10102a', '--shadow-chunky': '0 4px 0 rgba(0,0,0,0.35)',
} as CSSProperties;

const params = new URLSearchParams(location.search);
const STILL = params.has('static');
const SECTION = params.get('section');

function Panel({ dark, children }: { dark: boolean; children: ReactNode }) {
  return (
    <div data-theme={dark ? 'dark' : 'light'} style={{ ...(dark ? DARK_VARS : {}), background: 'var(--c-bg)', color: 'var(--c-ink)', padding: 20, borderRadius: 20, flex: '1 1 0', minWidth: 0 }}>
      {children}
    </div>
  );
}

const cell: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--c-ink-2)' };

function MoodGrid({ size }: { size: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MOODS.length}, ${size + 8}px)`, gap: 10 }}>
      {CHARACTER_KINDS.map((k) => MOODS.map((m) => (
        <div key={k + m} style={cell}>
          <Character kind={k} mood={m} size={size} animated={!STILL} title={characterLabel(k, m)} />
          <span>{m}</span>
        </div>
      )))}
    </div>
  );
}

function Sizes({ kind }: { kind: CharacterKind }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
      {[28, 36, 48, 64, 120, 200].map((s) => (
        <div key={s} style={cell}><Character kind={kind} size={s} animated={!STILL} /><span>{s}</span></div>
      ))}
    </div>
  );
}

function TinyRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {CHARACTER_KINDS.map((k) => (
        <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {MOODS.map((m) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c-surface)', borderRadius: 12, padding: '4px 8px 4px 4px', fontSize: 12 }}>
              <Character kind={k} mood={m} size={28} animated={!STILL} /> <span>{m}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Handoff() {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[64, 80].map((s) => (
        <div key={s} style={{ display: 'flex', alignItems: 'flex-end', gap: 0, background: 'var(--c-surface)', borderRadius: 16, padding: '8px 12px', borderBottom: '3px solid var(--c-line)' }}>
          <Character kind="plane" mood="moving" size={s} animated={!STILL} />
          <ParcelBox size={s * 0.4} />
          <Character kind="truck" mood="happy" size={s} facing="left" animated={!STILL} />
          <Character kind="bunny" mood="moving" size={s} animated={!STILL} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <ParcelBox size={28} /><ParcelBox size={48} /><ParcelBox size={72} face animated={!STILL} />
      </div>
    </div>
  );
}

function Pickers() {
  const [a, setA] = useState<CharacterKind | 'auto'>('auto');
  const [b, setB] = useState<CharacterKind | 'auto'>('bunny');
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ width: 328, background: 'var(--c-surface)', padding: 16, borderRadius: 22 }}><CharacterPicker value={a} onChange={setA} includeAuto label="pal" /></div>
      <div style={{ width: 328, background: 'var(--c-surface)', padding: 16, borderRadius: 22 }}><CharacterPicker value={b} onChange={setB} label="pal" /></div>
    </div>
  );
}

const h: CSSProperties = { font: '18px var(--font-display)', margin: '18px 0 10px' };

export default function Gallery() {
  useEffect(() => { actions.updateSettings({ locale: params.has('en') ? 'en' : 'ko' }); }, []);
  const both = (node: () => ReactNode) => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Panel dark={false}>{node()}</Panel>
      <Panel dark>{node()}</Panel>
    </div>
  );
  const show = (s: string) => !SECTION || SECTION === s;
  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-body)', background: '#e9e4dc', minHeight: '100vh' }}>
      {show('moods') && (<><h2 style={h}>Moods · 96px</h2>{both(() => <MoodGrid size={96} />)}</>)}
      {show('sizes') && (<><h2 style={h}>Sizes</h2>{both(() => CHARACTER_KINDS.map((k) => <Sizes key={k} kind={k} />))}</>)}
      {show('tiny') && (<><h2 style={h}>28px avatars</h2>{both(() => <TinyRow />)}</>)}
      {show('scene') && (<><h2 style={h}>Handoff / box</h2>{both(() => <Handoff />)}</>)}
      {show('picker') && (<><h2 style={h}>Picker (328px)</h2>{both(() => <Pickers />)}</>)}
    </div>
  );
}
