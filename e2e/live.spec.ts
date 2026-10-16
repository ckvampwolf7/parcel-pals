/**
 * Live tracking (real parcels) — hermetic: tracker.delivery is faked with documented response shapes.
 * The browser calls https://apis.tracker.delivery directly (CORS *), so page routes intercept it.
 */
import { test, expect, tid, setup, nav, addParcelViaUi, FAKE_TRACE, fulfillJson } from './fixtures';

const OUT_FOR_DELIVERY = {
  ...FAKE_TRACE,
  progresses: [
    ...FAKE_TRACE.progresses,
    { time: '2026-10-16T09:17:56+09:00', status: { id: 'out_for_delivery', text: '배송출발' }, location: { name: '충북보은' }, description: '고객님의 상품을 배송할 예정입니다.(17~19시)' },
  ],
};

test.describe('live tracking', () => {
  test('a real parcel shows carrier data: live badge, places, carrier detail, no demo controls', async ({ page }) => {
    const calls: string[] = [];
    await page.context().route('https://apis.tracker.delivery/**', (route) => {
      calls.push(route.request().url());
      return route.fulfill(fulfillJson(200, OUT_FOR_DELIVERY));
    });
    await setup(page);
    const id = await addParcelViaUi(page, '612345678909', '무선 이어폰');
    expect(calls[0]).toContain('/carriers/kr.cjlogistics/tracks/612345678909');
    await expect(tid(page, 'live-badge')).toBeVisible();
    await expect(tid(page, 'fast-forward')).toHaveCount(0);
    await expect(tid(page, 'status-chip').first()).toHaveAttribute('data-status', 'out_for_delivery');
    await expect(tid(page, 'timeline-item')).toHaveCount(4);
    await expect(tid(page, 'timeline')).toContainText('17~19시');
    await expect(tid(page, 'journey-scene')).toContainText('대전HUB');
    const progress = Number(await tid(page, 'journey-scene').getAttribute('data-progress'));
    expect(progress).toBeGreaterThan(0.7);
    expect(progress).toBeLessThan(1);
    // home card reflects the live status
    await nav(page, '/');
    await expect(page.locator(`[data-testid="parcel-card"][data-parcel-id="${id}"]`)).toHaveAttribute('data-status', 'out_for_delivery');
  });

  test('carrier has no record yet → explains, and one tap re-looks it up with another carrier', async ({ page }) => {
    await page.context().route('https://apis.tracker.delivery/**', (route) => {
      const url = route.request().url();
      if (url.includes('/kr.cjlogistics/')) return route.fulfill(fulfillJson(404, { message: 'tracking number not found.' }));
      return route.fulfill(fulfillJson(200, FAKE_TRACE));
    });
    await setup(page);
    await addParcelViaUi(page, '612345678909');
    await expect(tid(page, 'live-status')).toHaveAttribute('data-live-status', 'not_found');
    await expect(tid(page, 'speech-bubble')).toBeVisible();
    const chip = tid(page, 'retry-carrier').filter({ hasText: /한진/ });
    await chip.click();
    await expect(tid(page, 'live-status')).toHaveCount(0);
    await expect(tid(page, 'timeline-item')).toHaveCount(3);
  });

  test('invalid number for the carrier shows the carrier message', async ({ page }) => {
    await page.context().route('https://apis.tracker.delivery/**', (route) => route.fulfill(fulfillJson(400, { message: '운송장 번호는 10자리 혹은 12자리입니다.' })));
    await setup(page);
    await addParcelViaUi(page, '612345678909');
    await expect(tid(page, 'live-status')).toHaveAttribute('data-live-status', 'invalid');
    await expect(tid(page, 'live-status')).toContainText('10자리 혹은 12자리');
  });

  test('carrier without live lookup: warned on Add, website link on detail, no network call', async ({ page }) => {
    let called = false;
    await page.context().route('https://apis.tracker.delivery/**', (route) => { called = true; return route.fulfill(fulfillJson(200, FAKE_TRACE)); });
    await setup(page);
    await nav(page, '/add');
    await tid(page, 'tracking-input').fill('YT2512345678901234');
    await tid(page, 'carrier-select').selectOption('cn.yunexpress');
    await expect(tid(page, 'add-unsupported')).toBeVisible();
    await tid(page, 'submit-add').click();
    await expect(tid(page, 'live-status')).toHaveAttribute('data-live-status', 'unsupported');
    await expect(tid(page, 'live-status').getByRole('link')).toHaveAttribute('href', /yuntrack\.com.*YT2512345678901234/);
    expect(called).toBe(false);
  });

  test('service outage keeps the last data and says so', async ({ page }) => {
    let down = false;
    await page.context().route('https://apis.tracker.delivery/**', (route) => (down ? route.fulfill(fulfillJson(502, {})) : route.fulfill(fulfillJson(200, FAKE_TRACE))));
    await setup(page);
    const id = await addParcelViaUi(page, '612345678909');
    down = true;
    // The last lookup was an hour ago → on the next app start the store looks it up again (and hits the outage).
    // Patch storage in an init script: the app itself saves on pagehide, which would overwrite an earlier edit.
    await page.addInitScript((pid) => {
      const raw = localStorage.getItem('parcel-pals:v1');
      if (!raw) return;
      const st = JSON.parse(raw);
      st.parcels = st.parcels.map((x: { id: string }) => (x.id === pid ? { ...x, lastCheckedAt: new Date(Date.now() - 3.6e6).toISOString() } : x));
      localStorage.setItem('parcel-pals:v1', JSON.stringify(st));
    }, id);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText(/문제|trouble/);
    await expect(tid(page, 'timeline-item')).toHaveCount(3);
  });

  test('settings: connection test and test parcel use the live service', async ({ page }) => {
    const urls: string[] = [];
    await page.context().route('https://apis.tracker.delivery/**', (route) => { urls.push(route.request().url()); return route.fulfill(fulfillJson(200, FAKE_TRACE)); });
    await setup(page, { route: '/settings' });
    await tid(page, 'setting-live-test').click();
    await expect(tid(page, 'setting-live-test')).toHaveAttribute('data-state', 'ok');
    await tid(page, 'add-test-parcel').click();
    await expect(page).toHaveURL(/#\/p\//);
    await expect(tid(page, 'live-badge')).toBeVisible();
    expect(urls.every((u) => u.includes('/carriers/dev.track.dummy/tracks/'))).toBe(true);
  });
});
