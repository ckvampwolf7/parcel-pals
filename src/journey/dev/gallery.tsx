/**
 * Dev-only fixture gallery for the parcel detail screen (open via the dev server:
 * /src/journey/dev/gallery.html?s=<scenario>&en&dark&hour=<0-23>&reduce). Not part of the app bundle.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jua/400.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { actions, simNow } from '@/store';
import { ParcelView } from '../ParcelView';
import { fixtureParcel, SCENARIOS, type Scenario } from '../fixtures';

const q = new URLSearchParams(location.search);
const s = (q.get('s') ?? 'domestic') as Scenario;
actions.updateSettings({ onboarded: true, locale: q.has('en') ? 'en' : 'ko', reduceMotion: q.has('reduce') ? 'on' : 'off' });
document.documentElement.dataset.theme = q.has('dark') ? 'dark' : 'light';
document.documentElement.dataset.reduceMotion = String(q.has('reduce'));
const hour = q.get('hour');
if (hour !== null) {
  const now = simNow();
  const delta = ((+hour - now.getHours() - now.getMinutes() / 60) + 24) % 24;
  void actions.fastForward(delta);
}
(window as unknown as { __scenarios: string[] }).__scenarios = SCENARIOS;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app-frame">
      <ParcelView key={s} parcel={(s as string) === 'loading' ? fixtureParcel('domestic', { snapshot: null }) : fixtureParcel(SCENARIOS.includes(s) ? s : 'domestic')} />
    </div>
  </StrictMode>,
);
