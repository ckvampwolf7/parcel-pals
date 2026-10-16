/**
 * Owned by the PWA/QA team. Called once from main.tsx.
 *  - initPwa(): register the service worker (production builds only), handle updates.
 *  - initNotifications(): subscribe to store events → browser Notification when allowed & settings.notifications.
 *  - requestNotificationPermission(): called from UI (settings toggle / first add) — returns the resulting permission.
 * LEAD STUB.
 */
export function initPwa(): void {}
export function initNotifications(): () => void { return () => {}; }
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}
