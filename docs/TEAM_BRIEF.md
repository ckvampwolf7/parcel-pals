# 택배친구 (Parcel Pals) — Team Brief

Read this whole file, then `docs/PLAN.md`, then `docs/research/insights.md` (competitor research). Project root: `/home/user/parcel-pals`.
Stack: React 19 + TypeScript (strict) + Vite, Vitest (jsdom), Playwright. No CSS framework: plain CSS files with design tokens (`src/styles/tokens.css`). No new runtime dependencies without a strong reason (say so in your report). Path alias `@/` → `src/`.

## 1. How we work in parallel
Five teams build at the same time against **frozen contracts**. The lead has already written working **stubs** for every contract so the app runs end-to-end from minute one; you replace the stubs you own.

| Team | Owns (only write these) | Dev-server port |
|---|---|---|
| Characters | `src/characters/**`, `src/i18n/ns/characters.ts`, `public/icons/**` (app icon art), `docs/characters.md` | 5174 |
| Engine | `src/engine/**`, `src/store/**`, `src/i18n/ns/engine.ts`, `docs/engine.md` | 5175 |
| UI | `src/components/**`, `src/screens/{Home,AddParcel,Inbox,Settings,NotFound,Onboarding}Screen.tsx` + any new `src/screens/<name>/` files for those screens, `src/i18n/ns/ui.ts` | 5176 |
| Journey | `src/screens/ParcelScreen.tsx`, `src/journey/**`, `src/i18n/ns/journey.ts` | 5177 |
| PWA & QA | `src/pwa/**`, `public/**` except `public/icons/**`, `index.html` (head tags only), `e2e/**`, `playwright.config.ts`, `docs/qa.md` | 5178 |

**Lead-owned (do not edit):** `src/types.ts`, `src/App.tsx`, `src/main.tsx`, `src/router.ts`, `src/i18n/index.ts`, `src/i18n/useT.ts`, `src/i18n/ns/common.ts`, `src/styles/**`, `package.json`, configs, `docs/PLAN.md`, this file.
If you need a contract change (new optional field in `types.ts`, a new export from another team's module, a token), **don't edit their file**: work around it locally and list the request in your report.

**Contracts (frozen signatures; you may ADD exports, never rename/remove):**
- `src/types.ts` — domain types.
- `@/engine` (`src/engine/index.ts`) — carriers, detectCarriers, providers, sim clock, statusTone/statusLabel/moodFor, characterLine/checkpointLine, formatEta/formatRelative, demoParcelSeeds.
- `@/store` (`src/store/index.ts`) — `actions`, `subscribe`, `useParcels`, `useParcel`, `useSettings`, `useInbox`, `useSimNow`, `simNow`, `startStore`, `useReducedMotion`, `DEFAULT_SETTINGS`.
- `@/characters` (`src/characters/index.tsx`) — `Character`, `CharacterPicker`, `CHARACTER_META` (+ prop types).
- `@/components/ui` — `Button`, `IconButton`, `TopBar`, `StatusChip`, `ProgressBar`, `Sheet`; `@/components/Icon` — `Icon`; `@/components/toast` — `showToast`, `onToast`; `@/components/AppShell` — `AppShell`.
- `@/pwa` — `initPwa`, `initNotifications`, `requestNotificationPermission`.
- Screens: default-export React components with the props used in `src/App.tsx`.
- i18n: `t('<ns>.<key>')` / `useT()`; each team only adds keys to its own namespace file. Both `ko` and `en` for every key. Shared words are in `common` (read-only).

**Git:** do NOT run git commands that change state (add/commit/stash/checkout/reset/rebase). The lead commits. Read-only git (`git diff`, `git status`, `git log`) is fine.

**Dev server:** `npx vite --host 127.0.0.1 --port <your port> --strictPort` (run in background, kill it when done). Screenshots: `node scripts/shot.mjs http://127.0.0.1:<port> '#/route' <out.png> [--demo] [--ff <hours>] [--en] [--dark] [--w 390] [--full]` — loads demo parcels via the `window.__pp` debug handle (`window.__pp.actions`, `window.__pp.simNow`). Put screenshots in `/tmp/claude-0/<your-team>/`. Look at them with the Read tool — **you must visually check your work**, at 390px and 360px wide, light and dark, ko and en.

**Type/tests while others are mid-flight:** `npx tsc -b --pretty` may show errors in files owned by other teams — ignore those, fix every error in yours. `npx vitest run <your dir>`.

## 2. Product voice — the pals
All pal speech is first person, warm, short (max ~2 short sentences, ≤ 60 Korean chars), 해요체 in Korean, no more than one emoji per line, never cutesy to the point of hiding facts. Always truthful about delays and problems, with a next step when relevant.

| Pal | Kind | Personality | Signature sounds / habits |
|---|---|---|---|
| **붕붕이 / Vroomy** | truck (domestic default) | energetic, dependable big-sibling energy | "부릉부릉!", "Vroom!", talks about roads, hubs, fuel, being on time |
| **슝슝이 / Zoomy** | plane (international default) | dreamy, curious traveler | "슝~", "Whoosh~", clouds, airports, passports/customs, time zones |
| **토토 / Toto** | bunny courier (user's choice) | quick, cheerful, a little bit dramatic, tiny but mighty | "깡총!", "Hop hop!", carrots, short cuts, tiny backpack |

Example (in transit, night): 붕붕이 "밤에는 허브에서 잠깐 쉬어요. 내일 아침 일찍 다시 출발할게요! 🌙"

## 3. Visual language
- **Feel:** soft, rounded, toy-like; cream background, white cards, pastel accents, chunky pressable buttons (`--shadow-chunky`), generous spacing. Cute but clean — think a picture book with a well-organized app inside.
- **Type:** `--font-display` (Jua) for titles, big numbers (ETA), button labels and pal speech; `--font-body` (Pretendard) for everything else. Sizes from tokens (`--fs-*`).
- **Color:** use tokens only (`--c-*`). Status colors come from `statusTone(status)` → `--c-tone-<tone>`, `--c-tone-<tone>-soft`, `--c-tone-<tone>-ink` (ink is for text on soft). Pal colors `--c-char-truck|plane|bunny`. Must look right in dark mode (`:root[data-theme='dark']`).
- **Shape:** radii `--r-*` (cards `--r-lg`), spacing `--sp-*` (4px grid), touch targets ≥ 44px.
- **Motion:** gentle, springy (`--ease-bounce` for small pops, `--ease-out` otherwise). Respect reduced motion: global CSS already kills CSS animations when `data-reduce-motion='true'`; for JS-driven motion check `useReducedMotion()`.
- **Layout:** app column max 480px (`.app-frame`), designed for 360–430px phones; desktop shows a centered column. Bottom tab bar height `--tabbar-h` + safe area — screens must leave room for it (`padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--sp-4))`) except where the AppShell hides the bar (Add and Parcel-detail routes hide it).
- **Accessibility:** WCAG AA contrast; every icon-only control has a label; the journey scene has a text equivalent; focus visible; no information by color alone; dynamic updates announced politely (aria-live) without spamming.

## 4. Test-id contract (e2e tests rely on these — implement them exactly)
| Screen | data-testid |
|---|---|
| AppShell | `tab-home`, `tab-inbox`, `tab-settings` (bottom tab links), `inbox-badge` (unread count on inbox tab; absent when 0), `toast` (each toast) |
| Onboarding | `onboarding` (root), `onboarding-next`, `onboarding-skip`, `onboarding-demo` (finish + load demo), `onboarding-add` (finish + go to add) |
| Home | `home-list`, `parcel-card` (+ `data-parcel-id`, `data-status`), `unread-dot` (inside card when unread>0), `add-button`, `empty-state`, `load-demo-button`, `refresh-all` |
| Add | `tracking-input`, `carrier-candidate` (+ `data-carrier-id`, `aria-pressed`), `carrier-select` (manual `<select>` of all carriers), `nickname-input`, `character-option-<auto|truck|plane|bunny>` (from CharacterPicker), `submit-add`, `add-error`, `paste-button` |
| Parcel detail | `parcel-title`, `journey-scene` (+ `data-progress`), `character` (from Character), `speech-bubble`, `eta`, `status-chip` (from StatusChip), `timeline`, `timeline-item` (+ `data-status`), `fast-forward` (demo time control), `refresh-parcel`, `parcel-menu`, `rename-input`, `rename-save`, `change-character`, `archive-parcel`, `delete-parcel`, `confirm-delete`, `carrier-link`, `celebration` (visible only right after/when delivered) |
| Inbox | `inbox-item` (+ `data-read`), `mark-all-read`, `inbox-empty` |
| Settings | `setting-locale` (select or segmented with buttons `setting-locale-ko|en`), `setting-theme-<system|light|dark>`, `setting-notifications` (switch), `setting-reduce-motion-<system|on|off>`, `setting-demo-speed` (select), `setting-default-character` (CharacterPicker container), `load-demo`, `reset-data`, `confirm-reset` |

## 5. Definition of done (every team)
- Your files typecheck (strict) with zero errors; no `any` unless justified; no console errors/warnings at runtime from your code.
- ko + en strings for everything user-visible (no hard-coded UI text outside i18n except brand names/emoji).
- Works at 360px and 430px wide, light + dark, with reduced motion on.
- You visually reviewed your screens with screenshots and fixed what looked off (at least 2 review/fix rounds).
- Report back briefly: files, what works, contract-change requests, known issues.
