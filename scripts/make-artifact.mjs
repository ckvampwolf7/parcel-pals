// Package dist/ as a claude.ai Artifact: index.html becomes a fragment (the host adds <html>/<head>/<body>),
// and only files browsers actually load are kept (woff2 fonts, js, css, icons). Service worker & manifest are
// dropped (the Artifact frame doesn't run service workers). Usage: npm run build && node scripts/make-artifact.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
const OUT = 'dist-artifact';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/assets`, { recursive: true });
for (const f of readdirSync('dist/assets')) if (!f.endsWith('.woff')) cpSync(`dist/assets/${f}`, `${OUT}/assets/${f}`);
for (const f of ['favicon-32.png', 'icon.svg']) if (existsSync(`dist/icons/${f}`)) { mkdirSync(`${OUT}/icons`, { recursive: true }); cpSync(`dist/icons/${f}`, `${OUT}/icons/${f}`); }
const html = readFileSync('dist/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = '<title>택배친구 Parcel Pals</title>';
const metas = pick(/<meta name="(description|theme-color)"[^>]*>/g);
const icons = pick(/<link rel="icon"[^>]*>/g);
const css = pick(/<link rel="stylesheet"[^>]*>/g);
const js = pick(/<script type="module"[^>]*><\/script>/g);
writeFileSync(`${OUT}/index.html`, [title, ...metas, ...icons, ...css, '<div id="root"></div>', ...js, ''].join('\n'));
const files = readdirSync(`${OUT}/assets`).map((f) => `assets/${f}`).concat(existsSync(`${OUT}/icons`) ? readdirSync(`${OUT}/icons`).map((f) => `icons/${f}`) : []);
writeFileSync(`${OUT}/files.json`, JSON.stringify(Object.fromEntries(files.map((f) => [f, `${OUT}/${f}`]))));
console.log(`${OUT}: ${files.length} files + index.html`);
