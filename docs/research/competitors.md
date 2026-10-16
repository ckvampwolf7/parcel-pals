# Competitive research: package tracking (Parcel Pals)

_Researched 2026-10-16. Method: web search across app-store listings, help centers, press, Korean communities (Clien, blogs, news) and vendor docs. Limitation: page fetching was unavailable in the research sandbox, so facts come from search-result extracts. Items marked **(unverified)** come from one non-official source or from prior general knowledge and should be confirmed before we rely on them in marketing or engineering._

Legend: ✅ yes · ❌ no · ◐ partial/limited/paid · ? not confirmed

## 1. Feature matrix: consumer trackers

| App | Platforms | Carriers | Auto-detect carrier | Push | Email / account import | Map | ETA | Widgets | Live Activities / Dynamic Island | Sharing | Tone | Monetization |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **AfterShip (consumer app)** | iOS, Android, web | 1,100+ (help center, Dec 2025) | ✅ | ✅ (10 key events) | ✅ Gmail/Outlook email sync; can pull numbers from installed retailer apps | ◐ | ✅ shows EDD | ? | ? (none found) | ? | Neutral, utilitarian | Free, ad-free; money comes from merchant SaaS |
| **17TRACK** | iOS, Android, web | 2,500+ (store listing; other sources say 900–3,000) | ✅ | ✅ | ◐ (account sync between devices; no confirmed email import) | ❌ | ◐ | ✅ | ? | ? | Dense, data-heavy, "power user" | Free with ads + in-app purchase; merchant API/Shopify plans |
| **Parcel** (iOS) | iOS, Mac, Watch, web | 300+ | ✅ | ◐ Premium only | ✅ Amazon account integration (on-device login); email forwarding **(unverified)** | ✅ | ✅ | ✅ | ? (not confirmed) | ✅ share extension | Clean, compact, Apple-native | Freemium: 3 deliveries free, Premium ≈ US$4.99/yr (£6.49, ¥599) |
| **Deliveries** (Junecloud) | iOS, iPad, Watch, Mac | "dozens" + manual custom carriers | ◐ | ✅ | ✅ forward emails (with Junecloud sync) | ✅ per package | ✅ countdown; add ETA to calendar | ✅ | ? | ✅ | Friendly-Mac-indie | Subscription since 2020 (≈ $0.99/mo or $4.99/yr at launch); lapsed users keep read access |
| **ParcelTrack** | iOS, Android | 50+ (EU-focused: DHL, DPD, GLS, Hermes, Royal Mail…) | ✅ | ✅ free | ✅ forwarding inbox (free) | ◐ Premium "live GPS van" | ◐ DHL/DPD/FedEx/UPS only | ? | ? | ◐ "who has my package" (neighbour) | Practical, European | One-off Premium IAP (≈ US$2.99) |
| **Shop** (Shopify; formerly **Arrive**, 2017→2020) | iOS, Android | Broad (Shopify network + email) | ✅ | ✅ | ✅ Gmail/Outlook scan (last 30 days), Shop Pay orders, forward-to address (English emails only) | ✅ approximate location map | ✅ | ? | ? | ? | Polished, commerce-first | Free; monetized through Shop Pay, product feed and merchant fees |
| **Route** | iOS, Android, web | Broad | ✅ | ✅ | ✅ order import from Route merchants + email | ◐ | ◐ | ? | ? | ? | Insurance/brand-y | Free to shoppers; revenue from shipping protection (≈ 2–2.5% of cart, paid by the shopper) |
| **Apple Wallet order tracking** (platform threat) | iOS | Merchant/carrier-supplied | n/a | ✅ | ✅ Apple Pay orders; **iOS 26: extracts orders from Mail with Apple Intelligence (beta)** | ? | ✅ | ✅ (system) | ✅ (system) | ? | System UI | Free |
| **스마트택배** (Smart Taekbae; SweetTracker heritage, App Store developer now "Blumn AI corp.") | iOS, Android | Most KR + intl | ✅ | ✅ | ✅ auto-collects shopping-mall order history | ? | ? | ? | ? | ? | Cluttered, ad-heavy (per users) | Ads + paid ad-removal (1-year, not permanent per users); shipping booking (Hanjin, CU) |
| **배송지키미** (Delivery Keeper) | iOS, Android | 40+ | ✅ | ✅ | ✅ **phone-number-based auto-registration** (CJ auto-linked); reads SMS/Kakao messages **(blog claim)** | ? | ? | ? | ? | ? | Simple, focused, "no unnecessary ads" | Free / light ads |
| **택배파인더** (Taekbae Finder) | iOS | "500+" | ✅ (barcode scanner) | ✅ | ❌ | ? | ? | ? | ? | ? | Generic | **Weekly auto-renewing subscription** needed for full access (users complain) |
| **네이버 택배조회** (Naver search widget + Naver Pay orders) | Web/app (Naver) | Major KR carriers | ◐ (pick carrier + number in the search widget) **(unverified)** | ✅ for Naver Pay orders | ✅ automatic for Naver Pay / Smart Store orders | ❌ | ◐ | ❌ | ❌ | ❌ | Neutral portal | Free (commerce ecosystem) |
| **카카오 (카카오톡 알림톡 / 편의점택배 예약)** | KakaoTalk, Kakao Map | Messages come from carriers/sellers | n/a | ✅ via 알림톡 (business messages, no friend-add needed) | ✅ implicit (sender pushes) | ❌ | ◐ CJ "배송출발/완료" alerts | ❌ | ❌ | ✅ (chat-native) | Messenger-native | Paid by businesses (알림톡 fees) |
| **쿠팡 (Coupang) in-app tracking** | Coupang app | Coupang CLS + partner carriers | n/a | ✅ | ✅ (own orders only) | ◐ "current location" | ✅ time window ("몇 시까지") | ? | ? | ❌ | Efficient, reassuring | Part of Rocket/WOW ecosystem |
| **우체국 앱 / 우체국택배 앱** | iOS, Android | Korea Post (parcel, registered, EMS) | n/a | ✅ | ✅ "나의 등기번호 찾기", 배송지키미 feature built in | ❌ | ◐ | ? | ? | ? | Government/utility | Free |
| **CJ대한통운 앱 "오네"** | iOS, Android | CJ auto; others manual | n/a | ✅ | ✅ CJ parcels auto-registered by phone number | ◐ map of the vehicle's route **(blog claim, unverified)** | ✅ ETA push **(blog claim)** | ? | ? | ? | Corporate | Free; drives pickup bookings |

### B2B / branded tracking pages (what shoppers see when they click "track")
| Product | What it does | Notable |
|---|---|---|
| **AfterShip Tracking (branded pages)** | Merchant-branded tracking pages, email/SMS notifications, EDD | API and webhooks only on Pro (≈ $119/mo on Shopify); Essentials ≈ $11/mo for 100 shipments |
| **Narvar** | Enterprise branded tracking, notifications, returns | Claims 95%+ accurate ML-predicted delivery dates; "Powered by Narvar" branding; 6–8 week implementations (3rd-party) |
| **Route** | Branded tracking + shipping protection | See above |

## 2. Per-competitor notes

### AfterShip (consumer app + branded pages)
- **Strengths:** broadest well-known free app; ad-free; Gmail/Outlook sync; notifications for 10 key events; "auto-retrieve tracking numbers from installed retailer apps"; strong status taxonomy (the 9 tags + subtags we're mapping to).
- **Complaints (mostly from merchants on Shopify/G2):** status mapping errors, e.g. ready-for-pickup shown as "in transit" ([Shopify review](https://apps.shopify.com/reviews/38692)); carrier gaps (Royal Mail stopped tracking); slow, copy-paste support; crowded, dated UI; premium gating (custom domains).
- **Takeaway:** status mapping accuracy is a known weak point even for the leader. Our "AvailableForPickup" handling for Korean convenience-store and branch pickups has to be right.
- Sources: [AfterShip help: mobile app](https://support.aftership.com/en/articles/15441927-introduction-to-aftership-mobile-app) · [Delivery statuses](https://www.aftership.com/docs/tracking/enum/delivery-statuses) · [Capterra](https://capterra.com/p/178663/AfterShip/reviews/?page=8) · [G2](https://www.g2.com/survey_responses/aftership-review-12725506) · [Channelwill blog](https://channelwill.com/blogs/aftership-tracking)

### 17TRACK
- **Strengths:** largest carrier list (2,500+); best for China-origin cross-border (Cainiao, YunExpress, China Post); batch tracking; barcode/QR scan; widget; device sync with account; translation of foreign-language checkpoints (general knowledge, widely used for this).
- **Complaints:** last-mile updates inaccurate or missing in the merchant product (one merchant: ~¾ of final-mile updates wrong or missing); duplicate notifications; billing/refund disputes; scripted support. The consumer UI is dense and ad-supported.
- **API:** quota model. Free 50–100 trackings/mo (sources conflict); Basic ≈ $119/yr for 5,000.
- Sources: [AfterShip on 17TRACK](https://ecommerce.aftership.com/insight/everything-you-need-to-know-about-17track/) · [Android Authority](https://www.androidauthority.com/best-package-tracking-apps-3263711/) · [Shopify reviews](https://apps.shopify.com/reviews/2024298) · [Track123 comparison](https://www.track123.com/blog/track123-vs-17track)

### Parcel (iOS)
- **Strengths:** compact, beloved design; Amazon account integration ("worth the subscription alone"); widgets; web access; very cheap Premium.
- **Weaknesses:** free tier capped at 3 deliveries with no push; iOS-only; manual entry pain (users asked for email auto-entry).
- Sources: [App Store listing](https://apps.apple.com/us/app/-/id375589283) · [Syntopikon review](https://syntopikon.substack.com/p/parcel-the-best-package-tracker-on) · [AppleVis](https://www.applevis.com/comment/66350)

### Deliveries (Junecloud)
- **Strengths:** countdown summary, map per package, calendar ETA, Watch app, email forwarding and web editing via Junecloud sync, archive history.
- **Controversy:** moved from paid-up-front to subscription in 2020, which drew backlash ([Michael Tsai](https://mjtsai.com/blog/2020/10/15/deliveries-switches-to-subscription)); the grace policy lets lapsed users keep read access and export.
- Sources: [Junecloud subscriptions](https://junecloud.com/support/deliveries-ios/subscriptions.html) · [9to5Mac](https://9to5mac.com/2020/09/30/deliveries-package-tracker-app-iphone/)

### ParcelTrack
- **Strengths:** free push, free email-forwarding inbox, carrier delivery forecasts, "who has my package" (neighbour) and live van GPS (Premium, one-off price).
- **Complaints:** email parsing degraded (reportedly "only DHL recognised"), unresponsive support; at one point the app was reported "completely non-functional" while still selling IAP ([iphone-ticker.de](https://www.iphone-ticker.de/paket-tracking-app-parceltrack-komplett-funktionslos-223082/)).
- Sources: [App Store](https://apps.apple.com/app/id840216376) · [appgefahren](https://www.appgefahren.de/parceltrack-app-zur-sendungsverfolgung-bekommt-neue-extras-269318.html)

### Shop (Shopify), formerly Arrive
- Arrive (2017) scanned Gmail automatically and was rebranded into Shop in 2020, which added a product feed and Shop Pay.
- **Strengths:** zero-effort import (inbox scan, last 30 days), map with approximate location, carrier link.
- **Limits:** can't parse every non-Shopify email; forward-to-import works only for English emails, which matters for Korean shopping emails.
- Sources: [Shop help: email sources](https://help.shop.app/en/shop/account-setup/connect-email-order-source) · [TechCrunch](https://techcrunch.com/2020/04/28/shopify-launches-shop-a-new-mobile-shopping-app/amp) · [MobileSyrup on Arrive](https://mobilesyrup.com/2019/11/03/arrive-tracking-packages/) · [Appfigures](https://appfigures.com/resources/insights/shopifys-strategic-switchup)

### Route
- A consumer tracking app bundled with **shipping protection** sold at checkout (≈ 2–2.5% of cart).
- **Complaints:** claim denials, customers not realising they bought protection, strict filing windows (15 days for delivered-not-received; 30 days from the last update for lost parcels). Shopify rating ≈ 3.3–3.6.
- **Takeaway:** "insurance as monetization" damages trust; avoid it.
- Sources: [Shopify listing](https://apps.shopify.com/route) · [Shopify reviews](https://apps.shopify.com/reviews/743653) · [ATTN Agency review](https://www.attnagency.com/blog/route-shopify-review)

### Narvar (branded tracking)
- Enterprise "post-purchase" platform: ML EDD (claims 95%+), branded pages, notifications; claims 3× tracking-page engagement per order.
- **Takeaway:** the industry treats the predicted delivery date as the hero element. We should too, with honest confidence ranges.
- Sources: [Narvar delivery](https://corp.narvar.com/solutions/delivery) · [Outvio overview](https://outvio.com/blog/narvar-tracking-feature-overview/) · [AfterShip vs Narvar](https://www.aftership.com/blog/aftership-vs-narvar-tracking)

### Apple Wallet order tracking (platform threat)
- Apple Pay orders auto-tracked since iOS 16. **iOS 26 adds Mail-based extraction with Apple Intelligence (beta)**, covering emails from sellers, marketplaces and couriers.
- **Takeaway:** "generic tracking list" is being commoditized by the OS. Our differentiation must come from Korean carrier depth, cross-border handoff, plain-language explanation and the character, not from list management.
- Sources: [Apple support](https://support.apple.com/en-in/105065) · [iGeeksBlog](https://www.igeeksblog.com/how-to-track-orders-in-wallet-app-on-iphone)

### 스마트택배 (Smart Taekbae)
- The incumbent Korean tracker (SweetTracker heritage; the App Store developer is now listed as Blumn AI corp.). It auto-collects shopping-mall orders, sends push alerts on status change, and adds a "shopping diary", dashboards and Hanjin/CU booking.
- **Complaints (Clien and App Store):** "광고 투성이" (wall-to-wall ads); paid ad-removal is a 1-year pass, not permanent; "어플이 너무 버벅임" (laggy); users left for 배송지키미 because "광고 너무 심해져서". There was also a past Play Store block episode ([thdev.net](https://thdev.net/546)).
- Sources: [App Store](https://apps.apple.com/kr/app/id523045854) · [Clien: "스마트택배 어플 최악으로 변했네요"](https://www.clien.net/service/board/park/18045141) · [Clien: 택배앱 추천](https://www.clien.net/service/board/cm_iphonien/14585183) · [AppStory comparison](https://news.appstory.co.kr/battle11054)

### 배송지키미 (Delivery Keeper)
- **The killer feature is tracking by phone number**: no invoice number needed, CJ parcels auto-link, and it reportedly ingests SMS/Kakao delivery messages. It shows a **unified 5-stage progress** across carriers and positions itself as "no unnecessary ads". It is the most-recommended alternative in Korean communities.
- Sources: [App Store](https://apps.apple.com/kr/app/id888577076) · [extrememanual guide](https://extrememanual.net/33234) · [AppStory](https://news.appstory.co.kr/battle11054)

### 택배파인더 (Taekbae Finder)
- Claims 500+ carriers; barcode scanner; filters. **Weekly auto-renewing subscription** is required for full access, and reviewers complain about it.
- Source: [App Store](https://apps.apple.com/KR/app/id1470049099)

### 네이버 택배조회 / Naver Pay
- A search-integrated tracking widget, plus automatic tracking and notifications for Naver Pay / Smart Store orders. Search results did not document Naver's auto-detect behaviour **(unverified)**.
- **Takeaway:** for Naver-ecosystem orders users already get tracking. We win on the *other* orders (overseas direct purchase (직구), Coupang Marketplace, independent shops) and on aggregation.

### 카카오 (KakaoTalk 알림톡, 편의점택배 예약)
- Carriers and sellers push delivery updates through 알림톡 (business messages, no friend-add needed). Since Aug 2025, KakaoTalk 예약하기 and Kakao Map can book GS25/CU/7-Eleven/emart24 convenience-store parcels, and both sender and receiver get real-time 알림톡 status. Some guides also mention CJ "출발/완료" alerts via KakaoTalk 주문조회.
- **Takeaway:** most Korean users *already* get a 알림톡 containing their tracking number. **Paste/share-to-app from KakaoTalk is our cheapest "email import" equivalent.**
- Sources: [Byline Network](https://byline.network/2025/08/11_kakao/) · [Kakao 알림톡 launch](https://www.kakaocorp.com/page/detail/7827)

### 쿠팡 (Coupang) tracking
- Rocket Delivery uses its own logistics (CLS). The app shows current location, a "몇 시까지" time window and the tracking number (sometimes hidden). Delivery-proof photos are standard, though a news story covered staged or edited proof photos ([Wikitree](https://www.wikitree.co.kr/articles/341045)). Non-Rocket orders use CJ/Hanjin/Lotte/Korea Post.
- **Takeaway:** Coupang sets the Korean bar for reassurance (time window + photo). We can't get the photo via public APIs; don't promise it.
- Sources: [Coupang Newsroom FAQ](https://news.coupang.com/archives/61375/) · [funissu guide](https://funissu.com/coupang-delivery-tracking/) · [Clien: external Rocket lookup](https://www.clien.net/service/board/park/17515746)

### 우체국 (Korea Post) and CJ대한통운 "오네"
- Korea Post app: parcel, registered mail and EMS tracking, history, "나의 등기번호 찾기". The 우체국택배 app includes 배송지키미-style lookup. The mascot is reportedly **제제 (a swallow)**, linked to the red swallow logo (Namuwiki, unverified).
- CJ 오네 (O-NE): auto-registers CJ parcels by phone number; other carriers manual; blog claims of a live vehicle map and ETA push. App Store reviews complain lookups fail or screens don't transition.
- Sources: [우체국 앱](https://apps.apple.com/KR/app/id435940000) · [CJ 오네](https://apps.apple.com/kr/app/cj%EB%8C%80%ED%95%9C%ED%86%B5%EC%9A%B4/id889796593) · [brunch on CJ](https://brunch.co.kr/@feel2174/35) · [Namuwiki mascots](https://namu.wiki/w/%EB%A7%88%EC%8A%A4%EC%BD%94%ED%8A%B8/%EC%A0%95%EB%B6%80%EA%B8%B0%EA%B4%80%20%EB%B0%8F%20%EA%B3%B5%EA%B8%B0%EC%97%85)

## 3. Character, playful and gamified delivery UX (inspiration)

| Example | What they do | Lesson for us |
|---|---|---|
| **Domino's Pizza Tracker** (2008) | Built because customers were anxious with no visibility; stage-by-stage animation, later a live driver map | The "labor illusion": visible progress makes waiting feel better and builds trust. **But** NPR (2026) documents trackers that were deliberately slowed or faked. Never fake progress. ([NPR](https://www.npr.org/2026/09/18/nx-s1-5896338/how-a-pizza-app-changed-our-relationship-with-waiting), [Entrepreneur](https://www.entrepreneur.com/buying-a-franchise/how-dominos-20-year-old-pizza-tracker-shaped-nearly-every-delivery-app-you-use-today)) |
| **Uber Eats** | Live Activities on the Lock Screen / Dynamic Island since 2023 (status, ETA, driver photo) | Glanceable status is now table stakes in native apps. A PWA can't do this, so compensate with web push + home-screen install. ([MacRumors](https://macrumors.com/2023/05/02/uber-eats-live-activities)) |
| **배달의민족 (Baemin)** | Real-time rider location; in 2026 extended to "가게배달" orders via 6 delivery-agency integrations (~70% coverage) | Korean users now *expect* a moving dot. For parcels we only have checkpoints, so the character "moving along a route" is our honest version. ([Daum/news](https://v.daum.net/v/20260727162246267)) |
| **Coupang Eats** (2019) | Live map vs Baemin's then text-only tracker; praised as "UX king" | A map beats text for reassurance. ([Byline](https://byline.network/2019/08/01-15/)) |
| **Zomato** | Humorous loading copy ("finding the fastest chef"); pushes that tell you to *stop* staring at the map | A personality voice can lower anxiety *and* reduce compulsive checking. ([guide](https://blakecrosley.com/ko/guides/design/zomato)) |
| **Yamato Transport (クロネコ)** | The black-cat logo is so iconic the company is called "Kuroneko"; delivery-time and missed-delivery notices via the official LINE account | Pairing a mascot with messenger-native notifications works. The Korean equivalent is KakaoTalk. ([kiji.is](https://this.kiji.is/681698956665226337), [synctrack](https://synctrack.io/couriers/yamato-%e3%83%a4%e3%83%9e%e3%83%88%e9%81%8b%e8%bc%b8/)) |
| **Japan Post "ぽすくま" (Posukuma)** | A bear mascot born on a 2012 stamp, grown into a character family with a dedicated post office | Logistics mascots can carry a whole brand universe (collectibles). ([Japan Post PR](https://www.post.japanpost.jp/notification/pressrelease/2022/00_honsha/0713_01_01.pdf)) |
| **Duolingo (Duo)** | Character-voiced notifications; ML-generated reminders tuned to induce mild guilt; streak widget | Character voice drives engagement, but guilt mechanics read as manipulative. **Don't guilt users about parcels.** ([UX Collective](https://uxdesign.cc/why-mascots-like-duo-are-powerful-pieces-of-ux-e378f4da327f)) |
| **Toss** | "One person speaking" voice across 40+ services; UX writers simplify jargon and minimize bad feelings in error states | Exactly our job with 간선상차-style jargon: one consistent, kind voice. ([Toss Feed](https://toss.im/tossfeed/article/uxwriter-interview)) |

No consumer parcel tracker we found uses a narrating character as its core UX. This looks like open whitespace.

## 4. Complaints and pain points (cross-competitor synthesis)

1. **Ads and paywalls on a utility** (스마트택배 ads and 1-year ad removal; 택배파인더 weekly subscription; Parcel's 3-item cap; Deliveries' subscription backlash).
2. **Status inaccuracy and mis-mapping** (AfterShip pickup vs in-transit; 17TRACK last-mile errors; duplicate notifications).
3. **Manual entry friction**: users want auto-import (Parcel reviews; Shop's English-only forwarding; ParcelTrack's degraded email parsing).
4. **Stale/no-update anxiety** with no explanation (blog guides exist just to explain "why isn't my CJ tracking updating").
5. **Jargon** (집화처리, 간선상차, 간선하차, SM입고, 반입신고, 수입신고수리) explained only by third-party blogs.
6. **Cross-border handoff blindness**: an LP… number goes silent, then a new CJ/Hanjin number appears; customs (유니패스) is a separate site that needs 개인통관고유부호 or an H-B/L.
7. **Reliability and support** (CJ app lookups failing; ParcelTrack "non-functional" while selling IAP; scripted support at 17TRACK/AfterShip).
8. **Trust** (Route's surprise protection fees; faked delivery-proof photos; deliberately slowed trackers).

## 5. Tracking-data API options (for a later phase)

| Option | Coverage | Interface | Free tier / pricing | Browser/CORS use | Notes |
|---|---|---|---|---|---|
| **Delivery Tracker (tracker.delivery)** | Strong KR coverage (CJ, Hanjin, Lotte, Logen, Korea Post, Kyungdong, Daesin, CVSnet, Coupang LS…) + some intl | GraphQL: `Query.track(carrierId, trackingNumber)`, `Query.carriers`; **Tracking Webhook API** for change tracking (polling is discouraged); responses usually < 1 s, recommended timeout 15 s | Commercial plans; free tier **not confirmed** in our research. Check the pricing page | Needs client credentials → **use a server-side proxy** (never ship secrets to the browser). The old v1 REST API was keyless and browser-friendly (unverified, and probably deprecated) | Scraper code is open source on GitHub (a `delivery-tracker` fork found at [hwshim0810/delivery-tracker](https://github.com/hwshim0810/delivery-tracker)), so self-hosting is possible but brittle. Our carrier ids mirror its naming. ([docs](https://tracker.delivery/en/docs/tracking-api), [OKKY launch post](https://okky.kr/articles/528643)) |
| **SweetTracker / 스마트택배 API** | 133 KR + intl carriers | REST (API key) | **FREE: 100 invoices/month, max 10 lookups per invoice per day**; STARTER ₩50,000/mo for 1,000; unused quota doesn't roll over | Key-based → proxy | The de facto Korean B2B API; the free tier is only enough for development. ([tracking.sweettracker.co.kr](https://tracking.sweettracker.co.kr/), [GitHub issue citing limits](https://github.com/ParkSiYeol3/wabi-sabi/issues/818)) |
| **택배API (deliveryapi.co.kr)** | KR | REST | Free plan; paid ₩29,900/mo for 3,000, then ₩7+/lookup | Proxy | Smaller vendor; alternative to SweetTracker. ([pricing](https://www.deliveryapi.co.kr/pricing)) |
| **AfterShip Tracking API** | 1,100–1,200+ carriers incl. KR majors | REST + webhooks; normalized `tag`/`subtag` | API/webhooks on **Pro (≈ $119/mo)**; Essentials ≈ $11/mo for 100 shipments; free 50/mo without API (3rd-party) | Secret key → proxy | Best normalized taxonomy; expensive for a consumer app. ([pricing overview](https://flowium.com/blog/aftership-pricing-overview/)) |
| **17TRACK API** | 2,500+ carriers; best for China origin | REST register-then-poll + webhooks | Free 50–100 trackings/mo (conflicting); Basic ≈ $119/yr for 5,000 (≈ $0.0185/track at 500k) | Key → proxy | Best value for cross-border; register a number once, then receive webhook pushes. ([fitgap](https://us.fitgap.com/products/17track), [Track123 compare](https://www.track123.com/blog/track123-vs-17track)) |
| **Ship24** | 1,200+ carriers | REST + webhooks | Free 10 shipments/mo **without API**; Pro ≈ $39–59/mo for 1,000 (sources conflict) | Key → proxy | Statuses: `statusMilestone` (pending, info_received, in_transit, out_for_delivery, failed_attempt, available_for_pickup, delivered, exception). ([help center](https://help.ship24.com/en/article/ship24-pricing-and-plans-explained-425d9d/)) |
| **관세청 UNIPASS** | Korean customs import progress | Public web lookup (H-B/L, or 개인통관고유부호 + auth) and an Open API (needs key) | Free (gov) | Proxy | Required for the customs leg of 직구 orders. ([customs.go.kr cardnews](https://www.customs.go.kr/download/CARDNEWS_INQUIRY_231010.pdf)) |

**Recommendation:** MVP runs on mock data (no API). Phase 2 uses tracker.delivery or SweetTracker for KR domestic, 17TRACK for cross-border, and a thin serverless proxy (Cloudflare Worker/Vercel function) that holds keys, caches responses (≥ 30 min), normalizes to our status set and fans out web-push. Assume **no direct browser calls to any vendor** (secrets + CORS).
