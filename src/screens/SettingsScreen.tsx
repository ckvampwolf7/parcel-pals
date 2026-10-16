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
  const ids = { locale: useId(), theme: useId(), motion: useId(), notif: useId(), notifHint: useId(), speed: useId(), pal: useId() };

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
