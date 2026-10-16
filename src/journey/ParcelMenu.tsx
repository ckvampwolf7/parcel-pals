/** Parcel menu sheet: rename, change pal, archive, share, delete (with confirm). */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { CharacterKind, Parcel } from '@/types';
import { formatEta, getCarrier, statusLabel } from '@/engine';
import { actions, simNow } from '@/store';
import { Character, CharacterPicker } from '@/characters';
import { Button, Sheet } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { copyText, prettyNumber } from './format';

type View = 'main' | 'pal' | 'confirm';

export function shareText(parcel: Parcel, t: (k: string, p?: Record<string, string | number>) => string, locale: 'ko' | 'en'): string {
  const c = getCarrier(parcel.carrierId);
  const s = parcel.snapshot;
  const lines = [
    `📦 ${parcel.nickname}`,
    s ? `${statusLabel(s.status, locale)} · ${s.status === 'delivered' ? statusLabel('delivered', locale) : formatEta(s.eta, locale, simNow())}` : '',
    `${c ? (locale === 'ko' ? c.nameKo : c.nameEn) : ''} ${prettyNumber(parcel.trackingNumber)}`.trim(),
    t('journey.share.via'),
  ];
  return lines.filter(Boolean).join('\n');
}

export function ParcelMenu({ parcel, open, onClose }: { parcel: Parcel; open: boolean; onClose: () => void }) {
  const { t, locale } = useT();
  const [view, setView] = useState<View>('main');
  const [name, setName] = useState(parcel.nickname);
  const inputId = useId();

  const nickname = parcel.nickname;
  // reset whenever the sheet opens
  useEffect(() => {
    if (open) { setView('main'); setName(nickname); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep focus inside the sheet when switching views
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    bodyRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus();
  }, [view]);

  const rename = (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v || v === parcel.nickname) { onClose(); return; }
    actions.updateParcel(parcel.id, { nickname: v });
    showToast({ text: t('journey.menu.renamed'), tone: 'success', character: parcel.character, mood: 'happy' });
    onClose();
  };

  const pickPal = (v: CharacterKind | 'auto') => {
    if (v === 'auto' || v === parcel.character) { setView('main'); return; }
    actions.updateParcel(parcel.id, { character: v });
    showToast({ text: t('journey.menu.palChanged', { name: t(`common.char.${v}`) }), character: v, mood: 'happy' });
    onClose();
  };

  const archive = () => {
    const next = !parcel.archived;
    actions.updateParcel(parcel.id, { archived: next });
    showToast({ text: t(next ? 'journey.menu.archivedToast' : 'journey.menu.unarchivedToast'), tone: 'neutral' });
    onClose();
  };

  const share = async () => {
    const text = shareText(parcel, t, locale);
    const title = t('journey.share.title', { name: parcel.nickname });
    onClose();
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title, text }); return; } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    const ok = await copyText(text);
    showToast({ text: ok ? t('journey.menu.shared') : t('journey.copyFail'), tone: ok ? 'success' : 'warning' });
  };

  const remove = () => {
    actions.removeParcel(parcel.id);
    onClose();
    navigate('/', { replace: true });
    showToast({ text: t('journey.menu.deleted'), tone: 'neutral' });
  };

  const title = view === 'pal' ? t('journey.menu.palTitle') : view === 'confirm' ? t('journey.menu.confirmTitle') : t('journey.menu.title');

  return (
    <Sheet open={open} onClose={onClose} title={title} testId="parcel-menu-sheet">
      <div ref={bodyRef}>
      {view === 'main' && (
        <div className="jr-menu">
          <form className="jr-rename" onSubmit={rename}>
            <label htmlFor={inputId} className="jr-rename__label">{t('journey.menu.rename')}</label>
            <div className="jr-rename__row">
              <input
                id={inputId}
                className="jr-input"
                data-testid="rename-input"
                value={name}
                maxLength={40}
                placeholder={t('journey.menu.renamePh')}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                enterKeyHint="done"
              />
              <Button type="submit" size="sm" data-testid="rename-save" disabled={!name.trim()}>{t('common.save')}</Button>
            </div>
          </form>
          <ul className="jr-menu__list">
            <li>
              <button type="button" className="jr-menu__item" data-testid="change-character" onClick={() => setView('pal')}>
                <span className="jr-menu__pal" aria-hidden="true"><Character kind={parcel.character} size={30} animated={false} /></span>
                {t('journey.menu.changePal')}
                <Icon name="chevronRight" size={18} className="jr-menu__chev" />
              </button>
            </li>
            <li>
              <button type="button" className="jr-menu__item" data-testid="share-parcel" onClick={share}>
                <Icon name="share" /> {t('journey.menu.share')}
              </button>
            </li>
            <li>
              <button type="button" className="jr-menu__item" data-testid="archive-parcel" onClick={archive}>
                <Icon name="archive" /> {parcel.archived ? t('journey.menu.unarchive') : t('journey.menu.archive')}
              </button>
            </li>
            <li>
              <button type="button" className="jr-menu__item is-danger" data-testid="delete-parcel" onClick={() => setView('confirm')}>
                <Icon name="trash" /> {t('journey.menu.delete')}
              </button>
            </li>
          </ul>
        </div>
      )}
      {view === 'pal' && (
        <div className="jr-menu jr-menu--pal">
          <CharacterPicker value={parcel.character} onChange={pickPal} label={t('journey.menu.palTitle')} />
          <Button variant="ghost" block onClick={() => setView('main')}>{t('common.back')}</Button>
        </div>
      )}
      {view === 'confirm' && (
        <div className="jr-menu jr-confirm">
          <div className="jr-confirm__pal" aria-hidden="true"><Character kind={parcel.character} mood="worried" size={72} /></div>
          <p className="jr-card__body">{t('journey.menu.confirmBody', { name: parcel.nickname })}</p>
          <div className="jr-confirm__row">
            <Button variant="secondary" onClick={() => setView('main')}>{t('common.cancel')}</Button>
            <Button variant="danger" data-testid="confirm-delete" onClick={remove}>{t('common.delete')}</Button>
          </div>
        </div>
      )}
      </div>
    </Sheet>
  );
}
