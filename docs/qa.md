# 택배친구 (Parcel Pals) — QA guide

Owner: PWA & QA team. Covers how to run every kind of test, what is covered, the manual checklist for things
automation can't reach (install, real notifications, screen readers), and known limitations.

## 1. Commands

| What | Command | Notes |
|---|---|---|
| Typecheck | `npm run typecheck` | strict TS, includes `e2e/` and `playwright.config.ts` |
| Unit tests | `npm test` (`npx vitest run src/pwa` for PWA only) | Vitest + jsdom, `src/**/*.test.ts(x)` |
| Production build | `npm run build` | must be `tsc -b && vite build && node scripts/build-sw.mjs` (see §3) |
| E2E (production build) | `npx playwright test` | builds (`vite build` + `build-sw`) and serves `vite preview` on **:4173** |
| E2E (dev server) | `PP_E2E_DEV=1 npx playwright test` | dev server on **:5178** (reused if running); `pwa.spec` is skipped |
| E2E (any server) | `PP_E2E_URL=http://127.0.0.1:4179/ npx playwright test` | no web server started |
| One file / project | `npx playwright test e2e/settings.spec.ts --project=mobile` | |
| Accessibility | `npx playwright test a11y` | axe-core, fails on serious/critical WCAG 2.x A/AA |
| Visual smoke | `npx playwright test visual-smoke` | screenshots → `test-results/screens/<project>/` (no pixel asserts) |
| Debug a failure | `npx playwright show-trace test-results/artifacts/<test>/trace.zip` | traces kept on failure |

The browser is the pre-installed Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(configured in `playwright.config.ts`); do **not** run `playwright install`.

Projects: **mobile** (Pixel-7-like, 390×844, `isMobile`, `hasTouch`) and **desktop** (1280×800). Locale `ko-KR`,
timezone `Asia/Seoul`. Service workers are **blocked** in all specs except `e2e/pwa.spec.ts` so tests are hermetic.

### How the tests find things
Only `data-testid`s from `docs/TEAM_BRIEF.md §4` and ARIA roles/names — never CSS classes. `window.__pp`
(dev server, or a production build opened with `?debug`) is used only for **setup** (reset state, skip onboarding,
load demo, add a parcel); the behaviour being tested is always driven through the real UI. Helpers live in
`e2e/fixtures.ts`; every test automatically fails on an uncaught page exception.

## 2. Test matrix

| Area | Spec | What is asserted |
|---|---|---|
| Onboarding | `onboarding.spec.ts` | first run shows `onboarding`; skip → `empty-state`, remembered after reload; next…→`onboarding-demo` loads ≥2 cards; `onboarding-add` → Add |
| Add parcel | `add-parcel.spec.ts` | UPS `1Z…` → `carrier-candidate[data-carrier-id=us.ups][aria-pressed=true]` → submit → detail with `journey-scene`, ≥1 `timeline-item`, `character`, `speech-bubble`, `status-chip`; spaces/dashes normalised; ambiguous 12-digit KR number → ≥2 candidates, exactly one pressed, re-selectable, `carrier-select` lists ≥5; invalid → `add-error`; duplicate → error or redirect, never 2 cards; tab bar hidden |
| Share target | `add-parcel.spec.ts` | `/?text=<KakaoTalk-style message>` → `#/add` with the UPS number extracted and detected |
| Home | `home.spec.ts` | empty → `load-demo-button` → cards with `data-parcel-id`/`data-status`; fast-forward → `unread-dot` on other cards; opening clears it; `refresh-all` |
| Detail | `parcel-detail.spec.ts` | scene/ETA/timeline/text equivalent; fast-forward → Delivered chip + `celebration` + progress 1 + home card `data-status=delivered`; rename, delete (+confirm), archive, change pal via `parcel-menu`; `carrier-link` opens https in a new tab; unknown id is friendly |
| Inbox | `inbox.spec.ts` | `inbox-empty`; updates → `inbox-badge` + unread `inbox-item`s; `mark-all-read` → all `data-read=true`, badge gone; item → its parcel |
| Settings | `settings.spec.ts` | English → `<html lang=en>` + tab names/heading in English (and back); theme dark/light/system → `data-theme` (+ `theme-color` meta); reduce motion on/off/system → `data-reduce-motion`; notifications switch toggles; demo speed + default pal; load demo → reset → empty state |
| Persistence | `persistence.spec.ts` | parcel + nickname, locale, theme, onboarded survive reload |
| Routing/shell | `routing.spec.ts` | 404 + way home; tab navigation + `aria-current`; `add-button`; `#/add?n=` prefill; no horizontal overflow |
| PWA | `pwa.spec.ts` (preview only) | manifest fields + relative URLs + shortcuts + share_target; all icons exist and are images; SW active, shell precached (index.html + hashed JS), **offline reload and offline deep link work**; `sw.js` has injected version/list; install & social meta |
| A11y | `a11y.spec.ts` | axe on home, add (with candidates), detail, inbox, settings × light/dark, onboarding, empty home, 404 |
| Visual | `visual-smoke.spec.ts` | 14 screens × ko-light / ko-dark / en-light × mobile/desktop to `test-results/screens/` |
| PWA logic | `src/pwa/pwa.test.ts` (Vitest) | quiet hours, meaningful-state filter, no notification when visible/quiet/denied/disabled, dedupe updated+delivered |

## 3. PWA implementation notes

- **Manifest** `public/manifest.webmanifest`: all URLs relative (`start_url ./#/`, `scope ./`) because
  `vite.config.ts` uses `base: './'` — the build works from any sub-path (verified at `/deep/app/`).
  Shortcuts: 택배 등록 → `./#/add`, 알림 → `./#/inbox`. **Web Share Target** (Android, installed app):
  `GET ./?title=&text=&url=` — main/App (lead) redirect `?text=` → `#/add?n=…`.
- **Service worker** `public/sw.js` is a template; `scripts/build-sw.mjs` (run after `vite build`) injects a
  content-hash `VERSION` and the precache list (everything in `dist/` except `sw.js`, fonts, `og-image.png`, maps).
  Fonts (~90 Pretendard subsets) are cached on first use instead. Strategies: navigation network-first
  (4 s timeout → cached `index.html`), hashed assets & fonts cache-first, other same-origin GETs
  stale-while-revalidate; non-GET and cross-origin requests are not touched. Old `pp-*` caches are deleted on
  activate. If `build-sw.mjs` was not run, the template still works (shell only).
- **Updates** (`src/pwa/register.ts`): a new SW waits; the app shows the toast "새 버전이 있어요 — 다시 열면 적용돼요";
  the next time the page is hidden it activates the new SW and reloads while hidden (no flash). Registered only
  in production builds and never on `file://`.
- **Notifications** (`src/pwa/notifications.ts`): browser notification only when the setting is on, permission is
  granted, the document is **hidden**, it's not **quiet hours (22:00–08:00 local)**, and the new checkpoint is
  **meaningful** (out for delivery, delivered, ready for pickup, failed attempt, exception, held in customs,
  carrier hand-off). Title = nickname, body = `checkpointLine`, tag per parcel, click → `#/p/<id>` (SW
  `notificationclick` focuses an open window or opens one). The inbox still records everything.
  App badge (`navigator.setAppBadge`) = unread inbox items (same number as the in-app `inbox-badge`); cleared
  when notifications are turned off.
- **Install helper** for the UI: `useInstallPrompt()` from `@/pwa` →
  `{ canInstall, promptInstall(): Promise<'accepted'|'dismissed'|'unavailable'>, isStandalone, isIOS }`.
  `beforeinstallprompt` is captured at module load. Recommended UI: if `canInstall` show a pal-led
  "홈 화면에 저를 데려가 주세요" button calling `promptInstall()`; if `isIOS && !isStandalone` show the manual
  hint "공유 버튼 → 홈 화면에 추가"; if `isStandalone` show nothing.

## 4. Manual QA checklist

Run on a real build served over HTTPS (or `localhost`): `npm run build && npx vite preview --host`.

**Install (Android, Chrome)**
- [ ] Install prompt / menu "앱 설치" appears; installed icon is the pal icon, maskable icon not cropped
- [ ] Launches standalone with cream splash (`#fff8f0`) and the name 택배친구
- [ ] Long-press icon shows shortcuts 택배 등록 / 알림, each opens the right screen
- [ ] Share a KakaoTalk/SMS message → 택배친구 appears in the share sheet → Add opens with the number filled

**Install (iOS Safari 16.4+)**
- [ ] 공유 → 홈 화면에 추가: icon (apple-touch-icon), title 택배친구, status bar readable in light & dark
- [ ] Opens standalone; safe areas (notch, home indicator) respected; tab bar not under the home indicator
- [ ] The app shows the manual install hint in Safari, and hides it once installed

**Offline**
- [ ] Open once online, then airplane mode → relaunch: app opens, parcels shown, no white screen
- [ ] Deep link `#/p/<id>` offline works; fonts render (after first online visit)
- [ ] Deploy a new build → app shows the "새 버전" toast once; switching away and back loads the new version

**Notifications**
- [ ] Settings → 알림 on asks for permission once; denying keeps the app working (no repeated prompts)
- [ ] With the app in the background, fast-forward a demo parcel to out-for-delivery/delivered → one notification
      per parcel (newer replaces older), title = nickname, body in the current language; plain hub scans don't notify
- [ ] Nothing pops while the app is visible (in-app toast instead); nothing between 22:00 and 08:00
- [ ] Tapping the notification focuses the app on that parcel (also when the app was closed)
- [ ] Installed app icon shows the unread count; it drops to zero after "모두 읽음" (Chrome/Edge, iOS 16.4+ installed)

**Dark mode / theme**
- [ ] System dark → app dark; Settings → 라이트/다크 overrides; status bar `theme-color` follows
- [ ] All screens legible in dark (cards, chips, journey scene, toasts, sheets)

**Reduced motion**
- [ ] OS "reduce motion" on → no bouncing/confetti/looping animation; Settings on/off overrides the OS
- [ ] Journey scene still shows position without animation

**Screen reader (TalkBack + VoiceOver)**
- [ ] Tab bar items have names; inbox badge read as a count ("알림 3개")
- [ ] Parcel card reads nickname, status, ETA, and unread state (not by color alone)
- [ ] Journey scene has a text equivalent ("서울 허브를 지나 동네 대리점으로 가는 중 · 60%")
- [ ] New updates announced politely once (no spam during auto-refresh); dialogs/sheets trap and return focus
- [ ] Every icon-only button has a label; focus ring visible with a keyboard (desktop)

**Layout**
- [ ] 320, 360, 390, 430 px wide and desktop (centered 480 px column): no horizontal scroll, no clipped text
- [ ] English strings (longer) don't overflow buttons or chips; 200 % text zoom still usable

## 5. Known limitations

- iOS: no `beforeinstallprompt` (manual install hint only); notifications/badges only for installed web apps on
  iOS 16.4+; no Web Share Target on iOS.
- Notifications are local (`showNotification` from the page while it's alive in the background). There is no
  server **Web Push**, so nothing arrives when the browser has fully killed the app — post-MVP.
- Quiet hours are fixed at 22:00–08:00 (no setting yet); skipped notifications are not queued for the morning.
- The precache skips fonts, so a first-ever offline launch before fonts were fetched uses the system font.
- `og:image` is relative (`./icons/og-image.png`); some crawlers need an absolute URL — set it at deploy time once
  the domain is known.
- Headless Chromium can't exercise real install prompts, OS notifications, background visibility or badges — those
  are covered by unit tests (`src/pwa/pwa.test.ts`) and the manual checklist above.
