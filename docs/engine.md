# Engine & Store (택배친구)

Owner: Engine team. Code: `src/engine/**`, `src/store/**`, i18n `src/i18n/ns/engine.ts`.

```
src/engine/
  index.ts          public API (@/engine) — re-exports only
  carriers.ts       registry, normalize/validate, check digits, detectCarriers
  extract.ts        smart paste: extractFromText / extractShopHints
  calendar.ts       local-time helpers, Korean holidays, rest days
  prng.ts           hash + mulberry32 seeded PRNG streams
  places.ts         hubs, cities, airports, carrier vocabularies (bilingual data)
  simulator.ts      plan builder + snapshotAt (the mock carrier)
  providers/        TrackingProvider interface, mock (default), tracker.delivery skeleton
  statusText.ts     raw carrier wording → status / jargon term (taxonomy §3)
  status.ts         statusTone, statusLabel, moodFor, isMoving
  speech.ts         characterLine, checkpointLine, explainStatus, nextStepLine, describeProgress
  format.ts         formatEta (buckets), formatSnapshotEta, formatDateTime, formatRelative …
  demo.ts           demoParcelSeeds + demoCreatedAt (places demo parcels mid-story)
src/store/
  index.ts          public API (@/store): actions, hooks, polling, diffing, events
  persist.ts        localStorage (key `parcel-pals:v1`), versioned + sanitizing
  sort.ts           urgency ordering
```

Data flow: `provider.track(req, simNow)` → `TrackingSnapshot` → store diffs checkpoint ids → `unread` / inbox items
(text from `checkpointLine` in ko+en) / events (`parcel-updated` once per refresh with all new checkpoints,
`parcel-delivered` once per parcel) → hooks re-render.

## Time model

* **Simulation time** comes from a `SimClock` (`createSimClock`): `sim = anchorSim + (realNow − anchorReal) × speed`.
  Default `settings.demoSpeed = 60` (1 real minute = 1 sim hour, a domestic parcel arrives in ~20–40 real minutes).
  `actions.fastForward(h)` jumps; changing speed re-anchors without jumping. The clock state is persisted, so sim time
  keeps running while the app is closed (at 60× it drifts ahead of the wall clock — that's expected for the demo;
  use speed 1 for "real" time).
* `parcel.createdAt` is stamped with **sim** time when added (the mock anchors its plan to it).
* **Time zone decision:** sim times are interpreted in the user's **local** time zone (Date local getters), so
  "pickups late afternoon" and "out for delivery 7–10시" are on the user's own clock. Korean users are on KST anyway.
  Tests build dates with local `new Date(y, m, d, h)` and pass under UTC, Asia/Seoul, America/Los_Angeles and
  Pacific/Kiritimati.

## Simulation model (`simulator.ts`)

`planFor({trackingNumber, carrierId, createdAt})` is pure and cached. Seeds: scenario flags from
`hash(number|carrier)` (so a number always tells the same story); each timing step uses its own PRNG stream
(`number|carrier|<step>`) so injecting a delay only shifts later steps.

**Scheduling.** Departures/scans happen inside daily windows (`slot(earliest, h0, h1, rng, rest)`); arrivals are
departure + travel time. With `rest`, windows on Sundays and Korean public holidays (2025–2028 hard-coded, incl.
lunar + substitute days) are skipped — the pal sleeps.

**Domestic** (stops: 판매자 · {area} → seller-side branch → mega hub → local depot (마포) → 우리 집):
상품접수 (+5–30 min) → 집화처리 15:00–19:30 → 간선상차 18:30–22:30 → 간선하차 at the mega hub (+1.5–3.5 h, overnight)
→ 간선상차 01:00–05:00 (30% of numbers miss the night's connection and wait a day at the hub) → 배송지 도착
→ 배송출발 07:00–10:00 → 배송완료 09:00–19:30 with "문 앞/경비실/무인택배함/직접 전달". Wording varies per carrier
family (CJ 집화처리/간선상차, 한진 입고/이동중, 롯데 상품 집하, 우체국 접수/발송/배달준비, 로젠 터미널입고 …).
Coupang (로켓배송) is its own 3-stop flow: 물류센터 출고 evening → 캠프 도착 → 새벽 배송, 7 days a week.

**International** (stops: origin city → departure airport/port → 인천공항/평택항 → 세관 → domestic hub → local depot →
home): 주문 정보 접수 → 현지 물류센터 입고 → 수출 통관·출고 → 항공사 인계 → 항공기 출발 (plane leg, flight time by
origin) → 인천공항 도착 → 반입신고 → 수입신고 → 수입신고수리 (Korean working days) → **handoff**: 국내 택배사 인계
(Cainiao → CJ 75%/한진/롯데/우체국; YunExpress/4PX/SF → 한진/CJ/롯데; Amazon → CJ/한진) with a NEW deterministic
domestic number (`snapshot.handoff`); postal S10 items go to 우체국 with the same number; UPS/FedEx/DHL deliver
themselves → then the domestic last mile. ~25% of Cainiao/YunExpress/4PX parcels go by sea (웨이하이→평택, 칭다오→인천,
`currentMode: 'ship'`). Typical total 5–10 days.

**Scenarios** (per number): ~1/6 **delay** (`weather`, `hub_congestion`, `customs_inspection` for international):
the plan is built twice (base + delayed); a `delay` checkpoint is inserted when the step should have happened, after
which `snapshot.delayed = true`, `delayReason` is set and the ETA comes from the delayed plan (it slips). ~1/12
**attempt_fail** (미배송 고객 부재) then redelivery next working day. ~1/20 **pickup** (`available_for_pickup` at
GS25/무인택배함/우체국, `snapshot.pickup`), collected 3–26 h later; `kr.cvsnet` always ends at a store, 경동/대신 often
at a branch.

**Snapshot at `now`:** checkpoints with `time ≤ now` (ids `<slug>-<seq>-<code>[~detail]`, stable; the code tells
speech what happened — `checkpointCode(id)`), `status` = last checkpoint's (or `pending` before the first scan,
5–30 sim minutes after adding). `progress` is interpolated continuously along movement *segments* (stop positions
are evenly spaced: stop i = i/(n−1)), never decreases, and sits still at stops (no fake motion). A failed attempt
moves the pal 70% of the way home and finishes on redelivery. `currentMode` = the moving segment's mode, else the
current stop's `modeToNext` (truck after handoff, bike for the last mile). `eta` = window around the next terminal
event, narrowing by stage (domestic ~30 h → OFD ~2.5 h; international ~4 days → customs ~2 days). `stale` = no scan
for > 24 working hours in transit (Sundays don't count), > 48 h after label, > 72 h in customs.

## Carriers & detection

`detectCarriers(input)` normalizes (NFKC full-width → ASCII, uppercase, strips separators, pulls a number out of pasted
text) and returns ranked `{carrier, confidence}`:
strong formats → one match (UPS `1Z` with check digit 0.99/0.75; S10 with check digit, routed by country suffix: KR →
우체국 EMS/국제, CN → China Post/EMS, US → USPS; `LP…` Cainiao; `YT…`; `4PX…CN`; `SF…`; `TBA…`; USPS IMpb); plain
digits → several candidates by length (12 → CJ/Lotte boosted by the reported mod‑7 check digit, Hanjin, FedEx …;
11 → Logen; 13 → Korea Post; 10 → CJ/Hanjin/DHL). Nothing is ever certain for plain digits (top < 0.7).

`extractFromText(text)` (smart paste) scans every token, ignores phone numbers/dates, boosts numbers near labels
(운송장/송장/tracking) and near carrier names (CJ대한통운, 한진, UPS …), penalizes 주문번호/order, and applies shop
priors (Temu → 한진, AliExpress → CJ). Returns `[{trackingNumber, carrierId?, confidence}]`, best first.
`extractShopHints(text)` → `{shop?, itemName?}`.

### Adding a carrier
1. Add a `Carrier` to `CARRIERS` (`carriers.ts`) with `trackingUrl` template (`{number}`) and `color`.
2. Add its format to `detectRaw` (regex + confidence; a check digit if one is well defined).
3. Map it to a family in `places.ts` (`FAMILY`) for wording/facility names, or let it fall back
   (domestic → CJ-style, international → postal-style). International: add `HANDOFF_PARTNERS` / origin country.
4. Add keywords to `CARRIER_KEYWORDS` in `extract.ts`.
5. Add a detection test (`carriers.test.ts` checks every example in `docs/research/carrier-formats.json`).

## Plugging in a real API

`TrackingProvider { id; track(req, now): Promise<TrackingSnapshot> }`. `getProvider()` returns the mock by default;
`setProvider(p)` swaps it (e.g. from an env flag in `main.tsx`). A skeleton for Delivery Tracker
(`providers/trackerDelivery.ts`) posts the GraphQL `track` query to **your proxy** (never call vendor APIs with a
secret from the browser) and maps events with `mapTdStatus` + `statusFromCarrierText` (taxonomy rules) into a
4-stop snapshot (no interpolation — real data can't know future times). Mapping is pure
(`mapTrackerDeliveryResponse`) so it can be unit-tested without network. Real checkpoints have no simulator code; speech
then falls back to classifying the carrier text (`checkpointKind`) and the status.

## Speech (`speech.ts`, `i18n/ns/engine.ts`)

All text is i18n (`engine.*`, ko + en, same keys and placeholders — enforced by tests). Arrays in the namespace file
become numbered variants; the variant is chosen by `hash(last checkpoint id | situation)` so lines don't flicker.

* `speechSituation(parcel, now?)` → pending · infoReceived · pickedUp · moving · atHub · night · restDay · flying ·
  sailing · landed · customs · customsCleared · handoff · nearby · outForDelivery · attemptFail · pickupReady ·
  delivered · delayed · stale · exception · expired.
* `characterLine(parcel, locale, now?)` — `engine.say.<pal>.<situation>.<n>`, first person, ≤ ~60 Korean chars,
  params `{name}` (nickname; number-like nicknames become "택배"/"your parcel"), `{place}`, `{next}`, `{carrier}`,
  `{partner}`, `{newNumber}`, `{reason}`, `{where}`, `{day}`, `{pickupPlace}`, `{hours}`. Placeholders never sit
  before a Korean particle (이/가, 을/를, 로) — write `{next} 쪽으로`, `{next}까지`.
* `checkpointLine(parcel, cp, locale)` — inbox/toast/notification line (`engine.cp.<pal>.<kind>`).
* `explainStatus(cp, locale)` — jargon → plain sentence (`engine.explain.*`), works for raw carrier text too.
* `nextStepLine(parcel, locale, now?)` — what usually happens next / what to do; `null` once delivered.
* `describeProgress(parcel, locale)` — screen-reader text ("슝슝이가 인천공항세관에서 통관 중이에요. 전체 여정의 70%예요.").
* `moodFor(snapshot, now?)` — delivered → celebrating; attempt_fail/exception → worried; delayed → worried; OFD/pickup →
  happy; moving → moving; not moving at night / on a Korean rest day / stale → sleeping; customs/label → waiting;
  else idle. `now` defaults to `snapshot.updatedAt`.

## Formatting (`format.ts`)

`formatEta(eta, locale, now)` → honest day buckets: 오늘 / 내일 / 오늘~내일 / 내일~모레 / "10월 19일(월)" / "2–4일 후"
/ "3일 안에"; a time window ("오늘 오후 2–4시") only when the window is ≤ 5 h (i.e. out for delivery); a delivered
ETA (`earliest === latest`, `confidence: 1`, past) → "10월 15일(목) 배송 완료". Prefer
`formatSnapshotEta(snapshot, locale, now)` in UI: it also handles pending / pickup-ready / delivered / exception.
`formatDateTime` ("10월 16일(금) 오후 2:05" / "Fri, Oct 16, 2:05 PM"), `formatDate`, `formatTime`,
`formatRelative` (past and future).

## Store (`@/store`)

* **Persistence:** `localStorage['parcel-pals:v1'] = {version: 1, parcels, settings, inbox (≤ 200), clock}`, written
  250 ms after changes and on `pagehide`/tab hidden (`persistNow()`). On load every field is sanitized; unparseable
  JSON or a newer `version` resets to defaults (and removes the key). `refreshing` is never persisted.
* **Polling:** `startStore()` refreshes immediately, then every `settings.refreshIntervalSec` while the tab is visible;
  pauses when hidden; refreshes on `visibilitychange`/`focus`. Returns `stop()`.
* **Refresh safety:** one refresh per parcel at a time (a call during a refresh schedules one follow-up run);
  `refreshAll` is sequential and concurrent calls coalesce into one extra pass. `parcel.refreshing` while in flight;
  provider errors set `parcel.error = 'engine.error.refresh'` and emit `{type:'error'}`.
* **Diffing:** a parcel's first snapshot is a baseline (no unread/inbox/events). Later, new checkpoint ids →
  `unread += n`, inbox items `id = <parcelId>:<checkpointId>` (de-duplicated, newest first, cap 200), one
  `parcel-updated` event with all new checkpoints, and `parcel-delivered` once per parcel. Events are emitted
  regardless of `settings.notifications` — consumers decide whether to show them.
* **Duplicates:** `actions.addParcel` with an already-tracked number (after normalization) returns the existing parcel
  (un-archiving it) instead of creating one. UI can check first with `findByTrackingNumber(input)` and say
  `t('engine.error.duplicate')`.
* **Invalid input:** `addParcel` throws `InvalidTrackingNumberError` (`.reason` ∈ empty/too_short/too_long/invalid_chars,
  message = i18n key). Validate first with `validateTrackingNumber` + `validationMessage(reason, locale)`.
* **Order (`useParcels`)**: out for delivery > exception/attempt failed > ready for pickup > in transit/customs/label
  (nearest ETA first) > expired > pending > delivered (most recent first); archived last (only with
  `includeArchived`). The returned array is memoized (same reference until parcels change).
* `loadDemo()` adds the 4 `demoParcelSeeds` (skips ones already present); `demoCreatedAt` searches a createdAt so
  each lands on its story beat for the current time of day (truck at a hub/on the road, plane in the air or customs,
  bunny out for delivery, one delivered to 경비실). Each non-delivered demo parcel gets one unread inbox item.
* `updateSettings`: locale → `setCurrentLocale` (also `<html lang>`); `demoSpeed` → clock re-anchors (invalid ignored);
  `refreshIntervalSec` → reschedules polling. `resetAll()` clears storage, clock, settings and data.
