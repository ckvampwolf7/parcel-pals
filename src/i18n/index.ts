/**
 * Tiny i18n. Dictionaries are split by namespace so each team owns its own file:
 *   common (lead) · ui (screens/components) · journey (detail screen) · engine (status + character speech) · characters
 * Keys are looked up as "<ns>.<key>", e.g. t('ui.home.title').
 * Interpolation: "{name}" placeholders. Plurals: write separate keys (…_one / …_other) and pick in code.
 * NOTE: this module must stay free of React/store imports (the engine imports it). Use `useT` from './useT' in components.
 */
import type { Locale } from '@/types';
import common from './ns/common';
import ui from './ns/ui';
import journey from './ns/journey';
import engine from './ns/engine';
import characters from './ns/characters';

export type Dict = Record<string, string>;
export interface Namespace { ko: Dict; en: Dict }

const NAMESPACES: Record<string, Namespace> = { common, ui, journey, engine, characters };

let currentLocale: Locale = 'ko';
/** Called by the store when settings.locale changes (also sets <html lang>). */
export function setCurrentLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
export function getCurrentLocale(): Locale { return currentLocale; }

const warned = new Set<string>();
export function t(key: string, params?: Record<string, string | number>, locale: Locale = currentLocale): string {
  const dot = key.indexOf('.');
  const ns = NAMESPACES[key.slice(0, dot)];
  const sub = key.slice(dot + 1);
  let s = ns?.[locale]?.[sub] ?? ns?.ko?.[sub];
  if (s === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) { warned.add(key); console.warn(`[i18n] missing key: ${key}`); }
    return key;
  }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
  return s;
}

/** Does a key exist (in the given locale or ko fallback)? */
export function hasKey(key: string, locale: Locale = currentLocale): boolean {
  const dot = key.indexOf('.');
  const ns = NAMESPACES[key.slice(0, dot)];
  const sub = key.slice(dot + 1);
  return !!(ns?.[locale]?.[sub] ?? ns?.ko?.[sub]);
}

/** Pick the right side of a LocalizedText. */
export function lt(text: { ko: string; en: string } | undefined, locale: Locale = currentLocale): string {
  if (!text) return '';
  return text[locale] || text.ko || text.en;
}

export { NAMESPACES };
