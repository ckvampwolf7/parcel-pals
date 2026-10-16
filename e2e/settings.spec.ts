import { test, expect, tid, setup, nav, chooseLocale, skipOnboardingIfShown, isSelected } from './fixtures';

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => { await setup(page, { route: '/settings' }); });

  test('switching to English updates <html lang> and visible text, and back', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(tid(page, 'tab-settings')).toHaveAccessibleName(/설정/);
    await chooseLocale(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(tid(page, 'tab-settings')).toHaveAccessibleName(/settings/i);
    await expect(tid(page, 'tab-home')).toHaveAccessibleName(/home|parcels/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/settings/i);
    await chooseLocale(page, 'ko');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  });

  test('theme dark / light sets data-theme', async ({ page }) => {
    await tid(page, 'setting-theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1b1930');
    await tid(page, 'setting-theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme system follows the OS colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await tid(page, 'setting-theme-system').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('reduced motion setting sets data-reduce-motion', async ({ page }) => {
    await tid(page, 'setting-reduce-motion-on').click();
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
    await tid(page, 'setting-reduce-motion-off').click();
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await tid(page, 'setting-reduce-motion-system').click();
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  });

  test('notifications switch toggles', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    const sw = tid(page, 'setting-notifications');
    await expect(sw).toBeVisible();
    const role = await sw.getAttribute('role');
    const state = async () => (role === 'switch' ? await sw.getAttribute('aria-checked') : String(await sw.isChecked()));
    const before = await state();
    await sw.click();
    await expect.poll(state).not.toBe(before);
  });

  test('demo speed and default character controls exist', async ({ page }) => {
    await expect(tid(page, 'setting-demo-speed')).toBeVisible();
    await expect(tid(page, 'setting-default-character')).toBeVisible();
    await tid(page, 'setting-default-character').getByTestId('character-option-bunny').click();
    await expect.poll(() => isSelected(tid(page, 'character-option-bunny'))).toBe(true);
  });

  test('load demo then reset data → empty state', async ({ page }) => {
    await tid(page, 'load-demo').click();
    await nav(page, '/');
    await expect(tid(page, 'parcel-card').first()).toBeVisible();
    await nav(page, '/settings');
    await tid(page, 'reset-data').click();
    await tid(page, 'confirm-reset').click();
    await skipOnboardingIfShown(page); // reset may bring back first-run onboarding
    await nav(page, '/');
    await skipOnboardingIfShown(page);
    await expect(tid(page, 'empty-state')).toBeVisible();
    await expect(tid(page, 'parcel-card')).toHaveCount(0);
  });
});
