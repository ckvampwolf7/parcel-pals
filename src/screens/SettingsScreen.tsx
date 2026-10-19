/** Settings (UI team): grouped list — general, pals, notifications, demo, about. */
import { useId, useState } from 'react';
import type { Settings } from '@/types';
import { actions, useSettings } from '@/store';
import { Character, CharacterPicker } from '@/characters';
import { requestNotificationPermission } from '@/pwa';
import { navigate } from '@/router';
import { useT } from '@/i18n/useT';
import { ConfirmSheet, Row, RowGroup, Segmented, Spinner, Switch } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { version } from '../../package.json';
import { SyncSection } from './settings/SyncSection';
import { disconnectSync, getSyncMeta } from '@/sync';
import { disablePush } from '@/pwa/push';
import './settings/settings.css';

type Perm = NotificationPermission | 'unsupported';
const readPerm = (): Perm => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const SPEEDS = [1, 60, 360, 1440];

export default function SettingsScreen() {
  const { t } = useT();
  const s = useSettings();
  const set = (patch: Partial<Settings>) => actions.updateSettings(patch);
  const [perm, setPerm] = useState<Perm>(readPerm);
  const [confirmReset, setConfirmReset] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const ids = { locale: useId(), region: useId(), theme: useId(), motion: useId(), notif: useId(), notifHint: useId(), speed: useId(), pal: useId(), every: useId(), key: useId() };
  const [liveTest, setLiveTest] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [addingTest, setAddingTest] = useState(false);
  const [keyDraft, setKeyDraft] = useState(s.trackerApiKey ?? '');
  const testConnection = async () => {
    setLiveTest('busy');
    const r = await actions.testLiveConnection();
    setLiveTest(r === 'ok' ? 'ok' : 'fail');
  };
  const addTestParcel = async () => {
    setAddingTest(true);
    try { const p = await actions.addTestParcel(); navigate(`/p/${p.id}`); }
    finally { setAddingTest(false); }
  };
  const saveKey = () => {
    const v = keyDraft.trim();
    set({ trackerApiKey: v });
    showToast({ text: v ? t('ui.settings.live.key.saved') : t('ui.settings.live.key.cleared'), tone: 'success', durationMs: 2500 });
  };

  const toggleNotifications = async (on: boolean) => {
    set({ notifications: on });
    if (on && readPerm() === 'default') {
      try { setPerm(await requestNotificationPermission()); } catch { setPerm(readPerm()); }
    }
  };
  const loadDemo = async () => {
    setLoadingDemo(true);
    try { await actions.loadDemo(); showToast({ text: t('ui.toast.demoLoaded'), character: 'bunny', mood: 'happy', to: '/', tone: 'success' }); }
    finally { setLoadingDemo(false); }
  };
  const reset = () => {
    setConfirmReset(false);
    // Reset is local: leave the cloud copy (other devices) alone by disconnecting first.
    const m = getSyncMeta();
    if (m.key) { void disablePush(m.key, m.pushEndpoint); disconnectSync(); }
    actions.resetAll();
    navigate('/', { replace: true });
  };

  const speedOptions = SPEEDS.includes(s.demoSpeed) ? SPEEDS : [...SPEEDS, s.demoSpeed].sort((a, b) => a - b);
  const notifNote = perm === 'denied' ? t('ui.settings.notifications.blocked') : perm === 'unsupported' ? t('ui.settings.notifications.unsupported') : null;

  return (
    <main className="ui-screen settings">
      <header className="settings-head">
        <h1 className="ui-screen__title">{t('ui.settings.title')}</h1>
        <div className="settings-head__pals" aria-hidden="true">
          <Character kind="truck" mood="idle" size={44} animated={false} />
          <Character kind="plane" mood="idle" size={44} animated={false} />
          <Character kind="bunny" mood="idle" size={44} animated={false} />
        </div>
      </header>

      <RowGroup title={t('ui.settings.group.general')}>
        <Row icon="globe" iconColor="var(--c-char-plane)" label={t('ui.settings.locale')} labelId={ids.locale}
          below={<Segmented labelledBy={ids.locale} testId="setting-locale" value={s.locale} onChange={(v) => set({ locale: v })}
            options={[{ value: 'ko', label: '한국어', testId: 'setting-locale-ko' }, { value: 'en', label: 'English', testId: 'setting-locale-en' }]} />} />
        <Row icon="pin" iconColor="var(--c-char-truck)" label={t('ui.settings.region')} labelId={ids.region} hint={t('ui.settings.region.hint')}
          below={<Segmented labelledBy={ids.region} testId="setting-region" value={s.region} onChange={(v) => set({ region: v })}
            options={[{ value: 'KR', label: t('ui.settings.region.KR'), testId: 'setting-region-KR' }, { value: 'US', label: t('ui.settings.region.US'), testId: 'setting-region-US' }]} />} />
        <Row icon="palette" iconColor="var(--c-lilac)" label={t('ui.settings.theme')} labelId={ids.theme}
          below={<Segmented labelledBy={ids.theme} value={s.theme} onChange={(v) => set({ theme: v })} options={[
            { value: 'system', label: t('ui.settings.theme.system'), icon: 'phone', testId: 'setting-theme-system' },
            { value: 'light', label: t('ui.settings.theme.light'), icon: 'sun', testId: 'setting-theme-light' },
            { value: 'dark', label: t('ui.settings.theme.dark'), icon: 'moon', testId: 'setting-theme-dark' },
          ]} />} />
        <Row icon="motion" iconColor="var(--c-mint)" label={t('ui.settings.motion')} hint={t('ui.settings.motion.hint')} labelId={ids.motion}
          below={<Segmented labelledBy={ids.motion} value={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} options={[
            { value: 'system', label: t('ui.settings.motion.system'), testId: 'setting-reduce-motion-system' },
            { value: 'on', label: t('ui.settings.motion.on'), testId: 'setting-reduce-motion-on' },
            { value: 'off', label: t('ui.settings.motion.off'), testId: 'setting-reduce-motion-off' },
          ]} />} />
      </RowGroup>

      <RowGroup title={t('ui.settings.group.pal')}>
        <Row icon="smile" iconColor="var(--c-char-bunny)" label={t('ui.settings.defaultPal')} hint={t('ui.settings.defaultPal.hint')} labelId={ids.pal}
          below={<div className="settings-picker" data-testid="setting-default-character">
            <CharacterPicker value={s.defaultCharacter} onChange={(v) => set({ defaultCharacter: v })} includeAuto label={t('ui.settings.defaultPal')} />
          </div>} />
      </RowGroup>

      <SyncSection />

      <RowGroup title={t('ui.settings.group.live')} footer={t('ui.settings.live.footer')}>
        <Row icon="globe" iconColor="var(--c-tone-success)" label={t('ui.settings.live.status')} hint={t('ui.settings.live.status.hint')}
          trailing={
            <button type="button" className="settings-livetest" data-testid="setting-live-test" data-state={liveTest} onClick={testConnection} disabled={liveTest === 'busy'}>
              {liveTest === 'busy' ? <Spinner size={16} /> : liveTest === 'ok' ? <Icon name="check" size={16} /> : liveTest === 'fail' ? <Icon name="alert" size={16} /> : null}
              {t(`ui.settings.live.test.${liveTest}`)}
            </button>
          } />
        <Row icon="box" iconColor="var(--c-char-bunny)" label={t('ui.settings.live.testParcel')} hint={t('ui.settings.live.testParcel.hint')}
          onClick={addingTest ? undefined : addTestParcel} testId="add-test-parcel" trailing={addingTest ? <Spinner size={18} /> : undefined} chevron={!addingTest} />
        <Row icon="refresh" iconColor="var(--c-primary)" label={t('ui.settings.live.every')} hint={t('ui.settings.live.every.hint')} labelId={ids.every}
          below={<Segmented labelledBy={ids.every} value={String(s.liveRefreshMin ?? 10)} onChange={(v) => set({ liveRefreshMin: Number(v) })} options={[
            { value: '5', label: t('ui.settings.live.every.n', { n: 5 }), testId: 'setting-live-every-5' },
            { value: '10', label: t('ui.settings.live.every.n', { n: 10 }), testId: 'setting-live-every-10' },
            { value: '30', label: t('ui.settings.live.every.n', { n: 30 }), testId: 'setting-live-every-30' },
          ]} />} />
        <Row icon="key" iconColor="var(--c-sun)" label={<label htmlFor={ids.key}>{t('ui.settings.live.key')}</label>} hint={t('ui.settings.live.key.hint')}
          below={
            <form className="settings-key" onSubmit={(e) => { e.preventDefault(); saveKey(); }}>
              <input id={ids.key} data-testid="setting-api-key" type="password" autoComplete="off" spellCheck={false}
                placeholder="CLIENT_ID:CLIENT_SECRET" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
              <button type="submit" className="settings-key__save" data-testid="setting-api-key-save">{t('common.save')}</button>
            </form>
          } />
      </RowGroup>

      <RowGroup title={t('ui.settings.group.notify')} footer={notifNote ?? undefined}>
        <Row icon={s.notifications ? 'bell' : 'bellOff'} iconColor="var(--c-sun)" label={t('ui.settings.notifications')} labelId={ids.notif}
          hint={<span id={ids.notifHint}>{t('ui.settings.notifications.hint')}</span>}
          trailing={<Switch checked={s.notifications} onChange={toggleNotifications} labelledBy={ids.notif} describedBy={ids.notifHint} testId="setting-notifications" />} />
      </RowGroup>

      <RowGroup title={t('ui.settings.group.demo')}>
        <Row icon="speed" iconColor="var(--c-coral)" label={<label htmlFor={ids.speed}>{t('ui.settings.speed')}</label>} hint={t('ui.settings.speed.hint')}
          below={
            <span className="settings-select">
              <select id={ids.speed} data-testid="setting-demo-speed" value={s.demoSpeed} onChange={(e) => set({ demoSpeed: Number(e.target.value) })}>
                {speedOptions.map((v) => <option key={v} value={v}>{SPEEDS.includes(v) ? t(`ui.settings.speed.${v}`) : `${v}×`}</option>)}
              </select>
              <Icon name="chevronDown" size={18} />
            </span>
          } />
        <Row icon="sparkle" iconColor="var(--c-primary)" label={t('ui.settings.loadDemo')} hint={t('ui.settings.loadDemo.hint')}
          onClick={loadingDemo ? undefined : loadDemo} testId="load-demo" trailing={loadingDemo ? <Spinner size={18} /> : undefined} chevron={!loadingDemo} />
        <Row icon="trash" label={t('ui.settings.reset')} danger onClick={() => setConfirmReset(true)} testId="reset-data" chevron />
      </RowGroup>

      <RowGroup title={t('ui.settings.group.about')} footer={t('ui.settings.privacy')}>
        <Row icon="info" iconColor="var(--c-ink-2)" label={t('ui.settings.version')} trailing={<span className="settings-version">{version}</span>} />
        <Row icon="heart" iconColor="var(--c-coral)" label={t('ui.settings.credits')} hint={t('ui.settings.credits.body')} />
      </RowGroup>

      <ConfirmSheet open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={reset} danger kind="bunny" mood="worried"
        title={t('ui.settings.reset.title')} body={t('ui.settings.reset.body')} confirmLabel={t('ui.settings.reset.confirm')}
        cancelLabel={t('common.cancel')} confirmTestId="confirm-reset" />
    </main>
  );
}
