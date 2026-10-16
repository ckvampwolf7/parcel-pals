/**
 * Owned by the PWA/QA team. Called once from main.tsx.
 *  - initPwa(): register the service worker (production builds only), handle updates.
 *  - initNotifications(): subscribe to store events → browser Notification when allowed & settings.notifications.
 *  - requestNotificationPermission(): called from UI (settings toggle / first add) — returns the resulting permission.
 *  - useInstallPrompt(): install button state for the UI (Android prompt / iOS manual hint).
 */
export { initPwa } from './register';
export { initNotifications, requestNotificationPermission, isQuietHours, QUIET_HOURS } from './notifications';
export { useInstallPrompt, promptInstall } from './install';
export type { InstallPromptState } from './install';
