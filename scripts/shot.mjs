// Screenshot helper for any team.
// Usage: node scripts/shot.mjs <baseUrl> <hashRoute> <out.png> [--w 390] [--h 844] [--dark] [--en] [--demo] [--full] [--wait 800] [--ff <hours>]
//   e.g. node scripts/shot.mjs http://127.0.0.1:5174 '#/' /tmp/x/home.png --demo
// --demo     : resets state and loads the demo parcels via window.__pp before navigating
// --ff N     : fast-forwards the simulation N hours after loading
// Prints console errors / page errors so you catch runtime bugs.
import { chromium } from '@playwright/test';
const [base, route, out, ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(n);
const opt = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d; };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: +opt('--w', 390), height: +opt('--h', 844) }, deviceScaleFactor: 2, colorScheme: flag('--dark') ? 'dark' : 'light', locale: flag('--en') ? 'en-US' : 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
if (flag('--demo') || flag('--en')) {
  await page.evaluate(async ({ demo, en }) => {
    const pp = window.__pp; if (!pp) throw new Error('window.__pp missing (run the dev server)');
    pp.actions.resetAll(); pp.actions.updateSettings({ onboarded: true, ...(en ? { locale: 'en' } : {}) });
    if (demo) await pp.actions.loadDemo();
  }, { demo: flag('--demo'), en: flag('--en') });
}
if (opt('--ff')) await page.evaluate((h) => window.__pp.actions.fastForward(h), +opt('--ff'));
await page.goto(base + '/' + route, { waitUntil: 'networkidle' });
await page.waitForTimeout(+opt('--wait', 800));
await page.screenshot({ path: out, fullPage: flag('--full') });
console.log(errors.length ? errors.join('\n') : 'no console errors/warnings');
await browser.close();
