/**
 * PWA/QA strings. The PWA team has no i18n namespace file yet, so the few user-visible strings live here
 * (ko + en) and follow the current app locale. Lead: move these into a `pwa` namespace if you add one.
 */
import { getCurrentLocale } from '@/i18n';
import type { Locale } from '@/types';

const STRINGS = {
  ko: {
    updateReady: '새 버전이 있어요 — 다시 열면 적용돼요 ✨',
    offlineReady: '이제 오프라인에서도 열 수 있어요',
    notificationFallbackTitle: '택배친구',
  },
  en: {
    updateReady: 'A new version is ready — it applies next time you open the app ✨',
    offlineReady: 'Parcel Pals now works offline',
    notificationFallbackTitle: 'Parcel Pals',
  },
} satisfies Record<Locale, Record<string, string>>;

export type PwaStringKey = keyof (typeof STRINGS)['ko'];

export function pwaText(key: PwaStringKey, locale: Locale = getCurrentLocale()): string {
  return STRINGS[locale]?.[key] ?? STRINGS.ko[key];
}
