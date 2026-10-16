#!/usr/bin/env node
// Post-build step (PWA/QA team): turn dist/sw.js (copied from public/sw.js by Vite) into the real service worker.
//  - injects PRECACHE_URLS = every file in dist/ that the app shell needs (relative URLs, base './')
//  - injects VERSION = short content hash of those files, so any change ships a new SW and new cache
// Usage: node scripts/build-sw.mjs [distDir=dist]
// Run after `vite build` (package.json: "build": "tsc -b && vite build && node scripts/build-sw.mjs").
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const swPath = join(dist, 'sw.js');

/** Files never precached: the SW itself, fonts (cached on first use), social images, source maps, misc. */
const EXCLUDE = [
  /^sw\.js$/,
  /\.(woff2?|ttf|otf|eot)$/i,
  /\.map$/i,
  /^icons\/og-image\.png$/i,
  /(^|\/)\.[^/]+$/, // dotfiles
  /\.(txt|md)$/i,
];
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

let template;
try {
  template = await readFile(swPath, 'utf8');
} catch {
  console.error(`[build-sw] ${swPath} not found — run \`vite build\` first (public/sw.js is copied by Vite).`);
  process.exit(1);
}

const files = (await walk(dist))
  .map((abs) => ({ abs, rel: relative(dist, abs).split(sep).join('/') }))
  .filter(({ rel }) => !EXCLUDE.some((re) => re.test(rel)))
  .sort((a, b) => a.rel.localeCompare(b.rel));

const hash = createHash('sha256');
const urls = ['./'];
let total = 0;
const skipped = [];
for (const { abs, rel } of files) {
  const size = (await stat(abs)).size;
  if (size > MAX_FILE_BYTES) { skipped.push(`${rel} (${(size / 1024).toFixed(0)} KB)`); continue; }
  total += size;
  hash.update(rel).update('\0').update(await readFile(abs));
  urls.push('./' + rel);
}
// The SW template itself is part of the version too (strategy changes must roll caches).
// Strip injected values first so re-running this script is idempotent.
hash.update(template.replace(/\/\*__PP_(\w+?)__\*\/[\s\S]*?\/\*__PP_\1_END__\*\//g, ''));
const version = hash.digest('hex').slice(0, 12);

const replaceBetween = (src, start, end, value) => {
  const re = new RegExp(`/\\*${start}\\*/[\\s\\S]*?/\\*${end}\\*/`);
  if (!re.test(src)) throw new Error(`[build-sw] marker ${start} not found in ${swPath} (already injected?)`);
  return src.replace(re, `/*${start}*/ ${value} /*${end}*/`);
};

let out = replaceBetween(template, '__PP_VERSION__', '__PP_VERSION_END__', JSON.stringify(version));
out = replaceBetween(out, '__PP_PRECACHE__', '__PP_PRECACHE_END__', JSON.stringify(urls, null, 0));
await writeFile(swPath, out);

if (!urls.includes('./index.html')) console.warn('[build-sw] WARNING: index.html is not in the precache list');
if (skipped.length) console.warn(`[build-sw] skipped large files: ${skipped.join(', ')}`);
console.log(`[build-sw] ${swPath}: version ${version}, ${urls.length} URLs precached (${(total / 1024).toFixed(0)} KB)`);
