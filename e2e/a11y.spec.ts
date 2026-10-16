/**
 * Accessibility smoke with axe-core: fails on serious/critical WCAG 2.x A/AA violations.
 * Moderate/minor findings are attached to the report for review but don't fail the build.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, tid, setup, nav, addParcelDirect, UPS_NUMBER } from './fixtures';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function audit(page: Page, testInfo: TestInfo, label: string) {
  await page.waitForTimeout(400); // let entrance transitions settle
  // @axe-core/playwright resolves a newer top-level playwright-core; the Page API it uses is the same.
  const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = results.violations.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}×)\n    ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} — ${(n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? ''}`).join('\n    ')}`);
  if (summary.length) await testInfo.attach(`axe-${label}`, { body: summary.join('\n'), contentType: 'text/plain' });
  expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), `axe on ${label}`).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`a11y (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await setup(page, { demo: true, settings: { theme } });
    });

    test('home', async ({ page }, info) => {
      await expect(tid(page, 'parcel-card').first()).toBeVisible();
      await audit(page, info, `home-${theme}`);
    });

    test('add (with candidates)', async ({ page }, info) => {
      await nav(page, '/add');
      await tid(page, 'tracking-input').fill('640123456781');
      await expect(tid(page, 'carrier-candidate').first()).toBeVisible();
      await audit(page, info, `add-${theme}`);
    });

    test('parcel detail', async ({ page }, info) => {
      const id = await addParcelDirect(page, { trackingNumber: UPS_NUMBER, nickname: '키보드' });
      await nav(page, `/p/${id}`);
      await expect(tid(page, 'journey-scene')).toBeVisible();
      await audit(page, info, `detail-${theme}`);
    });

    test('inbox', async ({ page }, info) => {
      await page.evaluate(() => window.__pp!.actions.fastForward(6));
      await nav(page, '/inbox');
      await expect(tid(page, 'inbox-item').first().or(tid(page, 'inbox-empty'))).toBeVisible();
      await audit(page, info, `inbox-${theme}`);
    });

    test('settings', async ({ page }, info) => {
      await nav(page, '/settings');
      await expect(tid(page, 'setting-theme-dark')).toBeVisible();
      await audit(page, info, `settings-${theme}`);
    });
  });
}

test('onboarding', async ({ page }, info) => {
  await setup(page, { onboarded: false });
  await expect(tid(page, 'onboarding')).toBeVisible();
  await audit(page, info, 'onboarding');
});

test('empty home and 404', async ({ page }, info) => {
  await setup(page);
  await expect(tid(page, 'empty-state')).toBeVisible();
  await audit(page, info, 'home-empty');
  await nav(page, '/nope');
  await audit(page, info, 'not-found');
});
