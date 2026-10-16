/** Home parcel cards (UI team): the hero card for the parcel arriving first, and the regular list card. */
import type { Parcel } from '@/types';
import { characterLine, formatEta, formatRelative, moodFor, statusTone } from '@/engine';
import { Character } from '@/characters';
import { href } from '@/router';
import { useT } from '@/i18n/useT';
import { ProgressBar, StatusChip } from '@/components/ui';
import { PalAvatar, Skeleton, SpeechBubble } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { carrierName, deliveredAt, isStale, lastCheckpoint, pickupPlace } from '@/components/parcelInfo';

function useCardBits(p: Parcel, now: Date) {
  const { t, locale } = useT();
  const s = p.snapshot;
  const tone = s ? statusTone(s.status) : 'neutral';
  const last = lastCheckpoint(p);
  const delivered = s?.status === 'delivered';
  const dAt = delivered ? deliveredAt(p) : undefined;
  let eta: string;
  try {
    eta = delivered
      ? t('ui.home.card.deliveredAt', { time: formatRelative(dAt ?? s!.updatedAt, locale, now) })
      : formatEta(s?.eta, locale, now);
  } catch { eta = ''; }
  const updated = last ? t('ui.home.card.updated', { time: formatRelative(last.time, locale, now) }) : '';
  const pickup = s?.status === 'available_for_pickup'
    ? (pickupPlace(s, locale) ? t('ui.home.card.pickup', { place: pickupPlace(s, locale)! }) : t('ui.home.card.pickupGeneric'))
    : undefined;
  const pct = Math.round((s?.progress ?? 0) * 100);
  return { t, locale, s, tone, delivered, eta, updated, pickup, pct, carrier: carrierName(p.carrierId, locale) };
}

function Notes({ p, pickup }: { p: Parcel; pickup?: string }) {
  const { t } = useT();
  const notes: Array<{ icon: 'pin' | 'clock' | 'alert'; text: string; tone: string }> = [];
  if (pickup) notes.push({ icon: 'pin', text: pickup, tone: 'progress' });
  if (isStale(p.snapshot)) notes.push({ icon: 'clock', text: t('ui.home.card.stale'), tone: 'neutral' });
  if (p.error) notes.push({ icon: 'alert', text: t('ui.home.card.error'), tone: 'warning' });
  if (!notes.length) return null;
  return (
    <ul className="pcard__notes">
      {notes.map((n) => (
        <li key={n.text} className="pcard__note" style={{ background: `var(--c-tone-${n.tone}-soft)`, color: `var(--c-tone-${n.tone}-ink)` }}>
          <Icon name={n.icon} size={16} />{n.text}
        </li>
      ))}
    </ul>
  );
}

function Unread({ n }: { n: number }) {
  const { t } = useT();
  if (n <= 0) return null;
  return <span className="pcard__unread" data-testid="unread-dot"><span className="pcard__unread-dot" aria-hidden="true" />{t('ui.home.card.unread', { n })}</span>;
}

export function ParcelCard({ parcel: p, now }: { parcel: Parcel; now: Date }) {
  const { t, s, tone, delivered, eta, updated, pickup, pct, carrier } = useCardBits(p, now);
  return (
    <a className={`pcard ${delivered ? 'pcard--done' : ''}`} href={href('/p/' + encodeURIComponent(p.id))}
      data-testid="parcel-card" data-parcel-id={p.id} data-status={s?.status ?? 'pending'}
      style={{ ['--tone' as string]: `var(--c-tone-${tone})`, ['--tone-ink' as string]: `var(--c-tone-${tone}-ink)` }}>
      <div className="pcard__top">
        <PalAvatar kind={p.character} mood={moodFor(s)} size={52} />
        <div className="pcard__id">
          <h3 className="pcard__name">{p.nickname}</h3>
          <p className="pcard__sub">
            <span>{carrier}</span>
            {p.demo && <span className="pcard__demo">{t('ui.home.card.demo')}</span>}
          </p>
        </div>
        {s && <StatusChip status={s.status} />}
      </div>
      {s ? (
        <>
          {!delivered && <ProgressBar value={s.progress} color={`var(--c-tone-${tone})`} label={t('ui.home.card.progress', { pct })} />}
          <div className="pcard__foot">
            <span className="pcard__eta" data-testid="card-eta">{eta}</span>
            <span className="pcard__meta">
              <Unread n={p.unread} />
              {!p.unread && updated && <span className="pcard__updated">{updated}</span>}
            </span>
          </div>
          <Notes p={p} pickup={pickup} />
        </>
      ) : (
        <div className="pcard__loading">
          <Skeleton h={10} r={6} />
          <span className="pcard__updated">{p.error ? t('ui.home.card.error') : t('ui.home.card.checking')}</span>
        </div>
      )}
    </a>
  );
}

export function HeroCard({ parcel: p, now }: { parcel: Parcel; now: Date }) {
  const { t, locale, s, tone, eta, pickup, pct, carrier } = useCardBits(p, now);
  let line = '';
  try { line = characterLine(p, locale); } catch { line = ''; }
  return (
    <a className="hero" href={href('/p/' + encodeURIComponent(p.id))}
      data-testid="parcel-card" data-parcel-id={p.id} data-status={s?.status ?? 'pending'}
      style={{ ['--pal' as string]: `var(--c-char-${p.character})`, ['--tone-ink' as string]: `var(--c-tone-${tone}-ink)` }}>
      <span className="hero__label"><Icon name="sparkle" size={16} />{t('ui.home.hero.label')}</span>
      <div className="hero__stage">
        <div className="hero__pal"><Character kind={p.character} mood={moodFor(s)} size={104} /></div>
        {line && <SpeechBubble tail="left" className="hero__bubble">{line}</SpeechBubble>}
      </div>
      <div className="hero__info">
        <div className="hero__row">
          <div className="hero__id">
            <h3 className="hero__name">{p.nickname}</h3>
            <p className="hero__sub">{carrier}</p>
          </div>
          {s && <StatusChip status={s.status} />}
        </div>
        <p className="hero__eta">{eta}</p>
        {s && <ProgressBar value={s.progress} color={`var(--c-tone-${tone})`} label={t('ui.home.card.progress', { pct })} />}
        <div className="hero__foot"><Unread n={p.unread} /></div>
        <Notes p={p} pickup={pickup} />
      </div>
    </a>
  );
}
