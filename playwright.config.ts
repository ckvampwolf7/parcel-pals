/**
 * Playwright config (PWA/QA team).
 *
 *   npx playwright test                    → builds the app (vite build + scripts/build-sw.mjs) and runs against `vite preview` :4173
 *   PP_E2E_DEV=1 npx playwright test       → runs against the dev server on :5178 (reused if already running)
 *   PP_E2E_URL=http://host:port npx …      → runs against any already-running server (no webServer started)
 *
 * Uses the pre-installed Chromium (no `playwright install`). Service workers are blocked by default so tests
 * are hermetic; e2e/pwa.spec.ts opts back in to test offline support.
 */
import { defineConfig, devices } from '@playwright/test';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const useDev = !!process.env.PP_E2E_DEV;
const externalUrl = process.env.PP_E2E_URL;
const port = useDev ? 5178 : 4173;
const baseURL = externalUrl ?? `http://127.0.0.1:${port}/`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: CHROMIUM },
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: externalUrl
    ? undefined
    : useDev
      ? {
          command: 'npx vite --host 127.0.0.1 --port 5178 --strictPort',
          url: 'http://127.0.0.1:5178/',
          reuseExistingServer: true,
          timeout: 60_000,
        }
      : {
          // `vite build` (not `npm run build`): don't let a type error elsewhere block the e2e run.
          command: 'npx vite build && node scripts/build-sw.mjs && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
          url: 'http://127.0.0.1:4173/',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
});
