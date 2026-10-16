import { test, expect, tid, setup, nav, TEXT } from './fixtures';

test.describe('routing & shell', () => {
  test('unknown route shows the 404 screen with a way home', async ({ page }) => {
    await setup(page, { route: '/this/does/not/exist' });
    await expect(page.getByText(TEXT.notFound).first()).toBeVisible();
    await page.getByRole('link', { name: /홈|home|돌아가|back/i }).or(page.getByRole('button', { name: /홈|home|돌아가|back/i })).first().click();
    await expect(page).toHaveURL(/#\/?$/);
  });

  test('tab bar navigates between home, inbox and settings', async ({ page }) => {
    await setup(page);
    await tid(page, 'tab-inbox').click();
    await expect(page).toHaveURL(/#\/inbox/);
    await tid(page, 'tab-settings').click();
    await expect(page).toHaveURL(/#\/settings/);
    await tid(page, 'tab-home').click();
    await expect(page).toHaveURL(/#\/?$/);
    await expect(tid(page, 'tab-home')).toHaveAttribute('aria-current', 'page');
  });

  test('add button opens the Add screen', async ({ page }) => {
    await setup(page);
    await tid(page, 'add-button').first().click();
    await expect(page).toHaveURL(/#\/add/);
    await expect(tid(page, 'tracking-input')).toBeVisible();
  });

  test('deep link #/add?n=… prefills the number', async ({ page }) => {
    await setup(page, { route: '/add?n=1Z999AA10123456784' });
    await expect.poll(async () => (await tid(page, 'tracking-input').inputValue()).replace(/[\s-]/g, '')).toBe('1Z999AA10123456784');
  });

  test('no horizontal scroll on any main screen', async ({ page }) => {
    await setup(page, { demo: true });
    for (const r of ['/', '/add', '/inbox', '/settings']) {
      await nav(page, r);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${r}`).toBeLessThanOrEqual(1);
    }
  });
});
