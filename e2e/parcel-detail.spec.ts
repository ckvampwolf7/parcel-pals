import { test, expect, tid, setup, nav, addParcelDirect, fastForwardUntil, confirmIfAsked, TEXT, expectTimelineItems } from './fixtures';

test.describe('parcel detail', () => {
  let id = '';
  test.beforeEach(async ({ page }) => {
    await setup(page);
    id = await addParcelDirect(page, { trackingNumber: '640123456781', carrierId: 'kr.cjlogistics', nickname: '새 운동화' });
    await nav(page, `/p/${id}`);
    await expect(tid(page, 'parcel-title')).toContainText('새 운동화');
  });

  test('scene, ETA, timeline and a text equivalent for the journey', async ({ page }) => {
    const scene = tid(page, 'journey-scene');
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute('data-progress', /\d/);
    await expect(tid(page, 'eta')).toBeVisible();
    await expect(tid(page, 'speech-bubble')).not.toBeEmpty();
    await expectTimelineItems(page, 1);
    // a11y contract: the scene has a text equivalent (aria-label / role=img name / sr-only text)
    const name = await scene.evaluate((el) => (el.getAttribute('aria-label') ?? '') + (el.textContent ?? ''));
    expect(name.trim().length).toBeGreaterThan(0);
    await expect(tid(page, 'tab-home')).toBeHidden();
  });

  test('fast-forward to delivered → celebration + Delivered chip', async ({ page }) => {
    await expect(tid(page, 'celebration')).toBeHidden();
    await fastForwardUntil(page, async () => TEXT.delivered.test((await tid(page, 'status-chip').first().textContent()) ?? ''), 25);
    await expect(tid(page, 'status-chip').first()).toHaveText(TEXT.delivered);
    await expect(tid(page, 'celebration')).toBeVisible();
    await expect(tid(page, 'journey-scene')).toHaveAttribute('data-progress', /^1(\.0+)?$/);
    await expect(page.locator('[data-testid="timeline-item"][data-status="delivered"]')).toHaveCount(1);
    // card on home reflects it
    await nav(page, '/');
    await expect(page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`)).toHaveAttribute('data-status', 'delivered');
  });

  test('rename via the menu', async ({ page }) => {
    await tid(page, 'parcel-menu').click();
    const input = tid(page, 'rename-input');
    if (!(await input.isVisible())) await page.getByRole('button', { name: /이름|rename/i }).first().click();
    await input.fill('엄마 생일선물');
    await tid(page, 'rename-save').click();
    await expect(tid(page, 'parcel-title')).toContainText('엄마 생일선물');
    await nav(page, '/');
    await expect(page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`)).toContainText('엄마 생일선물');
  });

  test('delete via the menu (with confirm) returns home without the parcel', async ({ page }) => {
    await tid(page, 'parcel-menu').click();
    await tid(page, 'delete-parcel').click();
    await tid(page, 'confirm-delete').click();
    await expect(page).not.toHaveURL(/#\/p\//);
    await nav(page, '/');
    await expect(tid(page, 'parcel-card')).toHaveCount(0);
    await expect(tid(page, 'empty-state')).toBeVisible();
  });

  test('archive via the menu hides it from the active list', async ({ page }) => {
    await tid(page, 'parcel-menu').click();
    await tid(page, 'archive-parcel').click();
    await confirmIfAsked(page, 'confirm-archive');
    await nav(page, '/');
    await expect(page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`)).toHaveCount(0);
  });

  test('change character from the menu', async ({ page }) => {
    await tid(page, 'parcel-menu').click();
    await tid(page, 'change-character').click();
    await tid(page, 'character-option-bunny').click();
    await confirmIfAsked(page, 'rename-save');
    await expect(tid(page, 'character').first()).toBeVisible();
  });

  test('carrier link points at the carrier tracking page in a new tab', async ({ page }) => {
    const link = tid(page, 'carrier-link');
    if (!(await link.isVisible())) await tid(page, 'parcel-menu').click();
    await expect(link).toHaveAttribute('href', /^https:\/\//);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('unknown parcel id renders a friendly screen, not a crash', async ({ page }) => {
    await nav(page, '/p/does-not-exist');
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    await expect(tid(page, 'journey-scene')).toHaveCount(0);
  });
});
