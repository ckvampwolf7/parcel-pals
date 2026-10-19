/** A phone in the US: region and language default from the device, US carriers come first. */
import { test, expect, tid, setup, fulfillJson } from './fixtures';

test.use({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });

test('US device: English + US region by default; a bare 12-digit number is FedEx', async ({ page }) => {
  await page.context().route('https://apis.tracker.delivery/**', (route) => {
    const url = route.request().url();
    return url.includes('/us.fedex/') ? route.fulfill(fulfillJson(200, { progresses: [
      { time: '2026-10-19T09:00:00-07:00', status: { id: 'at_pickup', text: 'Picked up' }, location: { name: 'LOS ANGELES, CA' }, description: 'Picked up' },
    ] })) : route.fulfill(fulfillJson(404, { message: 'tracking number not found.' }));
  });
  await setup(page, { route: '/settings' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(tid(page, 'setting-region-US')).toHaveAttribute('aria-checked', 'true');
  await page.goto(page.url().replace(/#.*$/, '#/add'));
  await tid(page, 'tracking-input').fill('612345678901');
  await expect(tid(page, 'carrier-select')).toHaveValue('us.fedex');
  await tid(page, 'submit-add').click();
  await expect(tid(page, 'timeline')).toContainText('Los Angeles');
});
