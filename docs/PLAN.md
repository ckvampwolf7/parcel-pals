# 택배친구 (Parcel Pals) — Product Plan

## 1. One-liner
A delivery tracker where a cute courier pal — **붕붕이** (truck), **슝슝이** (plane) or **토토** (bunny) — carries your parcel, shows you where it is on a little journey map, and tells you what's happening in plain, friendly words.

## 2. Problem → what the pal solves
| Pain (from research, see docs/research/) | How Parcel Pals answers it |
|---|---|
| "Where is it *really*?" Carrier timelines are walls of jargon (간선상차, 집화처리, Arrived at facility…) | The pal translates each checkpoint into one human sentence and shows its position on a stops-path (seller → hub → … → home) |
| Anxiety when nothing changes for a day, or on delay/exception | The pal's mood changes (sleeping overnight, worried on delay) and *explains* — "Hubs are closed on Sunday, I'll move again Monday morning" — plus what to do if it's a real problem |
| Many parcels from many carriers/apps | One list, carrier auto-detect from the tracking number, ranked candidates when ambiguous |
| Boring, utilitarian apps | Characters, celebrations on delivery, playful but calm motion; still fast and glanceable |

## 3. Audience
Korean online shoppers first (Korean UI default, English supported); domestic parcels (CJ대한통운, 한진, 롯데, 우체국, 로젠, 쿠팡) and cross-border (AliExpress/Cainiao, Temu, Amazon, UPS/FedEx/DHL/EMS).

## 4. MVP scope (this build)
Platform: mobile-first **PWA** (installable web app; React + TypeScript + Vite). Runs fully client-side; data in localStorage.

**Tracking data:** a deterministic **simulated carrier** (mock provider) so the whole experience works without API keys, with a provider interface ready for a real API later (Delivery Tracker / SweetTracker — see research). A **demo speed** control makes time pass faster (default 60× so a domestic parcel arrives in ~30 minutes of real time; fast-forward buttons for demos).

| # | Feature | Owner |
|---|---|---|
| F1 | Home: parcel cards (pal avatar with mood, nickname, status chip, progress bar, ETA, unread dot), sections Active / Delivered, empty state with demo CTA, pull-to-refresh-ish refresh button | UI |
| F2 | Add parcel: number input (paste-friendly, normalizes), live carrier detection with ranked candidates + manual pick, nickname, pal picker (auto = truck for domestic, plane for international), validation & friendly errors | UI + Engine |
| F3 | Parcel detail: **journey scene** — illustrated path with stops, pal riding along at real progress, mode changes (truck→plane→truck), day/night tint by local sim time; speech bubble; ETA card; checkpoint timeline in plain language with raw carrier text available; delivered celebration (confetti); actions: rename, change pal, archive, delete, open carrier page, share text | Journey |
| F4 | Updates: auto refresh (polling), diffing → new checkpoints → unread badges, in-app toast from the pal, inbox (notification feed), browser notifications when permitted | Engine + UI + PWA |
| F5 | Characters: 3 pals × 7 moods (idle, moving, waiting, sleeping, worried, happy, celebrating), SVG + CSS animation, consistent style, picker | Characters |
| F6 | Settings: language (ko/en), default pal, notifications, theme (system/light/dark), reduced motion, demo speed, load demo / reset data, about | UI |
| F7 | Onboarding: 3 short swipe cards introducing the pals; ends in "try a demo parcel" or "add my parcel" | UI |
| F8 | PWA: manifest, icons, offline app shell (service worker), installable; notifications | PWA/QA |
| F9 | Quality: unit tests (engine), e2e flows (Playwright), accessibility (axe), dark mode, 320–480px widths + desktop framing | PWA/QA + all |

**Non-goals for MVP:** accounts/sync, email import, real carrier API calls (interface only), native apps, maps with real geography.

## 5. Experience principles
1. **Glanceable first** — status + ETA readable in 1 second; the cuteness never hides the facts.
2. **The pal speaks human** — every update gets one short, warm sentence; carrier jargon stays available but secondary.
3. **Calm, not noisy** — motion is gentle; reduced-motion fully respected; notifications only for meaningful changes.
4. **Honest** — delays and problems are said plainly, with next steps.
5. **Accessible** — WCAG AA contrast, 44px targets, screen-reader labels for the scene (text equivalent of position), keyboard usable.

## 6. Architecture
```
src/types.ts            shared domain contract (lead)
src/engine/             carriers, detection, mock provider + simulation, speech, formatting (Engine)
src/store/              state, persistence, polling, diffing, events, hooks (Engine)
src/characters/         <Character kind mood/>, <CharacterPicker/> (Characters)
src/components/         design-system components + AppShell (tab bar, toasts) (UI)
src/screens/            Home, Add, Inbox, Settings, Onboarding, NotFound (UI) · ParcelScreen (Journey)
src/journey/            JourneyScene, Timeline, EtaCard, Celebration … (Journey)
src/pwa/                SW registration, browser notifications (PWA/QA)
src/i18n/               t()/useT(); namespaced dictionaries per team
public/                 manifest, sw.js, icons (PWA/QA)
e2e/                    Playwright tests (PWA/QA)
```
Data flow: provider.track(parcel, simNow) → TrackingSnapshot → store diffs checkpoints → unread/inbox/events → screens (hooks) & notifications (subscribe).

## 7. Milestones
1. Plan + research + scaffold with contracts and working stubs (lead) ✅
2. Parallel build by 5 teams against the contracts
3. Lead review & merge: typecheck, unit, e2e, a11y, visual review on mobile/desktop/dark/en; fix rounds
4. Final polish, docs, deliver

## 8. Later (post-MVP)
Real tracking API provider (server proxy for keys/CORS), push via Web Push, email/shopping-account import, widgets/Live Activities via native wrapper, more pals (seasonal skins), sharing a cute tracking card image.
