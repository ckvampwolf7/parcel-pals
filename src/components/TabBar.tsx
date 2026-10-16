/** Bottom tab bar (UI team): Home / Inbox (unread badge) / Settings, with pal-flavored icons. */
import type { ReactNode } from 'react';
import type { Route } from '@/router';
import { href } from '@/router';
import { useInbox } from '@/store';
import { useT } from '@/i18n/useT';
import { Badge } from './kit';

type TabName = 'home' | 'inbox' | 'settings';

const svg = (children: ReactNode) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** House with a little parcel for a door. */
const HomeIcon = () => svg(<>
  <path className="tab-fill" d="M3.8 11.2 12 4.5l8.2 6.7V19.5a1.2 1.2 0 0 1-1.2 1.2H5a1.2 1.2 0 0 1-1.2-1.2z" />
  <rect className="tab-accent" x="9" y="13.2" width="6" height="7.4" rx="1.2" />
  <path d="M9 15.8h6M12 13.2v2.6" />
</>);
/** Bell wearing Toto's bunny ears. */
const InboxIcon = () => svg(<>
  <path className="tab-accent" d="M9.6 7.4C8.4 5.4 8.2 2.9 9.3 2.6s2.1 1.9 2.2 4.4M14.4 7.4c1.2-2 1.4-4.5.3-4.8s-2.1 1.9-2.2 4.4" />
  <path className="tab-fill" d="M5.8 17.2v-5.4a6.2 6.2 0 0 1 12.4 0v5.4l1.6 2H4.2z" />
  <path d="M10 21.1a2.2 2.2 0 0 0 4 0" />
</>);
/** A smiling gear. */
const SettingsIcon = () => svg(<>
  <path className="tab-fill" d="M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.4a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3h4l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z" />
  <path d="M10.4 10.6v.4M15.2 10.6v.4M10.2 13.6a3 3 0 0 0 5.2 0" />
</>);

const TABS: Array<{ name: TabName; path: string; icon: () => ReactNode; pal: string }> = [
  { name: 'home', path: '/', icon: HomeIcon, pal: 'var(--c-char-truck)' },
  { name: 'inbox', path: '/inbox', icon: InboxIcon, pal: 'var(--c-char-bunny)' },
  { name: 'settings', path: '/settings', icon: SettingsIcon, pal: 'var(--c-char-plane)' },
];

export function TabBar({ route }: { route: Route }) {
  const { t } = useT();
  const unread = useInbox().filter((i) => !i.read).length;
  return (
    <nav className="ui-tabbar" aria-label={t('ui.tab.nav')}>
      <ul className="ui-tabbar__list">
        {TABS.map((tab) => {
          const active = route.name === tab.name;
          return (
            <li key={tab.name} className="ui-tabbar__item">
              <a
                href={href(tab.path)} data-testid={`tab-${tab.name}`} aria-current={active ? 'page' : undefined}
                className={`ui-tab ${active ? 'is-active' : ''}`} style={{ ['--tab-c' as string]: tab.pal }}
              >
                <span className="ui-tab__icon">
                  {tab.icon()}
                  {tab.name === 'inbox' && (
                    <Badge count={unread} testId="inbox-badge" className="ui-tab__badge" decorative />
                  )}
                </span>
                <span className="ui-tab__label">{t(`ui.tab.${tab.name}`)}</span>
                {tab.name === 'inbox' && unread > 0 && <span className="sr-only">{t('ui.tab.unread', { n: unread })}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
