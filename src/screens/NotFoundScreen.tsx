/** 404 (UI team): a lost pal and a way home. */
import { Character } from '@/characters';
import { href } from '@/router';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/components/kit';
import { Icon } from '@/components/Icon';

export default function NotFoundScreen() {
  const { t } = useT();
  return (
    <main className="ui-screen ui-screen--center">
      <EmptyState
        art={<div className="nf-art"><Character kind="bunny" mood="worried" size={140} /><span className="nf-art__q font-display">?</span></div>}
        title={<span className="nf-title">{t('ui.notFound.title')}</span>} body={t('ui.notFound.body')}
      >
        <a className="ui-btn ui-btn--primary ui-btn--block" href={href('/')}><Icon name="home" size={20} />{t('ui.notFound.home')}</a>
      </EmptyState>
    </main>
  );
}
