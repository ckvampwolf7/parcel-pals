/**
 * Owned by the UI team. App chrome around every screen: bottom tab bar (home / inbox badge / settings),
 * toasts host (listens to store `subscribe` events), and onboarding gate. LEAD STUB.
 */
import type { ReactNode } from 'react';
import type { Route } from '@/router';

export function AppShell({ children }: { route: Route; children: ReactNode }) {
  return <div className="app-frame">{children}</div>;
}
