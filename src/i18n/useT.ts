import { useCallback } from 'react';
import { t as translate, lt as pick } from './index';
import { useSettings } from '@/store';
import type { Locale, LocalizedText } from '@/types';

/** React hook: re-renders on locale change. `const { t, lt, locale } = useT();` */
export function useT() {
  const { locale } = useSettings();
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(key, params, locale), [locale]);
  const lt = useCallback((text: LocalizedText | undefined) => pick(text, locale), [locale]);
  return { t, lt, locale: locale as Locale };
}
