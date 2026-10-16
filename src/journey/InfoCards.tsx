/** Info cards under the scene: where now, arrival window, carrier (+ handoff), pickup. */
import type { Parcel, RouteStop, TrackingSnapshot } from '@/types';
import { formatEta, formatRelative, getCarrier } from '@/engine';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { useT } from '@/i18n/useT';
import { hasKey } from '@/i18n';
import { positionInfo, whereLine } from './describe';
import { copyText, fmtDateTime, fmtEtaWindow, prettyNumber, trackingUrl } from './format';
import { ModeGlyph } from './ModeGlyph';

export function WhereCard({ snapshot, stops }: { snapshot: TrackingSnapshot; stops: RouteStop[] }) {
  const { t, lt } = useT();
  const { cur, next: nextIdx } = positionInfo(snapshot, stops);
  const delivered = snapshot.status === 'delivered';
  return (
    <section className="jr-card" aria-labelledby="jr-where-title">
      <div className="jr-card__head">
        <h2 id="jr-where-title" className="jr-card__title">{t('journey.where.title')}</h2>
        <span className="jr-card__meta">{t('journey.where.step', { i: cur + 1, n: stops.length })}</span>
      </div>
      <ol className="jr-steps" aria-hidden="true">
        {stops.map((s, i) => (
          <li key={s.id} className={`jr-steps__dot ${i <= cur ? 'is-done' : ''} ${i === cur && !delivered ? 'is-current' : ''}`} />
        ))}
      </ol>
      <div className="jr-where">
        <div className="jr-where__stop is-now">
          <span className="jr-where__k">{t('journey.where.now')}</span>
          <span className="jr-where__v">{lt(stops[cur]?.name)}</span>
        </div>
        {nextIdx >= 0 && !delivered && (
          <>
            <span className="jr-where__arrow" aria-hidden="true">
              <ModeGlyph mode={stops[cur]?.modeToNext ?? snapshot.currentMode} size={18} />
            </span>
            <div className="jr-where__stop">
              <span className="jr-where__k">{t('journey.where.next')}</span>
              <span className="jr-where__v">{lt(stops[nextIdx]?.name)}</span>
            </div>
          </>
        )}
      </div>
      <p className="jr-card__body">{whereLine(snapshot, stops, t, lt)}</p>
    </section>
  );
}

export function EtaCard({ snapshot, now }: { snapshot: TrackingSnapshot; now: Date }) {
  const { t, locale } = useT();
  const delivered = snapshot.status === 'delivered';
  const deliveredAt = delivered ? [...snapshot.checkpoints].reverse().find((c) => c.status === 'delivered')?.time : undefined;
  const last = snapshot.checkpoints.at(-1);
  const reasonKey = snapshot.delayReason ? `journey.delay.${snapshot.delayReason}` : '';
  const reason = reasonKey && hasKey(reasonKey, locale) ? t(reasonKey) : t('journey.delay.generic');
  return (
    <section className="jr-card" aria-labelledby="jr-eta-title">
      <div className="jr-card__head">
        <h2 id="jr-eta-title" className="jr-card__title">{delivered ? t('journey.eta.delivered') : t('journey.eta.title')}</h2>
      </div>
      {delivered ? (
        <p className="jr-eta-big">{deliveredAt ? fmtDateTime(deliveredAt, locale) : formatEta(snapshot.eta, locale, now)}</p>
      ) : snapshot.eta ? (
        <>
          <p className="jr-eta-big">{fmtEtaWindow(snapshot.eta, locale)}</p>
          {snapshot.eta.confidence !== undefined && snapshot.eta.confidence < 0.6 && <p className="jr-card__hint">{t('journey.eta.rough')}</p>}
        </>
      ) : (
        <p className="jr-card__body">{t('journey.eta.none')}</p>
      )}
      {snapshot.delayed && !delivered && (
        <div className="jr-note jr-note--warning" role="note">
          <Icon name="alert" size={20} />
          <div><b>{t('journey.delay.title')}</b><p>{reason}</p></div>
        </div>
      )}
      {snapshot.stale && !delivered && (
        <div className="jr-note jr-note--calm" role="note">
          <Icon name="moon" size={20} />
          <div>
            <b>{t('journey.stale.title')}</b>
            <p>{t('journey.stale.body', { ago: last ? formatRelative(last.time, locale, now) : '—' })}</p>
            <p>{t('journey.stale.next')}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function NumberRow({ number, label }: { number: string; label: string }) {
  const { t } = useT();
  const copy = async () => {
    const ok = await copyText(number);
    showToast({ text: ok ? t('journey.copied') : t('journey.copyFail'), tone: ok ? 'success' : 'warning', durationMs: 2000 });
  };
  return (
    <div className="jr-numrow">
      <span className="jr-numrow__k">{label}</span>
      <button type="button" className="jr-copy" onClick={copy}>
        <span className="jr-mono">{prettyNumber(number)}</span>
        <span className="sr-only"> ({t('journey.copyHint')})</span>
        <Icon name="copy" size={16} />
      </button>
    </div>
  );
}

export function CarrierCard({ parcel, snapshot }: { parcel: Parcel; snapshot: TrackingSnapshot | null }) {
  const { t, locale } = useT();
  const carrier = getCarrier(parcel.carrierId);
  const name = carrier ? (locale === 'ko' ? carrier.nameKo : carrier.nameEn) : t('journey.carrier.unknown');
  const url = trackingUrl(carrier?.trackingUrl, parcel.trackingNumber);
  const handoff = snapshot?.handoff;
  const hc = handoff ? getCarrier(handoff.carrierId) : undefined;
  const hName = hc ? (locale === 'ko' ? hc.nameKo : hc.nameEn) : handoff?.carrierId ?? '';
  const hUrl = handoff ? trackingUrl(hc?.trackingUrl, handoff.trackingNumber) : undefined;
  return (
    <section className="jr-card" aria-labelledby="jr-carrier-title">
      <div className="jr-card__head">
        <h2 id="jr-carrier-title" className="jr-card__title">{t('journey.carrier.title')}</h2>
      </div>
      <p className="jr-carrier-name">
        <span className="jr-carrier-dot" style={carrier?.color ? { background: carrier.color } : undefined} aria-hidden="true" />
        {name}
      </p>
      <NumberRow number={parcel.trackingNumber} label={t('journey.carrier.number')} />
      {url && (
        <a className="jr-linkbtn" data-testid="carrier-link" href={url} target="_blank" rel="noopener noreferrer">
          {t('journey.carrier.open')} <Icon name="external" size={18} />
        </a>
      )}
      {handoff && (
        <div className="jr-handoff" data-testid="handoff">
          <p className="jr-handoff__title"><Icon name="sparkle" size={18} /> {t('journey.handoff.title')}</p>
          <p className="jr-card__body">{t('journey.handoff.body', { carrier: hName })}</p>
          <NumberRow number={handoff.trackingNumber} label={hName} />
          {hUrl && (
            <a className="jr-linkbtn" href={hUrl} target="_blank" rel="noopener noreferrer">
              {t('journey.handoff.open', { carrier: hName })} <Icon name="external" size={18} />
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function PickupCard({ snapshot }: { snapshot: TrackingSnapshot }) {
  const { t, lt } = useT();
  if (!snapshot.pickup) return null;
  return (
    <section className="jr-card jr-card--pickup" aria-labelledby="jr-pickup-title">
      <div className="jr-card__head">
        <h2 id="jr-pickup-title" className="jr-card__title">{t('journey.pickup.title')}</h2>
        <span className="jr-card__meta">{t(`journey.pickup.kind.${snapshot.pickup.kind}`)}</span>
      </div>
      <p className="jr-eta-big">{lt(snapshot.pickup.place)}</p>
      <p className="jr-card__hint">{t('journey.pickup.hint')}</p>
    </section>
  );
}
