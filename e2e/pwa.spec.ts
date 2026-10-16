/**
 * PWA checks against the production build (`vite preview`): manifest, icons, service worker, offline.
 * Skipped against the dev server (the SW only registers in production builds).
 */
import { test, expect, tid, setup } from './fixtures';

const isDev = !!process.env.PP_E2E_DEV;

test.describe('pwa', () => {
  test.skip(isDev, 'service worker is only registered in production builds');
  test.use({ serviceWorkers: 'allow' });

  test('manifest is linked, valid and uses relative URLs', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const res = await request.get('manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toContain('택배친구');
    expect(m.short_name).toBe('택배친구');
    expect(m.lang).toBe('ko');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./#/');
    expect(m.scope).toBe('./');
    expect(m.theme_color).toBe('#fff8f0');
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toEqual(['./#/add', './#/inbox']);
    expect(m.share_target).toMatchObject({ action: './', method: 'GET' });
    for (const u of [m.start_url, m.scope, ...m.icons.map((i: { src: string }) => i.src)]) expect(u.startsWith('/')).toBe(false);
  });

  test('icons referenced by the manifest and <head> exist', async ({ page, request }) => {
    await page.goto('./');
    const m = await (await request.get('manifest.webmanifest')).json();
    const headIcons = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    const urls = [...new Set([...m.icons.map((i: { src: string }) => i.src), ...headIcons, og!])];
    const missing: string[] = [];
    for (const u of urls) {
      // `vite preview` answers unknown paths with index.html (200), so check the content type too.
      const res = await request.get(u.replace(/^\.\//, ''));
      if (!res.ok() || !/^image\//.test(res.headers()['content-type'] ?? '')) missing.push(u);
    }
    expect(missing, 'missing icon files (Characters team: public/icons/**)').toEqual([]);
  });

  test('service worker registers, precaches the shell, and the app loads offline', async ({ page, context }) => {
    await setup(page);
    const swInfo = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: !!reg.active, script: reg.active?.scriptURL };
    });
    expect(swInfo.active).toBe(true);
    expect(swInfo.script).toMatch(/\/sw\.js$/);
    // Precache contains index.html + the hashed JS bundle.
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const shell = keys.find((k) => k.startsWith('pp-shell-'));
      if (!shell) return { keys, urls: [] as string[] };
      const reqs = await (await caches.open(shell)).keys();
      return { keys, urls: reqs.map((r) => new URL(r.url).pathname) };
    });
    expect(cached.keys.some((k) => k.startsWith('pp-shell-')), `caches: ${cached.keys.join(', ')}`).toBe(true);
    expect(cached.urls).toContain('/index.html');
    expect(cached.urls.some((u) => /\/assets\/index-[\w-]+\.js$/.test(u))).toBe(true);

    // Make sure the SW controls the page before going offline.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(tid(page, 'tab-home')).toBeVisible();
    // deep link offline also falls back to the shell
    await page.goto('./?debug#/settings');
    await expect(page.locator('#root')).not.toBeEmpty();
    await context.setOffline(false);
  });

  test('sw.js has an injected version and precache list', async ({ request }) => {
    const body = await (await request.get('sw.js')).text();
    expect(body).not.toMatch(/\/\*__PP_VERSION__\*\/ 'dev'/);
    expect(body).toMatch(/\/\*__PP_PRECACHE__\*\/ \[.*"\.\/index\.html".*\]/);
  });

  test('head has install + social metadata', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', '택배친구');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /택배친구/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /택배/);
  });
});
