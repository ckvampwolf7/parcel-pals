/**
 * Checkpoint timeline: newest first, grouped by day. Primary text is the plain-language line,
 * the raw carrier text sits behind a "원문 보기" toggle (for trust); location + time always shown.
 */
import { useId, useState } from 'react';
import type { Checkpoint, Parcel, StatusTag } from '@/types';
import { statusLabel, statusTone } from '@/engine';
import { Icon, type IconName } from '@/components/Icon';
import { useT } from '@/i18n/useT';
import { explainCheckpoint } from './engineCompat';
import { dayDiff, fmtDate, fmtTime, groupByDay } from './format';

const LIMIT = 5;

const STATUS_ICON: Partial<Record<StatusTag, IconName>> = {
  delivered: 'check',
  exception: 'alert',
  attempt_fail: 'alert',
  expired: 'moon',
  out_for_delivery: 'sparkle',
  available_for_pickup: 'box',
  customs: 'globe',
  info_received: 'clipboard',
};

export function Timeline({ parcel, checkpoints, newIds, now }: { parcel: Parcel; checkpoints: Checkpoint[]; newIds: Set<string>; now: Date }) {
  const { t, lt, locale } = useT();
  const [all, setAll] = useState(false);
  const [raw, setRaw] = useState(false);
  const listId = useId();
  const total = checkpoints.length;
  const groups = groupByDay(checkpoints);
  const newestId = groups[0]?.items[0]?.id;

  let budget = all ? Infinity : LIMIT;
  const shown = groups
    .map((g) => {
      const items = g.items.slice(0, Math.max(0, budget));
      budget -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length);

  const dayTitle = (key: string, sample: string) => {
    const diff = dayDiff(sample, now);
    const date = fmtDate(sample, locale);
    if (diff === 0) return `${t('journey.tl.today')} · ${date}`;
    if (diff === 1) return `${t('journey.tl.yesterday')} · ${date}`;
    return date || key;
  };

  return (
    <section className="jr-card jr-tl" aria-labelledby={`${listId}-t`}>
      <div className="jr-card__head">
        <h2 id={`${listId}-t`} className="jr-card__title">{t('journey.tl.title')}</h2>
        {total > 0 && (
          <button type="button" className="jr-toggle" aria-pressed={raw} onClick={() => setRaw((v) => !v)}>
            <span className="jr-toggle__box" aria-hidden="true">{raw && <Icon name="check" size={14} />}</span>
            {t('journey.tl.raw')}
          </button>
        )}
      </div>
      {total === 0 ? (
        <p className="jr-card__body" data-testid="timeline">{t('journey.tl.empty')}</p>
      ) : (
        <div data-testid="timeline" id={listId}>
          {shown.map((g) => (
            <div key={g.key} className="jr-tl__day">
              <h3 className="jr-tl__date">{dayTitle(g.key, g.items[0].time)}</h3>
              <ol className="jr-tl__list">
                {g.items.map((c) => {
                  const tone = statusTone(c.status);
                  const isNew = newIds.has(c.id);
                  const icon = STATUS_ICON[c.status];
                  return (
                    <li
                      key={c.id}
                      className={`jr-tl__item ${isNew ? 'is-new' : ''} ${c.id === newestId ? 'is-latest' : ''}`}
                      data-testid="timeline-item"
                      data-status={c.status}
                      data-checkpoint-id={c.id}
                      style={{ ['--jr-tone' as string]: `var(--c-tone-${tone})`, ['--jr-tone-soft' as string]: `var(--c-tone-${tone}-soft)`, ['--jr-tone-ink' as string]: `var(--c-tone-${tone}-ink)` }}
                    >
                      <span className="jr-tl__dot" aria-hidden="true">{icon && <Icon name={icon} size={12} strokeWidth={3} />}</span>
                      <div className="jr-tl__body">
                        <p className="jr-tl__line">
                          <span className="sr-only">{statusLabel(c.status, locale)}: </span>
                          {explainCheckpoint(parcel, c, locale)}
                          {isNew && <span className="jr-tl__new">{t('journey.tl.new')}</span>}
                        </p>
                        {raw && (
                          <p className="jr-tl__raw"><span className="sr-only">{t('journey.tl.rawLabel')}: </span>“{lt(c.message)}”</p>
                        )}
                        <p className="jr-tl__meta">
                          <time dateTime={c.time}>{fmtTime(c.time, locale)}</time>
                          {lt(c.location) && <><span aria-hidden="true"> · </span>{lt(c.location)}</>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
      {total > LIMIT && (
        <button type="button" className="jr-more" aria-expanded={all} aria-controls={listId} onClick={() => setAll((v) => !v)}>
          {all ? t('journey.tl.showLess') : t('journey.tl.showAll', { n: total })}
          <Icon name="chevronDown" size={18} className={all ? 'jr-flip' : undefined} />
        </button>
      )}
    </section>
  );
}
