/**
 * Owned by the UI team. App chrome around every screen: bottom tab bar (home / inbox badge / settings),
 * toast host (bus + store events) and the onboarding gate.
 */
import type { ReactNode } from 'react';
import type { Route } from '@/router';
import { useSettings } from '@/store';
import OnboardingScreen from '@/screens/OnboardingScreen';
import { TabBar } from './TabBar';
import { ToastHost, useStoreEventToasts } from './ToastHost';
import './shell.css';

/** Routes that hide the tab bar (focused flows). */
const NO_TABS: Route['name'][] = ['add', 'parcel'];

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const settings = useSettings();
  useStoreEventToasts();
  // A shared message (#/add?n=…) goes straight to the form even before onboarding.
  const gate = !settings.onboarded && !(route.name === 'add' && route.prefill) && route.name !== 'link';
  const showTabs = !gate && !NO_TABS.includes(route.name);
  return (
    <div className={`app-frame ${showTabs ? 'has-tabbar' : ''}`}>
      {gate ? <OnboardingScreen /> : children}
      {showTabs && <TabBar route={route} />}
      <ToastHost />
    </div>
  );
}
