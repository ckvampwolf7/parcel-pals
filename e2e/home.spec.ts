import { test, expect, tid, setup, nav, fastForwardFromDetailUntil } from './fixtures';

test.describe('home', () => {
  test('empty state → load demo through the UI shows cards with status', async ({ page }) => {
    await setup(page);
    await expect(tid(page, 'empty-state')).toBeVisible();
    await tid(page, 'load-demo-button').click();
    const cards = tid(page, 'parcel-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    await expect(tid(page, 'empty-state')).toBeHidden();
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('data-parcel-id', /.+/);
      await expect(card).toHaveAttribute('data-status', /^[a-z_]+$/);
    }
    await expect(tid(page, 'add-button')).toBeVisible();
    await expect(tid(page, 'refresh-all')).toBeVisible();
  });

  test('new checkpoints show an unread dot; opening the parcel clears it', async ({ page }) => {
    await setup(page, { demo: true });
    const cards = tid(page, 'parcel-card');
    await expect(cards.first()).toBeVisible();
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-parcel-id')!));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const [driver, ...others] = ids;
    const card = (id: string) => page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`);

    // Move time forward with the detail screen's demo control (that parcel is marked seen), check the others.
    const ok = await fastForwardFromDetailUntil(page, driver, async () => {
      for (const id of others) if (await card(id).getByTestId('unread-dot').count()) return true;
      return false;
    });
    expect(ok, 'some other parcel got an unread dot after fast-forwarding').toBe(true);
    let target = others[0];
    for (const id of others) if (await card(id).getByTestId('unread-dot').count()) { target = id; break; }
    await expect(card(target).getByTestId('unread-dot')).toBeVisible();

    await card(target).click();
    await expect(page).toHaveURL(new RegExp(`#/p/${target}`));
    await nav(page, '/');
    await expect(card(target)).toBeVisible();
    await expect(card(target).getByTestId('unread-dot')).toHaveCount(0);
  });

  test('refresh-all can be pressed without errors', async ({ page }) => {
    await setup(page, { demo: true });
    await tid(page, 'refresh-all').click();
    await expect(tid(page, 'parcel-card').first()).toBeVisible();
  });
});
