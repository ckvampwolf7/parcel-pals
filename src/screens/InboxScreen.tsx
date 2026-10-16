/** Inbox (UI team): the pals' notes about every new checkpoint, grouped by day. */
import type { InboxItem, Parcel } from '@/types';
import { formatRelative, moodFor } from '@/engine';
import { actions, useInbox, useParcels, useSimNow } from '@/store';
import { href, navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { Button, StatusChip } from '@/components/ui';
import { EmptyState, PalAvatar } from '@/components/kit';
import { sameDay } from '@/components/parcelInfo';
import './inbox/inbox.css';

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

export default function InboxScreen() {
  const { t, lt, locale } = useT();
  const items = useInbox();
  const parcels = useParcels({ includeArchived: true });
  const now = useSimNow(15000);
  const byId = new Map<string, Parcel>(parcels.map((p) => [p.id, p]));
  const unread = items.filter((i) => !i.read).length;

  const sorted = [...items].sort((a, b) => b.time.localeCompare(a.time));
  const groups: Array<{ key: string; label: string; items: InboxItem[] }> = [];
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const dateFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' });
  for (const it of sorted) {
    const d = new Date(it.time);
    const key = dayKey(d);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label = sameDay(d, now) || d > now ? t('ui.inbox.today') : sameDay(d, yesterday) ? t('ui.inbox.yesterday') : dateFmt.format(d);
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  const open = (it: InboxItem) => {
    actions.markInboxRead([it.id]);
    if (byId.has(it.parcelId)) navigate('/p/' + encodeURIComponent(it.parcelId));
  };

  return (
    <main className="ui-screen inbox">
      <header className="inbox-head">
        <div>
          <h1 className="ui-screen__title">{t('ui.inbox.title')}</h1>
          {items.length > 0 && <p className="inbox-head__sub" aria-live="polite">{unread ? t('ui.inbox.summary', { n: unread }) : t('ui.inbox.allRead')}</p>}
        </div>
        {items.length > 0 && (
          <Button size="sm" variant="ghost" icon="checkAll" data-testid="mark-all-read" disabled={!unread} onClick={() => actions.markInboxRead()}>
            {t('ui.inbox.markAll')}
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState testId="inbox-empty" kind="bunny" mood="sleeping" title={t('ui.inbox.empty.title')} body={t('ui.inbox.empty.body')}>
          <a className="ui-btn ui-btn--secondary ui-btn--block" href={href('/')}>{t('ui.inbox.empty.cta')}</a>
        </EmptyState>
      ) : (
        <div className="inbox-groups">
          {groups.map((g) => (
            <section key={g.key} className="inbox-group" aria-label={g.label}>
              <h2 className="inbox-group__title">{g.label}</h2>
              <ul className="inbox-list">
                {g.items.map((it) => {
                  const p = byId.get(it.parcelId);
                  return (
                    <li key={it.id}>
                      <button type="button" className={`inbox-item ${it.read ? '' : 'is-unread'}`} data-testid="inbox-item" data-read={it.read}
                        onClick={() => open(it)}>
                        <PalAvatar kind={p?.character ?? 'truck'} mood={p ? moodFor(p.snapshot) : 'idle'} size={44} />
                        <span className="inbox-item__main">
                          <span className="inbox-item__top">
                            <span className="inbox-item__name">{p?.nickname ?? t('ui.inbox.removed')}</span>
                            <span className="inbox-item__time">{formatRelative(it.time, locale, now)}</span>
                          </span>
                          <span className="inbox-item__text">{lt(it.text)}</span>
                          <span className="inbox-item__chip"><StatusChip status={it.status} /></span>
                        </span>
                        {!it.read && <span className="inbox-item__dot"><span className="sr-only">{t('ui.inbox.unread')}</span></span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
