/** #/link/<key>: join another device's cloud sync (opened from the QR code / link in Settings › Use anywhere). */
import { useState } from 'react';
import { Character } from '@/characters';
import { EmptyState, Spinner } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast';
import { useT } from '@/i18n/useT';
import { navigate } from '@/router';
import { actions } from '@/store';
import { getSyncMeta, isValidSyncKey, linkSync, useSyncStatus } from '@/sync';

export default function LinkScreen({ syncKey }: { syncKey: string }) {
  const { t } = useT();
  const st = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const valid = isValidSyncKey(syncKey);
  const already = valid && st.key === syncKey;

  const connect = async () => {
    setBusy(true);
    try {
      await linkSync(syncKey);
      actions.updateSettings({ onboarded: true });
      const err = getSyncMeta().error;
      showToast({ text: err ? t('ui.settings.sync.failed') : t('ui.link.done'), tone: err ? 'danger' : 'success', character: 'truck', mood: err ? 'worried' : 'happy' });
      navigate(err ? '/settings' : '/', { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <main className="ui-screen ui-screen--center" data-testid="link-screen">
      <EmptyState
        art={<Character kind="plane" mood={valid ? 'happy' : 'worried'} size={130} />}
        title={valid ? (already ? t('ui.link.already') : t('ui.link.title')) : t('ui.link.invalid')}
        body={valid && !already ? t('ui.link.body') : undefined}
      >
        {valid && !already && (
          <button type="button" className="ui-btn ui-btn--primary ui-btn--block" data-testid="link-confirm" onClick={connect} disabled={busy}>
            {busy ? <Spinner size={18} /> : <Icon name="check" size={20} />}{t('ui.link.confirm')}
          </button>
        )}
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" data-testid="link-cancel" onClick={() => navigate('/', { replace: true })}>
          {already ? t('common.close') : t('ui.link.cancel')}
        </button>
      </EmptyState>
    </main>
  );
}
