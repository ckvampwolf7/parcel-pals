import { test, expect, tid, setup, addParcelViaUi, chooseLocale, nav, UPS_NUMBER } from './fixtures';

test('parcels and settings survive a reload', async ({ page }) => {
  await setup(page);
  const id = await addParcelViaUi(page, UPS_NUMBER, '키보드');
  await nav(page, '/settings');
  await tid(page, 'setting-theme-dark').click();
  await chooseLocale(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await nav(page, '/');
  const card = page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText('키보드');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(tid(page, 'onboarding')).toBeHidden();
});
