/** Settings › "어디서든 보기": cloud sync between devices + push notifications while the app is closed. */
import { useId, useState } from 'react';
import { ConfirmSheet, Row, RowGroup, Spinner, Switch } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { QrCode } from '@/components/QrCode';
import { showToast } from '@/components/toast';
import { useT } from '@/i18n/useT';
import { disconnectSync, enableSync, getSyncMeta, linkSync, linkUrl, parseSyncKey, setPushEndpoint, syncNow, useSyncStatus } from '@/sync';
import { disablePush, enablePush, pushSupport, testPush } from '@/pwa/push';
import { formatRelative } from '@/engine';

export function SyncSection() {
  const { t, locale } = useT();
  const st = useSyncStatus();
  const ids = { code: useId(), push: useId(), pushHint: useId() };
  const [busy, setBusy] = useState<'' | 'enable' | 'link' | 'push' | 'test'>('');
  const [code, setCode] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const support = pushSupport();

  const turnOn = async () => {
    setBusy('enable');
    try { await enableSync(); setShowLink(true); } finally { setBusy(''); }
  };
  const join = async () => {
    const key = parseSyncKey(code);
    if (!key) { showToast({ text: t('ui.settings.sync.code.invalid'), tone: 'danger' }); return; }
    setBusy('link');
    try {
      await linkSync(key);
      const m = getSyncMeta();
      showToast({ text: m.error ? t('ui.settings.sync.failed') : t('ui.settings.sync.linked'), tone: m.error ? 'danger' : 'success' });
      setCode('');
    } finally { setBusy(''); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(linkUrl()); showToast({ text: t('ui.settings.sync.copied'), tone: 'success', durationMs: 2000 }); }
    catch { /* clipboard blocked: the link is selectable below */ }
  };
  const share = async () => {
    try { await navigator.share({ title: t('ui.settings.sync.shareTitle'), url: linkUrl() }); } catch { /* cancelled */ }
  };
  const togglePush = async (on: boolean) => {
    const key = getSyncMeta().key;
    if (!key) return;
    setBusy('push');
    try {
      if (!on) { await disablePush(key, st.pushEndpoint); setPushEndpoint(undefined); return; }
      const r = await enablePush(key);
      if (r.ok) {
        setPushEndpoint(r.endpoint);
        void syncNow();
        showToast({ text: t('ui.settings.push.on'), tone: 'success' });
      } else {
        showToast({ text: t(`ui.settings.push.fail.${r.reason}`), tone: 'danger', durationMs: 6000 });
      }
    } finally { setBusy(''); }
  };
  const sendTest = async () => {
    const m = getSyncMeta();
    if (!m.key || !m.pushEndpoint) return;
    setBusy('test');
    try {
      await syncNow();
      const r = await testPush(m.key, m.pushEndpoint);
      showToast({ text: r.sent ? t('ui.settings.push.testSent') : t('ui.settings.push.testNone'), tone: r.sent ? 'success' : 'danger' });
    } catch { showToast({ text: t('ui.settings.sync.failed'), tone: 'danger' }); }
    finally { setBusy(''); }
  };
  const turnOff = async () => {
    setConfirmOff(false);
    await disablePush(st.key, st.pushEndpoint);
    disconnectSync();
    showToast({ text: t('ui.settings.sync.off'), tone: 'success' });
  };

  const codeForm = (
    <form className="settings-key" onSubmit={(e) => { e.preventDefault(); void join(); }}>
      <input id={ids.code} data-testid="sync-code-input" type="text" autoComplete="off" spellCheck={false} autoCapitalize="off"
        placeholder={t('ui.settings.sync.code.placeholder')} value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" className="settings-key__save" data-testid="sync-code-submit" disabled={busy === 'link' || !code.trim()}>
        {busy === 'link' ? <Spinner size={14} /> : t('ui.settings.sync.code.join')}
      </button>
    </form>
  );

  if (!st.key) {
    return (
      <RowGroup title={t('ui.settings.group.sync')} footer={t('ui.settings.sync.footer')}>
        <Row icon="phone" iconColor="var(--c-primary)" label={t('ui.settings.sync.enable')} hint={t('ui.settings.sync.enable.hint')}
          onClick={busy ? undefined : turnOn} testId="sync-enable" trailing={busy === 'enable' ? <Spinner size={18} /> : undefined} chevron={busy !== 'enable'} />
        <Row icon="key" iconColor="var(--c-sun)" label={<label htmlFor={ids.code}>{t('ui.settings.sync.code')}</label>} hint={t('ui.settings.sync.code.hint')} below={codeForm} />
      </RowGroup>
    );
  }

  const when = st.lastSyncAt ? formatRelative(st.lastSyncAt, locale, new Date()) : t('ui.settings.sync.never');
  const statusText = st.syncing ? t('ui.settings.sync.syncing') : st.error ? t(`ui.settings.sync.error.${st.error}`) : t('ui.settings.sync.status.ok', { when });
  const pushHint = support === 'ios-install' ? t('ui.settings.push.iosInstall') : support === 'unsupported' ? t('ui.settings.push.unsupported') : t('ui.settings.push.hint');

  return (
    <RowGroup title={t('ui.settings.group.sync')} footer={t('ui.settings.sync.footer.on')}>
      <Row icon="refresh" iconColor="var(--c-tone-success)" label={t('ui.settings.sync.status')} hint={<span data-testid="sync-status" data-state={st.syncing ? 'syncing' : st.error ? 'error' : 'ok'}>{statusText}</span>}
        trailing={
          <button type="button" className="settings-livetest" data-testid="sync-now" onClick={() => void syncNow()} disabled={st.syncing}>
            {st.syncing ? <Spinner size={16} /> : <Icon name="refresh" size={16} />}{t('ui.settings.sync.now')}
          </button>
        } />
      <Row icon="share" iconColor="var(--c-primary)" label={t('ui.settings.sync.addDevice')} hint={t('ui.settings.sync.addDevice.hint')}
        onClick={() => setShowLink((v) => !v)} testId="sync-show-link" chevron={!showLink} />
      {showLink && (
        <div className="settings-sync-link" data-testid="sync-link">
          <QrCode text={linkUrl()} size={196} label={t('ui.settings.sync.qrLabel')} testId="sync-qr" />
          <p className="settings-sync-link__steps">{t('ui.settings.sync.qrSteps')}</p>
          <code className="settings-sync-link__url" data-testid="sync-link-url">{linkUrl()}</code>
          <div className="settings-sync-link__actions">
            <button type="button" className="settings-key__save" onClick={copy} data-testid="sync-copy"><Icon name="copy" size={16} /> {t('ui.settings.sync.copy')}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button type="button" className="settings-key__save" onClick={share}><Icon name="share" size={16} /> {t('ui.settings.sync.share')}</button>
            )}
          </div>
          <p className="settings-sync-link__warn">{t('ui.settings.sync.secret')}</p>
        </div>
      )}
      <Row icon={st.pushEndpoint ? 'bell' : 'bellOff'} iconColor="var(--c-sun)" label={t('ui.settings.push')} labelId={ids.push}
        hint={<span id={ids.pushHint}>{pushHint}</span>}
        trailing={busy === 'push' ? <Spinner size={18} /> : (
          <Switch checked={!!st.pushEndpoint} onChange={togglePush} labelledBy={ids.push} describedBy={ids.pushHint} testId="setting-push"
            disabled={support !== 'ok' && !st.pushEndpoint} />
        )} />
      {st.pushEndpoint && (
        <Row icon="bell" iconColor="var(--c-coral)" label={t('ui.settings.push.test')} hint={t('ui.settings.push.test.hint')}
          onClick={busy ? undefined : sendTest} testId="push-test" trailing={busy === 'test' ? <Spinner size={18} /> : undefined} chevron={busy !== 'test'} />
      )}
      <Row icon="close" label={t('ui.settings.sync.disable')} danger onClick={() => setConfirmOff(true)} testId="sync-disable" chevron />
      <ConfirmSheet open={confirmOff} onClose={() => setConfirmOff(false)} onConfirm={() => void turnOff()} danger kind="truck" mood="worried"
        title={t('ui.settings.sync.disable.title')} body={t('ui.settings.sync.disable.body')} confirmLabel={t('ui.settings.sync.disable.confirm')}
        cancelLabel={t('common.cancel')} confirmTestId="confirm-sync-disable" />
    </RowGroup>
  );
}
