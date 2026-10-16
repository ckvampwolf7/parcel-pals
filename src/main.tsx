/** Owned by lead. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jua/400.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { actions, simNow, startStore } from './store';
import { initNotifications, initPwa } from './pwa';

startStore();

// Test/debug handle (dev server, or any build opened with ?debug). Used by e2e tests and screenshot scripts.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __pp: unknown }).__pp = { actions, simNow };
}
initNotifications();
initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
