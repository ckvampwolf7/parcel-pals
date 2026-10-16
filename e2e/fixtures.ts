/**
 * Shared e2e helpers (PWA/QA team).
 * Tests select ONLY by data-testid (docs/TEAM_BRIEF.md §4) and ARIA roles — never CSS classes.
 * `window.__pp` (dev server, or any build opened with ?debug) is used for SETUP shortcuts only;
 * the behaviour under test is always driven through the real UI.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { AddParcelInput, Parcel, Settings } from '../src/types';

interface PP {
  actions: {
    resetAll(): void;
    updateSettings(patch: Partial<Settings>): void;
    loadDemo(): Promise<void>;
    addParcel(input: AddParcelInput): Promise<Parcel>;
    fastForward(hours: number): Promise<void>;
  };
  simNow(): Date;
}
declare global { interface Window { __pp?: PP } }

/** A UPS number that passes the 1Z check digit, and a 12-digit domestic number (CJ / Hanjin / Lotte collide). */
export const UPS_NUMBER = '1Z999AA10123456784';
export const AMBIGUOUS_KR_NUMBER = '640123456781';

/** Patterns for text that differs by locale. */
export const TEXT = {
  delivered: /배송\s?완료|Delivered/i,
  notFound: /404|찾을 수 없|없는 페이지|길을 잃|not found|lost/i,
};

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/Failed to load resource/.test(text)) return; // e.g. icons not drawn yet — checked in pwa.spec
        consoleErrors.push(text);
      });
      await use(pageErrors);
      if (consoleErrors.length) {
        testInfo.annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 10).join('\n') });
      }
      expect(pageErrors, 'uncaught exceptions in the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const tid = (page: Page | Locator, id: string) => page.getByTestId(id);

/** Navigate inside the app without reloading (hash route, e.g. '/add', '/p/abc'). */
export async function nav(page: Page, route: string) {
  await page.evaluate((h) => { window.location.hash = h; }, '#' + route);
}

/** Load the app with the debug handle. */
export async function openApp(page: Page, route = '/') {
  await page.goto(`./?debug#${route}`);
  await page.waitForFunction(() => !!window.__pp, null, { timeout: 15_000 });
}

export interface SetupOptions {
  onboarded?: boolean;
  demo?: boolean;
  settings?: Partial<Settings>;
  route?: string;
}

/** Fresh state via window.__pp, then go to `route` (default home). */
export async function setup(page: Page, opts: SetupOptions = {}) {
  await openApp(page, '/');
  await page.evaluate(async ({ onboarded, demo, settings }) => {
    const pp = window.__pp!;
    pp.actions.resetAll();
    pp.actions.updateSettings({ onboarded, ...settings });
    if (demo) await pp.actions.loadDemo();
  }, { onboarded: opts.onboarded ?? true, demo: !!opts.demo, settings: opts.settings ?? {} });
  await nav(page, opts.route ?? '/');
}

/** Setup shortcut: add a parcel through the store, return its id. */
export async function addParcelDirect(page: Page, input: AddParcelInput): Promise<string> {
  return page.evaluate(async (inp) => (await window.__pp!.actions.addParcel(inp)).id, input);
}

/** Add a parcel through the real Add screen. Returns the detail-route parcel id. */
export async function addParcelViaUi(page: Page, number: string, nickname?: string): Promise<string> {
  await nav(page, '/add');
  await tid(page, 'tracking-input').fill(number);
  if (nickname) await tid(page, 'nickname-input').fill(nickname);
  await tid(page, 'submit-add').click();
  await expect(page).toHaveURL(/#\/p\/[^/?]+/);
  return decodeURIComponent(new URL(page.url()).hash.replace(/^#\/p\//, '').split('?')[0]);
}

/** Click the detail screen's demo fast-forward control until `done()` or `max` clicks. */
export async function fastForwardUntil(page: Page, done: () => Promise<boolean>, max = 20) {
  const ff = tid(page, 'fast-forward');
  for (let i = 0; i < max; i++) {
    if (await done()) return;
    await ff.first().click();
    await page.waitForTimeout(150);
  }
}

/**
 * From parcel `fromId`'s detail screen, press the demo fast-forward control (one press per round) until `done()`
 * is true when checked on the home screen. Robust to however many hours one press advances.
 */
export async function fastForwardFromDetailUntil(page: Page, fromId: string, done: () => Promise<boolean>, rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await nav(page, `/p/${fromId}`);
    await tid(page, 'fast-forward').first().click();
    await page.waitForTimeout(300);
    await nav(page, '/');
    await tid(page, 'parcel-card').first().waitFor();
    if (await done()) return true;
  }
  return false;
}

/** Selected state of a toggle-ish control: aria-pressed, aria-checked, or a checked input. */
export async function isSelected(loc: Locator): Promise<boolean> {
  const pressed = (await loc.getAttribute('aria-pressed')) ?? (await loc.getAttribute('aria-checked'));
  if (pressed !== null) return pressed === 'true';
  return loc.isChecked().catch(() => false);
}

/**
 * A just-added parcel may still be 'pending' (the simulated carrier scans it 5–30 sim-minutes later), so the
 * timeline can start empty. Wait briefly, then use the demo fast-forward control once if needed.
 */
export async function expectTimelineItems(page: Page, min = 1) {
  await expect(tid(page, 'timeline')).toBeVisible();
  const items = tid(page, 'timeline-item');
  try {
    await expect.poll(() => items.count(), { timeout: 2_000 }).toBeGreaterThanOrEqual(min);
  } catch {
    await tid(page, 'fast-forward').first().click();
    await expect.poll(() => items.count()).toBeGreaterThanOrEqual(min);
  }
}

/** Pick a locale in settings — works with a <select> or a segmented control. */
export async function chooseLocale(page: Page, locale: 'ko' | 'en') {
  const button = tid(page, `setting-locale-${locale}`);
  if (await button.count()) { await button.click(); return; }
  const control = tid(page, 'setting-locale');
  const tag = await control.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') await control.selectOption(locale);
  else await control.getByRole('button', { name: locale === 'ko' ? /한국어|ko/i : /english|en/i }).click();
}

/** Some designs open a confirm sheet; others act immediately. Click the confirm id if it shows up. */
export async function confirmIfAsked(page: Page, confirmId: string) {
  const confirm = tid(page, confirmId);
  try {
    await confirm.waitFor({ state: 'visible', timeout: 2_000 });
    await confirm.click();
  } catch { /* no confirm step */ }
}

/** Dismiss onboarding if it is showing (e.g. after reset). */
export async function skipOnboardingIfShown(page: Page) {
  const ob = tid(page, 'onboarding');
  if (await ob.isVisible().catch(() => false)) await tid(page, 'onboarding-skip').click();
}
