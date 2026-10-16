import { test, expect, tid, setup, nav, fastForwardFromDetailUntil } from './fixtures';

test.describe('inbox', () => {
  test('empty inbox shows the empty state and no badge', async ({ page }) => {
    await setup(page, { route: '/inbox' });
    await expect(tid(page, 'inbox-empty')).toBeVisible();
    await expect(tid(page, 'inbox-badge')).toHaveCount(0);
  });

  test('updates arrive in the inbox; mark-all-read clears the badge', async ({ page }) => {
    await setup(page, { demo: true });
    const cards = tid(page, 'parcel-card');
    await expect(cards.first()).toBeVisible();
    // Drive time from the first parcel's detail screen (other parcels get unread updates).
    const first = (await cards.first().getAttribute('data-parcel-id'))!;
    await fastForwardFromDetailUntil(page, first, async () => (await tid(page, 'inbox-badge').count()) > 0);

    await expect(tid(page, 'inbox-badge')).toBeVisible();
    await expect(tid(page, 'inbox-badge')).toHaveText(/\d+/);
    await tid(page, 'tab-inbox').click();
    await expect(page).toHaveURL(/#\/inbox/);
    const items = tid(page, 'inbox-item');
    await expect(items.first()).toBeVisible();
    await expect(page.locator('[data-testid="inbox-item"][data-read="false"]').first()).toBeVisible();

    await tid(page, 'mark-all-read').click();
    await expect(page.locator('[data-testid="inbox-item"][data-read="false"]')).toHaveCount(0);
    await expect(tid(page, 'inbox-badge')).toHaveCount(0);
  });

  test('tapping an inbox item opens its parcel', async ({ page }) => {
    await setup(page, { demo: true });
    await page.evaluate(() => window.__pp!.actions.fastForward(8)); // setup shortcut: produce some updates
    await nav(page, '/inbox');
    await tid(page, 'inbox-item').first().click();
    await expect(page).toHaveURL(/#\/p\//);
    await expect(tid(page, 'journey-scene')).toBeVisible();
  });
});
