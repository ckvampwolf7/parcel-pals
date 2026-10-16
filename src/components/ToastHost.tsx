/**
 * Renders toasts from the toast bus (`onToast`) and converts store events into toasts.
 * Max 2 stacked (newest on top), auto-dismiss (paused while hovered/focused), tap → navigate, swipe / ✕ to close.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { AppEvent } from '@/types';
import { subscribe, useSettings } from '@/store';
import { navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { onToast, showToast, type Toast } from './toast';
import { eventsToToasts } from './toastEvents';
import { PalAvatar } from './kit';
import { Icon } from './Icon';

const MAX_VISIBLE = 2;

/** Subscribes to store events and turns them into toasts (coalesced per tick). */
export function useStoreEventToasts() {
  const settings = useSettings();
  const ref = useRef(settings);
  useEffect(() => { ref.current = settings; }, [settings]);
  useEffect(() => {
    let buf: AppEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      const events = buf; buf = [];
      const s = ref.current;
      // Settings.notifications covers in-app update toasts too; errors still surface.
      const relevant = s.notifications ? events : events.filter((e) => e.type === 'error');
      eventsToToasts(relevant, s.locale, window.location.hash).forEach(showToast);
    };
    const unsub = subscribe((e) => {
      if (e.type !== 'parcel-updated' && e.type !== 'parcel-delivered' && e.type !== 'error') return;
      buf.push(e);
      if (!timer) timer = setTimeout(flush, 30);
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, []);
}

export function ToastHost() {
  const { t } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => onToast((toast) => setToasts((cur) => [toast, ...cur].slice(0, MAX_VISIBLE))), []);
  const dismiss = useCallback((id: number) => setToasts((cur) => cur.filter((x) => x.id !== id)), []);
  return (
    <div className="ui-toasts" role="region" aria-label={t('ui.toast.region')}>
      <div aria-live="polite" aria-atomic="false" className="ui-toasts__list">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t('ui.toast.close')} />)}
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss, closeLabel }: { toast: Toast; onDismiss: (id: number) => void; closeLabel: string }) {
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const remaining = useRef(toast.durationMs ?? 3500);

  useEffect(() => {
    if (paused) return;
    const began = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(1200, remaining.current - (Date.now() - began)); };
  }, [paused, toast.id, onDismiss]);

  const onPointerDown = (e: RPointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; moved.current = false; };
  const onPointerMove = (e: RPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = Math.min(0, e.clientY - start.current.y);
    if (Math.abs(dx) > 6 || dy < -6) { moved.current = true; setDrag({ x: dx, y: dy }); }
  };
  const onPointerUp = () => {
    const d = drag;
    start.current = null; setDrag(null);
    if (d && (Math.abs(d.x) > 70 || d.y < -36)) onDismiss(toast.id);
  };
  const activate = () => {
    if (moved.current) { moved.current = false; return; }
    if (toast.to) navigate(toast.to);
    onDismiss(toast.id);
  };

  const style = drag ? { transform: `translate(${drag.x}px, ${drag.y}px)`, opacity: Math.max(0.2, 1 - Math.abs(drag.x) / 220 + drag.y / 120), transition: 'none' } : undefined;
  const content = (
    <>
      {toast.character && <PalAvatar kind={toast.character} mood={toast.mood ?? 'happy'} size={44} animated />}
      {!toast.character && <span className={`ui-toast__icon ui-toast__icon--${toast.tone ?? 'neutral'}`} aria-hidden="true"><Icon name={toast.tone === 'danger' || toast.tone === 'warning' ? 'alert' : 'check'} size={20} /></span>}
      <span className="ui-toast__text">{toast.text}</span>
      {toast.to && <Icon name="chevronRight" size={18} className="ui-toast__chev" />}
    </>
  );
  return (
    <div
      className={`ui-toast ui-toast--${toast.tone ?? 'neutral'}`} data-testid="toast" style={style}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      {toast.to
        ? <button type="button" className="ui-toast__body" onClick={activate}>{content}</button>
        : <div className="ui-toast__body" onClick={activate}>{content}</div>}
      <button type="button" className="ui-toast__close" aria-label={closeLabel} onClick={() => onDismiss(toast.id)}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
