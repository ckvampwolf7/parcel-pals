/** Owned by lead: route switch + global effects (theme, reduced motion, locale). */
import { useEffect } from 'react';
import { useRoute } from '@/router';
import { useReducedMotion, useSettings } from '@/store';
import { setCurrentLocale } from '@/i18n';
import { AppShell } from '@/components/AppShell';
import HomeScreen from '@/screens/HomeScreen';
import AddParcelScreen from '@/screens/AddParcelScreen';
import ParcelScreen from '@/screens/ParcelScreen';
import InboxScreen from '@/screens/InboxScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import NotFoundScreen from '@/screens/NotFoundScreen';

function useGlobalEffects() {
  const settings = useSettings();
  const reduced = useReducedMotion();
  useEffect(() => { setCurrentLocale(settings.locale); }, [settings.locale]);
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduced); }, [reduced]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1930' : '#fff8f0');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);
}

export default function App() {
  useGlobalEffects();
  const route = useRoute();
  useEffect(() => { window.scrollTo(0, 0); }, [route.name, 'id' in route ? route.id : '']);
  let screen;
  switch (route.name) {
    case 'home': screen = <HomeScreen />; break;
    case 'add': screen = <AddParcelScreen prefill={route.prefill} />; break;
    case 'parcel': screen = <ParcelScreen key={route.id} id={route.id} />; break;
    case 'inbox': screen = <InboxScreen />; break;
    case 'settings': screen = <SettingsScreen />; break;
    default: screen = <NotFoundScreen />;
  }
  return <AppShell route={route}>{screen}</AppShell>;
}
