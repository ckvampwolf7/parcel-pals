/** Parcel detail (#/p/<id>): header, journey scene + pal speech, info cards, timeline, menu. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Parcel } from '@/types';
import { characterLine, formatRelative, formatSnapshotEta, getCarrier } from '@/engine';
import { actions, useSimNow } from '@/store';
import { Character } from '@/characters';
import { IconButton, StatusChip, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { JourneyScene, sceneStops } from './JourneyScene';
import { CarrierCard, EtaCard, PickupCard, WhereCard } from './InfoCards';
import { Timeline } from './Timeline';
import { ParcelMenu } from './ParcelMenu';
import { describeJourney } from './describe';
import { nextStep } from './engineCompat';
import { copyText, fmtDate, prettyNumber } from './format';
import './journey.css';

/** Which checkpoints count as "new" for highlighting: unseen at open + anything arriving while open. */
function useNewIds(parcel: Parcel): Set<string> {
  const base = useRef<{ known: Set<string>; unseen: Set<string> } | null>(null);
  const cps = parcel.snapshot?.checkpoints;
  if (!base.current && cps) {
    let unseen: string[] = [];
    if (parcel.unread > 0) unseen = cps.slice(-parcel.unread).map((c) => c.id);
    else if (parcel.lastSeenCheckpointId) {
      const i = cps.findIndex((c) => c.id === parcel.lastSeenCheckpointId);
      if (i >= 0) unseen = cps.slice(i + 1).map((c) => c.id);
    }
    base.current = { known: new Set(cps.map((c) => c.id)), unseen: new Set(unseen) };
  }
  return useMemo(() => {
    const b = base.current;
    const out = new Set<string>(b?.unseen ?? []);
    if (b) cps?.forEach((c) => { if (!b.known.has(c.id)) out.add(c.id); });
    return out;
  }, [cps]);
}

export function ParcelView({ parcel }: { parcel: Parcel }) {
  const { t, lt, locale } = useT();
  const now = useSimNow(20000);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ffBusy, setFfBusy] = useState(false);
  const ffHint = useId();
  const snap = parcel.snapshot;
  const carrier = getCarrier(parcel.carrierId);
  const carrierName = carrier ? (locale === 'ko' ? carrier.nameKo : carrier.nameEn) : t('journey.carrier.unknown');
  const newIds = useNewIds(parcel);

  // mark seen on open and whenever new checkpoints arrive while open
  const latestId = snap?.checkpoints.at(-1)?.id;
  useEffect(() => {
    if (parcel.unread > 0 || (latestId && parcel.lastSeenCheckpointId !== latestId)) actions.markSeen(parcel.id);
  }, [parcel.id, parcel.unread, parcel.lastSeenCheckpointId, latestId]);

  const stops = useMemo(
    () => (snap ? sceneStops(snap, { origin: t('journey.stop.origin'), destination: t('journey.stop.destination') }) : []),
    [snap, t],
  );
  const line = characterLine(parcel, locale);
  const next = nextStep(parcel, locale, now);
  const description = snap ? describeJourney(parcel, snap, stops, t, lt) : '';
  const delivered = snap?.status === 'delivered';
  const deliveredAt = delivered ? [...snap.checkpoints].reverse().find((c) => c.status === 'delivered')?.time : undefined;

  const copyNumber = async () => {
    const ok = await copyText(parcel.trackingNumber);
    showToast({ text: ok ? t('journey.copied') : t('journey.copyFail'), tone: ok ? 'success' : 'warning', durationMs: 2000 });
  };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await actions.refresh(parcel.id); } finally { setRefreshing(false); }
  };
  const fastForward = async () => {
    if (ffBusy) return;
    setFfBusy(true);
    try { await actions.fastForward(3); } finally { setFfBusy(false); }
  };
  const busy = refreshing || !!parcel.refreshing;

  return (
    <>
      <TopBar
        back
        title={parcel.nickname}
        titleTestId="parcel-title"
        actions={<IconButton icon="more" label={t('journey.menu')} data-testid="parcel-menu" aria-haspopup="dialog" onClick={() => setMenuOpen(true)} />}
      />
      <main className="jr-screen" data-char={parcel.character}>
        <header className="jr-head">
          <div className="jr-head__chips">
            {snap ? <StatusChip status={snap.status} /> : <span className="jr-skel jr-skel--chip" />}
            {snap?.delayed && !delivered && (
              <span className="jr-badge jr-badge--warn"><Icon name="clock" size={14} /> {t('journey.delayed')}</span>
            )}
            {parcel.archived && <span className="jr-badge"><Icon name="archive" size={14} /> {t('journey.archived')}</span>}
          </div>
          <p className="jr-eta" data-testid="eta">
            {delivered
              ? t('journey.deliveredAt', { time: deliveredAt ? fmtDate(deliveredAt, locale) : '' }).trim()
              : formatSnapshotEta(snap, locale, now)}
          </p>
          <button type="button" className="jr-carrierline" onClick={copyNumber}>
            <span>{carrierName}</span>
            <span className="jr-carrierline__sep" aria-hidden="true">·</span>
            <span className="jr-mono">{prettyNumber(parcel.trackingNumber)}</span>
            <span className="sr-only"> ({t('journey.copyHint')})</span>
            <Icon name="copy" size={15} />
          </button>
        </header>

        {snap ? (
          <JourneyScene parcel={parcel} snapshot={snap} line={line} next={next} description={description} />
        ) : (
          <div className="jr-loading" role="status">
            <div className="jr-scene jr-scene--loading" data-testid="journey-scene" data-progress="0" data-phase="day">
              <div className="jr-loading__pal"><Character kind={parcel.character} mood="waiting" size={84} /></div>
            </div>
            <div className="jr-bubble" data-testid="speech-bubble">
              <span className="jr-bubble__tail" style={{ left: '50%' }} aria-hidden="true" />
              <span className="jr-bubble__who">{t(`common.char.${parcel.character}`)}</span>
              <p className="jr-bubble__line">{t('journey.loading')}</p>
            </div>
          </div>
        )}

        <div className="jr-actions">
          <span className="jr-updated">
            {snap && t('journey.updated', { ago: formatRelative(snap.updatedAt, locale, now) })}
          </span>
          <button type="button" className="jr-chipbtn jr-chipbtn--demo" data-testid="fast-forward" onClick={fastForward} disabled={ffBusy} aria-describedby={ffHint}>
            <span aria-hidden="true">⏩</span> {t('journey.ff')}
            <span className="jr-chipbtn__tag">{t('journey.demoTag')}</span>
          </button>
          <span id={ffHint} className="sr-only">{t('journey.ffLabel')}</span>
          <button type="button" className="jr-chipbtn" data-testid="refresh-parcel" onClick={refresh} aria-busy={busy} aria-label={busy ? t('journey.refreshing') : t('journey.refresh')}>
            <Icon name="refresh" size={18} className={busy ? 'jr-spin' : undefined} />
          </button>
        </div>
        {parcel.error && (
          <p className="jr-note jr-note--warning" role="alert"><Icon name="alert" size={20} /><span>{t('journey.refreshError')}</span></p>
        )}

        {snap ? (
          <>
            {snap.status === 'available_for_pickup' && <PickupCard snapshot={snap} />}
            <WhereCard snapshot={snap} stops={stops} />
            <EtaCard snapshot={snap} now={now} />
            <Timeline parcel={parcel} checkpoints={snap.checkpoints} newIds={newIds} now={now} />
            <CarrierCard parcel={parcel} snapshot={snap} />
          </>
        ) : (
          <>
            <div className="jr-card" aria-hidden="true"><span className="jr-skel" /><span className="jr-skel jr-skel--short" /></div>
            <div className="jr-card" aria-hidden="true"><span className="jr-skel" /><span className="jr-skel" /><span className="jr-skel jr-skel--short" /></div>
            <CarrierCard parcel={parcel} snapshot={null} />
          </>
        )}
      </main>
      <ParcelMenu parcel={parcel} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

export function ParcelNotFound() {
  const { t } = useT();
  return (
    <>
      <TopBar back onBack={() => navigate('/', { replace: true })} title={t('common.appName')} />
      <main className="jr-screen jr-empty">
        <Character kind="truck" mood="worried" size={120} title={t('common.char.truck')} />
        <h2 className="jr-empty__title">{t('journey.notFound.title')}</h2>
        <p className="jr-card__body">{t('journey.notFound.body')}</p>
        <a className="ui-btn ui-btn--primary" href="#/">{t('journey.notFound.home')}</a>
      </main>
    </>
  );
}
