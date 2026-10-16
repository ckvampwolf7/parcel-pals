/**
 * Visual smoke: captures every screen to test-results/screens/<project>/<name>.png for HUMAN review.
 * No pixel assertions — it only fails on crashes (uncaught page errors) or missing screens.
 *   npx playwright test visual-smoke
 */
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, tid, setup, nav, addParcelDirect, fastForwardUntil, TEXT, UPS_NUMBER } from './fixtures';

const variants = [
  { name: 'ko-light', locale: 'ko', theme: 'light' },
  { name: 'ko-dark', locale: 'ko', theme: 'dark' },
  { name: 'en-light', locale: 'en', theme: 'light' },
] as const;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

for (const v of variants) {
  test(`screens ${v.name}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const dir = `test-results/screens/${info.project.name}`;
    mkdirSync(dir, { recursive: true });
    const shot = async (name: string, p: Page = page) => {
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${dir}/${name}-${v.name}.png`, fullPage: true });
    };
    await page.emulateMedia({ colorScheme: v.theme });

    await setup(page, { onboarded: false, settings: { locale: v.locale, theme: v.theme } });
    await shot('00-onboarding');
    for (let i = 1; i <= 2; i++) {
      const next = tid(page, 'onboarding-next');
      if (await next.isVisible().catch(() => false)) { await next.click(); await shot(`00-onboarding-${i + 1}`); }
    }

    await setup(page, { settings: { locale: v.locale, theme: v.theme } });
    await shot('01-home-empty');

    await setup(page, { demo: true, settings: { locale: v.locale, theme: v.theme } });
    await shot('02-home-demo');

    await nav(page, '/add');
    await shot('03-add-empty');
    if (await tid(page, 'tracking-input').isVisible().catch(() => false)) {
      await tid(page, 'tracking-input').fill('640123456781');
      await shot('04-add-ambiguous');
      await tid(page, 'tracking-input').fill(UPS_NUMBER);
      await shot('05-add-ups');
      await tid(page, 'tracking-input').fill('hello?');
      if (await tid(page, 'submit-add').isEnabled().catch(() => false)) await tid(page, 'submit-add').click();
      await shot('06-add-error');
    }

    const id = await addParcelDirect(page, { trackingNumber: '612345678901', nickname: v.locale === 'ko' ? '새 운동화' : 'New sneakers' });
    await nav(page, `/p/${id}`);
    await shot('07-detail-start');
    if (await tid(page, 'parcel-menu').isVisible().catch(() => false)) {
      await tid(page, 'parcel-menu').click();
      await shot('08-detail-menu');
      await page.keyboard.press('Escape');
    }
    if (await tid(page, 'fast-forward').isVisible().catch(() => false)) {
      await tid(page, 'fast-forward').first().click();
      await tid(page, 'fast-forward').first().click();
      await shot('09-detail-mid');
      await fastForwardUntil(page, async () => TEXT.delivered.test((await tid(page, 'status-chip').first().textContent().catch(() => '')) ?? ''), 15);
      await shot('10-detail-delivered');
    }

    await page.evaluate(() => window.__pp!.actions.fastForward(6));
    await nav(page, '/inbox');
    await shot('11-inbox');
    await nav(page, '/settings');
    await shot('12-settings');
    await nav(page, '/nope');
    await shot('13-not-found');

    // the shell rendered something on every screen
    await expect(page.locator('#root')).not.toBeEmpty();
  });
}
