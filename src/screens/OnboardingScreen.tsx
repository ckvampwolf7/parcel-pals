/** Onboarding (UI team): 3 swipeable cards introducing the pals; rendered full-screen by AppShell until settings.onboarded. */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { actions } from '@/store';
import { Character } from '@/characters';
import { navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui';
import { SpeechBubble, Spinner } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { carrierName } from '@/components/parcelInfo';
import './onboarding/onboarding.css';

const TOTAL = 3;

function ArtPals({ say }: { say: string }) {
  return (
    <div className="onb-art onb-art--pals">
      <SpeechBubble tail="bottom" className="onb-art__say">{say}</SpeechBubble>
      <div className="onb-trio">
        <Character kind="plane" mood="happy" size={92} className="onb-trio__plane" />
        <Character kind="truck" mood="moving" size={124} className="onb-trio__truck" />
        <Character kind="bunny" mood="happy" size={88} className="onb-trio__bunny" />
      </div>
    </div>
  );
}

function ArtCarriers({ number, say }: { number: string; say: string }) {
  const { locale } = useT();
  const chips = ['kr.cjlogistics', 'kr.hanjin', 'kr.lotte'];
  const fallback: Record<string, string> = { 'kr.cjlogistics': 'CJ대한통운', 'kr.hanjin': '한진택배', 'kr.lotte': '롯데택배' };
  const name = (id: string) => { const n = carrierName(id, locale); return n === id ? fallback[id] : n; };
  return (
    <div className="onb-art onb-art--carriers">
      <div className="onb-mock">
        <div className="onb-mock__input"><Icon name="search" size={20} /><span className="font-display">{number}</span></div>
        <div className="onb-mock__chips">
          {chips.map((c, i) => <span key={c} className={`onb-mock__chip ${i === 0 ? 'is-on' : ''}`}>{i === 0 && <Icon name="check" size={14} />}{name(c)}</span>)}
        </div>
      </div>
      <div className="onb-art__row">
        <Character kind="truck" mood="happy" size={84} />
        <SpeechBubble tail="left">{say}</SpeechBubble>
      </div>
    </div>
  );
}

function ArtExplain({ raw, say }: { raw: string; say: string }) {
  return (
    <div className="onb-art onb-art--explain">
      <div className="onb-raw"><span className="onb-raw__tag">{raw}</span><Icon name="chevronDown" size={20} /></div>
      <div className="onb-art__row">
        <Character kind="bunny" mood="happy" size={88} />
        <SpeechBubble tail="left">{say}</SpeechBubble>
      </div>
      <div className="onb-bell"><Icon name="bell" size={18} /><span className="onb-bell__dot" /></div>
    </div>
  );
}

export default function OnboardingScreen() {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number; horizontal?: boolean } | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const viaButton = useRef(false);

  useEffect(() => {
    if (viaButton.current && index === TOTAL - 1) actionsRef.current?.querySelector('button')?.focus();
    viaButton.current = false;
  }, [index]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(TOTAL - 1, i)));
  const finish = () => actions.updateSettings({ onboarded: true });
  const skip = () => { finish(); navigate('/', { replace: true }); };
  const startDemo = async () => {
    setBusy(true);
    try { await actions.loadDemo(); } finally { finish(); navigate('/', { replace: true }); }
  };
  const startAdd = () => { finish(); navigate('/add'); };

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  };
  const onDown = (e: RPointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: RPointerEvent) => {
    const s = start.current; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.horizontal === undefined && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.horizontal = Math.abs(dx) > Math.abs(dy);
    if (s.horizontal) setDragX(dx);
  };
  const onUp = () => {
    const dx = dragX; start.current = null; setDragX(0);
    if (dx < -50) go(index + 1); else if (dx > 50) go(index - 1);
  };

  const slides: Array<{ title: string; body: string; art: ReactNode }> = [
    { title: t('ui.onb.s1.title'), body: t('ui.onb.s1.body'), art: <ArtPals say={t('ui.onb.s1.say')} /> },
    { title: t('ui.onb.s2.title'), body: t('ui.onb.s2.body'), art: <ArtCarriers number={t('ui.onb.s2.number')} say={t('ui.onb.s2.say')} /> },
    { title: t('ui.onb.s3.title'), body: t('ui.onb.s3.body'), art: <ArtExplain raw={t('ui.onb.s3.raw')} say={t('ui.onb.s3.say')} /> },
  ];
  const last = index === TOTAL - 1;

  return (
    <main className="onb" data-testid="onboarding" aria-label={t('ui.onb.region')} onKeyDown={onKey}>
      <div className="onb-top">
        <span className="onb-top__brand font-display">{t('common.appName')}</span>
        {!last && <Button variant="ghost" size="sm" data-testid="onboarding-skip" onClick={skip}>{t('ui.onb.skip')}</Button>}
      </div>

      <div className="onb-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="onb-track" style={{ transform: `translateX(calc(${-index * 100}% + ${dragX}px))`, transition: dragX ? 'none' : undefined }}>
          {slides.map((s, i) => (
            <section key={i} className={`onb-slide onb-slide--${i + 1}`} role="group" aria-roledescription="slide"
              aria-label={t('ui.onb.step', { n: i + 1, total: TOTAL })} aria-hidden={i !== index} inert={i !== index}>
              <div className="onb-slide__art" aria-hidden="true">{s.art}</div>
              <h1 className="onb-slide__title">{s.title}</h1>
              <p className="onb-slide__body">{s.body}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="onb-bottom">
        <div className="onb-dots">
          {slides.map((_, i) => (
            <button key={i} type="button" className={`onb-dot ${i === index ? 'is-on' : ''}`} aria-label={t('ui.onb.dot', { n: i + 1 })}
              aria-current={i === index ? 'step' : undefined} onClick={() => go(i)} />
          ))}
        </div>
        {last ? (
          <div className="onb-actions" ref={actionsRef}>
            <Button block icon={busy ? undefined : 'sparkle'} data-testid="onboarding-demo" onClick={startDemo} disabled={busy} aria-busy={busy}>
              {busy && <Spinner size={18} />}{t('ui.onb.demo')}
            </Button>
            <Button block variant="secondary" icon="plus" data-testid="onboarding-add" onClick={startAdd} disabled={busy}>{t('ui.onb.add')}</Button>
          </div>
        ) : (
          <div className="onb-actions">
            <Button block data-testid="onboarding-next" onClick={() => { viaButton.current = true; go(index + 1); }}>
              {t('ui.onb.next')}<Icon name="chevronRight" size={20} />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
