/**
 * Live-data states that need the user's attention (real parcels only):
 *  not_found  — the carrier has no record yet (normal right after the label is made) or the carrier guess is wrong
 *  invalid    — the carrier rejected the number format (its own message is shown)
 *  unsupported — no real-time lookup for this carrier: link to its website
 * Offers one-tap re-lookup with other plausible carriers.
 */
import { useState } from 'react';
import type { Parcel, TrackingSnapshot } from '@/types';
import { detectCarriers, getCarrier, supportsLiveTracking, trackingUrlFor } from '@/engine';
import { actions } from '@/store';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n/useT';

export function LiveStatusCard({ parcel, snapshot }: { parcel: Parcel; snapshot: TrackingSnapshot }) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const status = snapshot.liveStatus;
  if (!status || status === 'ok') return null;
  const url = trackingUrlFor(parcel.carrierId, parcel.trackingNumber);
  const name = (id: string) => { const c = getCarrier(id); return c ? (locale === 'ko' ? c.nameKo : c.nameEn) : id; };
  const alternatives = status === 'unsupported' ? [] : detectCarriers(parcel.trackingNumber)
    .map((m) => m.carrier.id)
    .filter((id) => id !== parcel.carrierId && supportsLiveTracking(id))
    .slice(0, 4);
  const retry = async (id: string) => {
    setBusy(id);
    try { await actions.changeCarrier(parcel.id, id); } finally { setBusy(null); }
  };
  return (
    <section className={`jr-card jr-live jr-live--${status}`} data-testid="live-status" data-live-status={status} aria-labelledby="jr-live-title">
      <h2 id="jr-live-title" className="jr-card__title"><Icon name={status === 'unsupported' ? 'info' : 'search'} size={20} /> {t(`journey.live.${status}.title`)}</h2>
      <p className="jr-live__body">{t(`journey.live.${status}.body`, { carrier: name(parcel.carrierId) })}</p>
      {status === 'invalid' && snapshot.liveMessage && <p className="jr-live__quote">“{snapshot.liveMessage}”</p>}
      {alternatives.length > 0 && (
        <div className="jr-live__alts">
          <p className="jr-live__hint">{t('journey.live.tryOther')}</p>
          <div className="jr-live__chips">
            {alternatives.map((id) => (
              <button key={id} type="button" className="jr-live__chip" data-testid="retry-carrier" data-carrier-id={id}
                onClick={() => retry(id)} disabled={!!busy} aria-busy={busy === id}>
                {busy === id ? <Icon name="refresh" size={16} className="jr-spin" /> : null}{name(id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {url && (
        <a className="jr-live__link" href={url} target="_blank" rel="noopener noreferrer">
          {t('journey.live.openSite', { carrier: name(parcel.carrierId) })} <Icon name="external" size={16} />
        </a>
      )}
    </section>
  );
}
