/**
 * Cloud sync between two devices (two browser contexts) — hermetic: the Supabase RPC is faked in-process with the
 * same rules as supabase/migrations (tuple versions, tombstones, cursor that trails "now").
 */
import type { BrowserContext, Page, Route } from '@playwright/test';
import { test, expect, tid, setup, addParcelViaUi, nav, FAKE_TRACE, fulfillJson } from './fixtures';

interface Row { id: string; data: unknown; modifiedAt: string; snapAt: string; snapN: number; at: number }

function fakeServer() {
  const accounts = new Map<string, Map<string, Row>>();
  const calls: string[] = [];
  const cmp = (a: Row | Omit<Row, 'at' | 'id' | 'data'>, b: Row) =>
    Date.parse(a.modifiedAt) - Date.parse(b.modifiedAt) || Date.parse(a.snapAt) - Date.parse(b.snapAt) || a.snapN - b.snapN;
  const handle = async (route: Route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON() ?? {};
    const fn = url.split('/rpc/')[1] ?? url.split('/functions/v1/')[1];
    calls.push(fn);
    if (fn === 'pp_sync') {
      const key = body.p_key as string;
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) return route.fulfill(fulfillJson(400, { message: 'invalid sync key' }));
      const rows = accounts.get(key) ?? new Map<string, Row>();
      accounts.set(key, rows);
      for (const c of body.p_changes ?? []) {
        const next: Row = { id: c.id, data: c.data ?? null, modifiedAt: c.modifiedAt, snapAt: c.snapAt ?? '1970-01-01T00:00:00Z', snapN: c.snapN ?? 0, at: Date.now() };
        const cur = rows.get(c.id);
        if (!cur || cmp(next, cur) > 0) rows.set(c.id, next);
      }
      const since = body.p_since ? Date.parse(body.p_since) : -Infinity;
      const out = [...rows.values()].filter((r) => r.at > since).map(({ at: _at, ...r }) => r);
      return route.fulfill(fulfillJson(200, { cursor: new Date(Date.now() - 120_000).toISOString(), rows: out }));
    }
    return route.fulfill(fulfillJson(404, {}));
  };
  return { accounts, calls, handle };
}

async function device(ctx: BrowserContext, server: ReturnType<typeof fakeServer>) {
  await ctx.route('https://apis.tracker.delivery/**', (r) => r.fulfill(fulfillJson(200, FAKE_TRACE)));
  await ctx.route('https://wbevtynfofwyhwjzhwpz.supabase.co/**', server.handle);
}
const names = (page: Page) => page.getByTestId('parcel-card').allInnerTexts();

test.describe('cloud sync', () => {
  test('a parcel added on one device shows up on the other; edits and deletions follow', async ({ page, browser }) => {
    const server = fakeServer();
    await device(page.context(), server);
    await setup(page, { route: '/' });
    await addParcelViaUi(page, '612345678909', '운동화');

    // Device A: turn sync on and read the connect link (also shown as a QR code).
    await nav(page, '/settings');
    await tid(page, 'sync-enable').click();
    await expect(tid(page, 'sync-qr')).toBeVisible();
    await expect(tid(page, 'sync-status')).toHaveAttribute('data-state', 'ok');
    const link = (await tid(page, 'sync-link-url').innerText()).trim();
    expect(link).toMatch(/#\/link\/[A-Za-z0-9_-]{43}$/);
    expect([...server.accounts.values()][0].size).toBe(1);

    // Device B (a phone): open the link, confirm.
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await device(ctxB, server);
    const phone = await ctxB.newPage();
    await phone.goto('./?debug' + link.slice(link.indexOf('#')));
    await expect(tid(phone, 'link-screen')).toBeVisible();
    await tid(phone, 'link-confirm').click();
    await expect(phone).toHaveURL(/#\/$/);
    await expect.poll(() => names(phone)).toEqual([expect.stringContaining('운동화')]);

    // Rename on the phone → the computer gets it.
    const phoneId = await phone.getByTestId('parcel-card').first().getAttribute('data-parcel-id');
    await phone.evaluate((id) => {
      const pp = (window as unknown as { __pp: { actions: { updateParcel(id: string, p: object): void } } }).__pp;
      pp.actions.updateParcel(id!, { nickname: '러닝화' });
    }, phoneId);
    await nav(phone, '/settings');
    await tid(phone, 'sync-now').click();
    await expect(tid(phone, 'sync-status')).toHaveAttribute('data-state', 'ok');
    await tid(page, 'sync-now').click();
    await expect(tid(page, 'sync-status')).toHaveAttribute('data-state', 'ok');
    await nav(page, '/');
    await expect.poll(() => names(page)).toEqual([expect.stringContaining('러닝화')]);

    // Delete on the computer → gone on the phone too.
    const pcId = await page.getByTestId('parcel-card').first().getAttribute('data-parcel-id');
    await page.evaluate((id) => {
      const pp = (window as unknown as { __pp: { actions: { removeParcel(id: string): void } } }).__pp;
      pp.actions.removeParcel(id!);
    }, pcId);
    await nav(page, '/settings');
    await tid(page, 'sync-now').click();
    await expect(tid(page, 'sync-status')).toHaveAttribute('data-state', 'ok');
    await tid(phone, 'sync-now').click();
    await expect(tid(phone, 'sync-status')).toHaveAttribute('data-state', 'ok');
    await nav(phone, '/');
    await expect.poll(() => phone.getByTestId('parcel-card').count()).toBe(0);
    await ctxB.close();
  });

  test('a bad link explains itself and changes nothing', async ({ page }) => {
    await setup(page, { route: '/link/not-a-real-key' });
    await expect(tid(page, 'link-screen')).toContainText(/올바르지 않|isn’t valid/);
    await expect(tid(page, 'link-confirm')).toHaveCount(0);
  });

  test('the push switch appears once sync is on', async ({ page }) => {
    const server = fakeServer();
    await device(page.context(), server);
    await setup(page, { route: '/settings' });
    await expect(tid(page, 'setting-push')).toHaveCount(0);
    await tid(page, 'sync-enable').click();
    await expect(tid(page, 'setting-push')).toBeVisible();
  });
});
