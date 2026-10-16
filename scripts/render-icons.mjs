// Renders the app icons + social image from the pal SVG art (src/characters/art.tsx).
// Usage: node scripts/render-icons.mjs
// Outputs (public/icons/): icon.svg, icon-192.png, icon-512.png, maskable-512.png,
//                          apple-touch-icon.png (180), favicon-32.png, og-image.png (1200×630)
// Owner: Characters team.
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

// Load the React art through Vite (handles TSX + the @/ alias), render to static SVG markup.
const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const art = await vite.ssrLoadModule('/src/characters/art.tsx');
const { createElement: h } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');

/** Pal as a nested <svg> placed at (x, y) with the given square size. */
function pal(kind, mood, x, y, size, opts = {}) {
  const svg = renderToStaticMarkup(h(art.PalSvg, { kind, mood, ...opts }));
  return svg.replace('width="100%" height="100%"', `x="${x}" y="${y}" width="${size}" height="${size}"`);
}
function box(x, y, size, face = false) {
  const svg = renderToStaticMarkup(h(art.ParcelBoxSvg, { face }));
  return svg.replace('width="100%" height="100%"', `x="${x}" y="${y}" width="${size}" height="${size}"`);
}
await vite.close();

const BRAND = '#5468ff';
const BRAND_DEEP = '#3e50e6';
const SKY = '#8fd3ff';

/**
 * Icon art on a 512 canvas. `inset` = how much of the canvas the pal may use (maskable needs ≤ 80% safe zone).
 * `rounded` = draw the rounded-square plate (purpose "any"); otherwise full-bleed (maskable / apple).
 */
function iconSvg({ rounded, inset = 0.86, mini = false }) {
  const S = 512;
  const bg = rounded
    ? `<rect x="0" y="0" width="${S}" height="${S}" rx="116" fill="url(#g)"/>`
    : `<rect x="0" y="0" width="${S}" height="${S}" fill="url(#g)"/>`;
  const palSize = S * inset;
  const px = (S - palSize) / 2;
  const py = (S - palSize) / 2 + (mini ? S * 0.02 : S * 0.035);
  // soft "sun" disc behind the pal + a little ground
  const disc = `<circle cx="${S / 2}" cy="${S * 0.47}" r="${S * inset * 0.39}" fill="${SKY}" opacity="0.35"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BRAND}"/><stop offset="1" stop-color="${BRAND_DEEP}"/></linearGradient></defs>
  ${bg}
  ${mini ? '' : disc}
  ${pal('truck', 'happy', px, py, palSize, { fx: false, tight: mini })}
</svg>`;
}

const iconAny = iconSvg({ rounded: true, inset: 0.84 });
const iconMaskable = iconSvg({ rounded: false, inset: 0.66 }); // pal stays well inside the central 80% circle
const iconApple = iconSvg({ rounded: false, inset: 0.78 });
const iconFav = iconSvg({ rounded: true, inset: 1.02, mini: true });
writeFileSync(join(out, 'icon.svg'), iconAny);

// Social image (1200×630): wordmark in Jua + all three pals.
const juaCss = pathToFileURL(join(root, 'node_modules/@fontsource/jua/400.css')).href;
const og = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${juaCss}">
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;overflow:hidden;background:#fff8f0;font-family:'Jua',sans-serif;color:#2d2a45;position:relative}
  .sun{position:absolute;border-radius:50%}
  .t{position:absolute;left:84px;top:150px}
  .w{font-size:132px;line-height:1;letter-spacing:-1px}
  .e{font-size:46px;color:#5468ff;margin-top:18px}
  .s{font-size:32px;color:#5e5a7d;margin-top:26px}
  .art{position:absolute;right:0;top:0;width:640px;height:630px}
</style></head><body>
<div class="sun" style="width:520px;height:520px;right:40px;top:40px;background:#fff4d1"></div>
<div class="sun" style="width:180px;height:180px;left:-60px;bottom:-70px;background:#ffe6e2"></div>
<div class="sun" style="width:90px;height:90px;left:520px;top:40px;background:#e6f5ff"></div>
<svg style="position:absolute;left:0;top:0" width="1200" height="630" viewBox="0 0 1200 630">
  <path d="M -10 590 Q 500 600 800 560 Q 1000 532 1210 548 L 1210 640 L -10 640 Z" fill="#ddf6ee"/>
  <path d="M -10 590 Q 500 600 800 560 Q 1000 532 1210 548" fill="none" stroke="#2fbf9b" stroke-width="6" stroke-linecap="round" opacity="0.45"/>
</svg>
<div class="t"><div class="w">택배친구</div><div class="e">Parcel Pals</div><div class="s">귀여운 친구가 내 택배를 데려다줘요</div></div>
<svg class="art" viewBox="0 0 640 630" xmlns="http://www.w3.org/2000/svg">
  <path d="M 60 170 q 18 -26 46 -10 q 22 -22 48 2 q 26 2 20 26 l -116 0 q -14 -4 2 -18 Z" fill="#ffffff" stroke="#2d2a45" stroke-width="5" stroke-linejoin="round"/>
  ${pal('plane', 'moving', 200, 40, 270)}
  ${pal('truck', 'happy', 20, 300, 290)}
  ${pal('bunny', 'celebrating', 330, 290, 280)}
  ${box(286, 470, 70, true)}
</svg>
</body></html>`;
const tmp = mkdtempSync(join(tmpdir(), 'pp-icons-'));
writeFileSync(join(tmp, 'og.html'), og);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function png(svg, size, file, transparent) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: join(out, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await png(iconAny, 192, 'icon-192.png', true);
await png(iconAny, 512, 'icon-512.png', true);
await png(iconMaskable, 512, 'maskable-512.png', false);
await png(iconApple, 180, 'apple-touch-icon.png', false);
await png(iconFav, 32, 'favicon-32.png', true);

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(tmp, 'og.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(out, 'og-image.png') });
await browser.close();
console.log('icons written to', out);
