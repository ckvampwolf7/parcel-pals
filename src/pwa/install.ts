/**
 * Install helper for the UI team: `useInstallPrompt()`.
 *  - Android/desktop Chromium: captures `beforeinstallprompt` (as early as possible — this module is imported by
 *    main.tsx through '@/pwa') so the UI can show its own pal-led "install" button and call `promptInstall()`.
 *  - iOS Safari has no prompt: `isIOS && !isStandalone` → show the manual hint "공유 → 홈 화면에 추가".
 */
import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface InstallPromptState {
  /** A native install prompt is available right now (Chromium, not installed yet). */
  canInstall: boolean;
  /** Show the native prompt. Resolves 'unavailable' when there is none (iOS, already installed, unsupported). */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Running as an installed app (display-mode standalone / iOS home-screen app). */
  isStandalone: boolean;
  /** iPhone/iPad (incl. iPadOS that reports as Mac): installation is manual via the Share sheet. */
  isIOS: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mm = typeof matchMedia === 'function'
    && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches);
  return iosStandalone || mm || installed;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own, pal-led install button
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
  if (typeof matchMedia === 'function') {
    matchMedia('(display-mode: standalone)').addEventListener?.('change', notify);
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferred;
  if (!ev) return 'unavailable';
  deferred = null; // a deferred prompt can only be used once
  notify();
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

let snapshot: Omit<InstallPromptState, 'promptInstall'> | null = null;
function getSnapshot() {
  const next = { canInstall: !!deferred && !detectStandalone(), isStandalone: detectStandalone(), isIOS: detectIOS() };
  if (!snapshot || snapshot.canInstall !== next.canInstall || snapshot.isStandalone !== next.isStandalone || snapshot.isIOS !== next.isIOS) {
    snapshot = next;
  }
  return snapshot;
}
const serverSnapshot = { canInstall: false, isStandalone: false, isIOS: false };
function subscribeInstall(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

/** React hook — see InstallPromptState. */
export function useInstallPrompt(): InstallPromptState {
  const s = useSyncExternalStore(subscribeInstall, getSnapshot, () => serverSnapshot);
  return { ...s, promptInstall };
}
