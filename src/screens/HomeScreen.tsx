/** Home (UI team): greeting + summary, hero card, active/delivered lists, refresh-all, add button, empty state. */
import { useId, useState } from 'react';
import type { Parcel } from '@/types';
import { actions, nowFor, subscribe, useClocks, useParcels, type Clocks } from '@/store';
import { Character } from '@/characters';
import { useInstallPrompt } from '@/pwa';
import { href } from '@/router';
import { useT } from '@/i18n/useT';
import { Button, IconButton } from '@/components/ui';
import { EmptyState, SectionHeader, SpeechBubble, Spinner } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { arrivesToday, deliveredAt, isDelivered, soonest } from '@/components/parcelInfo';
import { HeroCard, ParcelCard } from './home/ParcelCard';
import './home/home.css';

function greetingKey(h: number) {
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function useSummary(parcels: Parcel[], clocks: Clocks) {
  const { t } = useT();
  const active = parcels.filter((p) => !isDelivered(p));
  const today = active.filter((p) => arrivesToday(p, nowFor(p, clocks))).length;
  const pickup = active.filter((p) => p.snapshot?.status === 'available_for_pickup').length;
  const problem = active.filter((p) => ['exception', 'attempt_fail'].includes(p.snapshot?.status ?? '') || p.snapshot?.delayed).length;
  const moving = Math.max(0, active.length - today - pickup - problem);
  const delivered = parcels.length - active.length;
  const parts: string[] = [];
  if (today) parts.push(t('ui.home.summary.today', { n: today }));
  if (moving) parts.push(t('ui.home.summary.moving', { n: moving }));
  if (pickup) parts.push(t('ui.home.summary.pickup', { n: pickup }));
  if (problem) parts.push(t('ui.home.summary.problem', { n: problem }));
  if (!parts.length) parts.push(delivered ? t('ui.home.summary.delivered', { n: delivered }) : t('ui.home.summary.none'));
  return parts.join(' · ');
}

const INSTALL_KEY = 'pp.ui.installDismissed';
function InstallCard() {
  const { t } = useT();
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch { return false; } });
  if (dismissed || isStandalone || !(canInstall || isIOS)) return null;
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(INSTALL_KEY, '1'); } catch { /* private mode */ } };
  return (
    <aside className="install" aria-labelledby="install-title">
      <Character kind="bunny" mood="happy" size={64} />
      <div className="install__text">
        <h2 id="install-title" className="install__title">{t('ui.home.install.title')}</h2>
        <p className="install__body">{isIOS && !canInstall ? t('ui.home.install.ios') : t('ui.home.install.body')}</p>
        <div className="install__actions">
          {canInstall && <Button size="sm" icon="download" onClick={async () => { if ((await promptInstall()) === 'accepted') dismiss(); }}>{t('ui.home.install.cta')}</Button>}
          <Button size="sm" variant="ghost" onClick={dismiss}>{t('ui.home.install.dismiss')}</Button>
        </div>
      </div>
    </aside>
  );
}

function PalTrio() {
  return (
    <div className="trio">
      <Character kind="plane" mood="happy" size={84} className="trio__plane" />
      <Character kind="truck" mood="idle" size={112} className="trio__truck" />
      <Character kind="bunny" mood="waiting" size={80} className="trio__bunny" />
    </div>
  );
}

export default function HomeScreen() {
  const { t } = useT();
  const parcels = useParcels();
  const clocks = useClocks(5000);
  const summary = useSummary(parcels, clocks);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const doneId = useId();

  const greet = t(`ui.home.greeting.${greetingKey(new Date().getHours())}`);
  const hero = soonest(parcels);
  const active = parcels.filter((p) => !isDelivered(p) && p !== hero);
  const delivered = parcels.filter(isDelivered)
    .sort((a, b) => (deliveredAt(b) ?? '').localeCompare(deliveredAt(a) ?? ''));

  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    let gotNews = false;
    const unsub = subscribe((e) => { if (e.type === 'parcel-updated' || e.type === 'parcel-delivered') gotNews = true; });
    try {
      await actions.refreshAll();
      if (!gotNews) showToast({ text: t('ui.toast.refreshed'), tone: 'success', durationMs: 2200 });
    } catch {
      showToast({ text: t('ui.toast.refreshFailed'), tone: 'warning' });
    } finally { unsub(); setRefreshing(false); }
  };
  const loadDemo = async () => {
    setLoadingDemo(true);
    try { await actions.loadDemo(); } finally { setLoadingDemo(false); }
  };

  return (
    <main className="ui-screen home">
      <header className="home-head">
        <div className="home-head__brand">
          <span className="home-head__logo" aria-hidden="true"><Icon name="box" size={18} /></span>
          <span className="font-display">{t('common.appName')}</span>
          {parcels.length > 0 && (
            <IconButton
              icon="refresh" label={refreshing ? t('ui.home.refreshing') : t('ui.home.refresh')} data-testid="refresh-all"
              className={`home-head__refresh ${refreshing ? 'is-spinning' : ''}`} onClick={refreshAll} aria-busy={refreshing} disabled={refreshing}
            />
          )}
        </div>
        <h1 className="home-head__greet">{greet}</h1>
        <p className="home-head__summary" aria-live="polite">{summary}</p>
      </header>

      {parcels.length === 0 ? (
        <EmptyState testId="empty-state" art={<PalTrio />} title={t('ui.home.empty.title')} body={t('ui.home.empty.body')}>
          <a className="ui-btn ui-btn--primary ui-btn--block" href={href('/add')} data-testid="add-button">
            <Icon name="plus" size={20} />{t('ui.home.empty.add')}
          </a>
          <Button variant="secondary" block icon="sparkle" data-testid="load-demo-button" onClick={loadDemo} disabled={loadingDemo} aria-busy={loadingDemo}>
            {loadingDemo ? <Spinner size={18} /> : null}{t('ui.home.empty.demo')}
          </Button>
        </EmptyState>
      ) : (
        <div className="home-body" data-testid="home-list">
          <InstallCard />
          {hero ? (
            <section className="home-sec" aria-label={t('ui.home.section.active')}>
              <SectionHeader title={t('ui.home.section.active')} count={active.length + 1} />
              <HeroCard parcel={hero} now={nowFor(hero, clocks)} />
              {active.length > 0 && <ul className="home-list">{active.map((p) => <li key={p.id}><ParcelCard parcel={p} now={nowFor(p, clocks)} /></li>)}</ul>}
            </section>
          ) : (
            <>
              <div className="home-alldone">
                <Character kind="bunny" mood="celebrating" size={72} />
                <SpeechBubble tail="left"><strong className="home-alldone__t">{t('ui.home.allDone.title')}</strong><br />{t('ui.home.allDone.body')}</SpeechBubble>
              </div>
              {active.length > 0 && (
                <section className="home-sec" aria-label={t('ui.home.section.active')}>
                  <SectionHeader title={t('ui.home.section.active')} count={active.length} />
                  <ul className="home-list">{active.map((p) => <li key={p.id}><ParcelCard parcel={p} now={nowFor(p, clocks)} /></li>)}</ul>
                </section>
              )}
            </>
          )}
          {delivered.length > 0 && (
            <section className="home-sec" aria-label={t('ui.home.section.delivered')}>
              <SectionHeader title={t('ui.home.section.delivered')} count={delivered.length} open={showDone} onToggle={() => setShowDone((v) => !v)} controls={doneId} />
              <ul className="home-list" id={doneId} hidden={!showDone}>{showDone && delivered.map((p) => <li key={p.id}><ParcelCard parcel={p} now={nowFor(p, clocks)} /></li>)}</ul>
            </section>
          )}
          <a className="home-fab" href={href('/add')} data-testid="add-button">
            <Icon name="plus" size={22} strokeWidth={2.6} /><span>{t('ui.home.add')}</span>
          </a>
        </div>
      )}
    </main>
  );
}
