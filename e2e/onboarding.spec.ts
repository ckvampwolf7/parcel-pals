import { test, expect, tid, openApp } from './fixtures';

test.describe('onboarding', () => {
  test('first run shows onboarding; skip lands on an empty home and is remembered', async ({ page }) => {
    await openApp(page, '/');
    await expect(tid(page, 'onboarding')).toBeVisible();
    await tid(page, 'onboarding-skip').click();
    await expect(tid(page, 'onboarding')).toBeHidden();
    await expect(tid(page, 'empty-state')).toBeVisible();
    await expect(tid(page, 'tab-home')).toBeVisible();

    await page.reload();
    await expect(tid(page, 'empty-state')).toBeVisible();
    await expect(tid(page, 'onboarding')).toBeHidden();
  });

  test('next → … → "try a demo" loads demo parcels', async ({ page }) => {
    await openApp(page, '/');
    await expect(tid(page, 'onboarding')).toBeVisible();
    const demo = tid(page, 'onboarding-demo');
    for (let i = 0; i < 6 && !(await demo.isVisible()); i++) await tid(page, 'onboarding-next').click();
    await demo.click();
    await expect(tid(page, 'onboarding')).toBeHidden();
    await expect(tid(page, 'parcel-card').first()).toBeVisible();
    expect(await tid(page, 'parcel-card').count()).toBeGreaterThanOrEqual(2);
  });

  test('"add my parcel" finishes onboarding on the Add screen', async ({ page }) => {
    await openApp(page, '/');
    const add = tid(page, 'onboarding-add');
    for (let i = 0; i < 6 && !(await add.isVisible()); i++) await tid(page, 'onboarding-next').click();
    await add.click();
    await expect(page).toHaveURL(/#\/add/);
    await expect(tid(page, 'tracking-input')).toBeVisible();
  });
});
