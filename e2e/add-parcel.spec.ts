import { test, expect, tid, setup, nav, addParcelViaUi, isSelected, UPS_NUMBER, AMBIGUOUS_KR_NUMBER, expectTimelineItems } from './fixtures';

test.describe('add parcel', () => {
  test.beforeEach(async ({ page }) => { await setup(page, { route: '/add' }); });

  test('UPS 1Z number is detected, submitted, and opens the journey', async ({ page }) => {
    await tid(page, 'tracking-input').fill(UPS_NUMBER);
    const ups = page.locator('[data-testid="carrier-candidate"][data-carrier-id="us.ups"]');
    await expect(ups).toBeVisible();
    await expect.poll(() => isSelected(ups)).toBe(true);
    await tid(page, 'nickname-input').fill('키보드');
    await tid(page, 'submit-add').click();

    await expect(page).toHaveURL(/#\/p\/[^/]+/);
    await expect(tid(page, 'parcel-title')).toContainText('키보드');
    await expect(tid(page, 'journey-scene')).toBeVisible();
    await expect(tid(page, 'journey-scene')).toHaveAttribute('data-progress', /^(0(\.\d+)?|1(\.0+)?)$/);
    await expectTimelineItems(page, 1);
    await expect(tid(page, 'character').first()).toBeVisible();
    await expect(tid(page, 'speech-bubble')).not.toBeEmpty();
    await expect(tid(page, 'status-chip').first()).toBeVisible();
  });

  test('typing with spaces/dashes still detects the carrier (normalisation)', async ({ page }) => {
    await tid(page, 'tracking-input').fill('1Z 999 AA1-0123456784');
    await expect(page.locator('[data-testid="carrier-candidate"][data-carrier-id="us.ups"]')).toBeVisible();
  });

  test('ambiguous 12-digit Korean number offers several ranked candidates', async ({ page }) => {
    await tid(page, 'tracking-input').fill(AMBIGUOUS_KR_NUMBER);
    const candidates = tid(page, 'carrier-candidate');
    await expect(candidates.first()).toBeVisible();
    expect(await candidates.count()).toBeGreaterThanOrEqual(2);
    // exactly one candidate is selected, and it can be changed with one tap
    await expect(page.locator('[data-testid="carrier-candidate"][aria-pressed="true"]')).toHaveCount(1);
    const second = candidates.nth(1);
    await second.click();
    await expect.poll(() => isSelected(second)).toBe(true);
    await expect(page.locator('[data-testid="carrier-candidate"][aria-pressed="true"]')).toHaveCount(1);
    // the manual picker lists every carrier
    expect(await tid(page, 'carrier-select').locator('option').count()).toBeGreaterThanOrEqual(5);
  });

  test('invalid input shows a friendly error instead of adding', async ({ page }) => {
    await tid(page, 'tracking-input').fill('hello?');
    const submit = tid(page, 'submit-add');
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(tid(page, 'add-error')).toBeVisible();
    }
    await expect(page).toHaveURL(/#\/add/);
  });

  test('adding the same number twice does not create a duplicate', async ({ page }) => {
    const firstId = await addParcelViaUi(page, UPS_NUMBER, 'first');
    await nav(page, '/add');
    await tid(page, 'tracking-input').fill(UPS_NUMBER);
    const submit = tid(page, 'submit-add');
    if (await submit.isEnabled()) await submit.click();
    // Either an inline error (submit may be disabled), or the app takes you to the parcel you already have.
    await expect(async () => {
      const err = await tid(page, 'add-error').isVisible();
      const onExisting = page.url().includes(`#/p/${encodeURIComponent(firstId)}`);
      expect(err || onExisting).toBe(true);
    }).toPass({ timeout: 5_000 });
    await nav(page, '/');
    await expect(tid(page, 'parcel-card')).toHaveCount(1);
  });

  test('add screen hides the tab bar', async ({ page }) => {
    await expect(tid(page, 'tracking-input')).toBeVisible();
    await expect(tid(page, 'tab-home')).toBeHidden();
  });
});

test('share target: KakaoTalk-style text opens Add with the number extracted', async ({ page }) => {
  const text = `[CJ대한통운] 고객님의 상품이 발송되었습니다.\n해외 배송 UPS 운송장번호: ${UPS_NUMBER}\n배송조회 https://example.com/t`;
  await setup(page);
  await page.goto(`./?debug&text=${encodeURIComponent(text)}`);
  await expect(page).toHaveURL(/#\/add/);
  await expect(tid(page, 'tracking-input')).toBeVisible();
  // the number is pulled out of the message (input may show it formatted with spaces/dashes)
  await expect.poll(async () => (await tid(page, 'tracking-input').inputValue()).replace(/[\s-]/g, '').toUpperCase()).toBe(UPS_NUMBER);
  await expect(page.locator('[data-testid="carrier-candidate"][data-carrier-id="us.ups"]')).toBeVisible();
});
