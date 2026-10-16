# Product insights: what the research means for Parcel Pals

_Companion to [competitors.md](./competitors.md), [status-taxonomy.md](./status-taxonomy.md) and [carrier-formats.json](./carrier-formats.json). Opinionated on purpose._

## The 12 takeaways

### 1. Korean users are fleeing ad-stuffed and paywalled trackers. "Clean and free" is a real wedge.
The incumbent 스마트택배 is described as "광고 투성이" (wall-to-wall ads); its paid ad removal expires after a year, and users report lag. 택배파인더 forces a weekly subscription. The community's go-to alternative (배송지키미) wins mostly by being *quiet*. Globally, Parcel caps free users at 3 parcels with no push, and Deliveries took heat for going subscription.
→ **Core tracking is free with no interstitial or banner ads, ever.** If we monetize, do it with optional character cosmetics (skins, seasonal outfits, alternate couriers), not by degrading the utility.

### 2. Nobody owns "explain it to me". That is exactly the character's job.
Korean status text is logistics jargon: 집화처리, 간선상차/간선하차, SM입고, 배달준비, 반입신고, 수입신고수리. Blogs exist purely to translate it, and every competitor shows raw carrier strings. The leaders also get *mapping* wrong (AfterShip has shown pickup-ready parcels as "in transit").
→ The character turns each checkpoint into **one plain sentence + what it means for you + what usually happens next and when**, e.g. "간선하차 = 큰 트럭에서 내렸어요. 보통 내일 배송 출발해요." Keep the raw carrier text behind a toggle for trust.

### 3. Waiting anxiety is the real problem; honesty is the brand.
Domino's built its tracker because customers were anxious; visible progress (the "labor illusion") calms people. NPR's 2026 reporting shows the dark side: trackers that were slowed or faked. Duolingo shows character voice works but guilt mechanics feel manipulative.
→ The character **never fakes motion**. When nothing has happened it says so and explains what's normal ("주말엔 간선 이동이 쉬어요", "세관은 보통 1–3일"). Our `stale` flag triggers *proactive* reassurance and suggests a next action (contact the seller or carrier) once a threshold passes. No guilt, no streaks about parcels.

### 4. The cross-border "handoff gap" is the biggest unmet need for our audience.
AliExpress parcels (Cainiao `LP…`) are handed to CJ대한통운 (historically ~80%), Hanjin, Lotte or Korea Post. Temu's main Korean carrier has been Hanjin. Each handoff issues a *new* domestic number, and customs is tracked on a separate government site (UNIPASS) that needs an H-B/L or 개인통관고유부호. Users go dark exactly when they're most anxious. No competitor stitches this into one story.
→ **One parcel = one journey**: international leg → customs (세관) → domestic carrier, with the character literally "handing the box" to a local courier pal. Phase 2 auto-links the domestic number. In the MVP, let users attach a second number to the same parcel. Flag customs holds and the common fix (개인통관고유부호 mismatch).

### 5. Carrier detection must produce ranked candidates, not one answer.
Korean numbers are bare digits: 12 digits fits CJ, Hanjin and Lotte (and FedEx Express); 10 digits fits CJ, Hanjin and DHL; 13 digits is likely Korea Post but also Daesin. Only S10 (`AA123456789KR`), UPS `1Z…`, `LP…`, `YT…`, `TBA…` and `SF…` are confidently identifiable.
→ The detector returns `[{carrierId, score, reason}]`. Score boosts come from: length, the reported mod-7 check digit (CJ/Lotte/Logen, unverified), S10 check-digit validity, the shop the user picked (Temu → Hanjin, AliExpress → CJ), and the user's own history. Phase 2 probes the top 2–3 candidates in parallel and keeps whichever returns events. UX: the character says "CJ대한통운 같아요! 아니면 눌러서 바꿔주세요" with one-tap chips for the alternatives. Never block on detection.

### 6. In Korea, the tracking number arrives by KakaoTalk 알림톡 or SMS, not email. Paste/share import is our email sync.
Western leaders win with Gmail/Amazon import (Shop, AfterShip, Parcel). Korean equivalents are phone-number lookup (배송지키미, CJ 오네) and 알림톡 messages from carriers and sellers. A PWA can't read SMS or KakaoTalk, but users can copy or share the message.
→ **Smart paste**: paste a whole 알림톡/SMS/email blob and we extract the number(s), carrier name, shop name and item name with regex and keyword dictionaries. Add a **Web Share Target** (Android PWA) so "공유 → Parcel Pals" works, and a clipboard-detect prompt when the app opens (with user gesture and consent). Barcode/QR scan of the label is secondary (BarcodeDetector exists on Chrome Android but not iOS Safari; needs a JS fallback).

### 7. Parity features we can't skip (MVP).
Every serious tracker has: carrier auto-detect, a multi-parcel list with status at a glance, a detailed timeline, push on key events, nicknames ("엄마 생일선물"), archive of delivered parcels, and a share link. Native apps add widgets and Live Activities/Dynamic Island (Uber Eats since 2023; Apple Wallet does it system-wide).
→ As a PWA we **cannot** do Live Activities or home-screen widgets. Web Push on iOS only works after "Add to Home Screen" (iOS 16.4+). So the install prompt must be a first-class, character-led moment ("홈 화면에 저를 데려가 주시면 도착하자마자 알려드릴게요!"). Say this limitation out loud to the team: a native wrapper may be needed later to compete on glanceability.

### 8. The ETA is the hero number; show confidence, not false precision.
Narvar sells "95%+ accurate" predicted dates; Coupang anchors expectations with "몇 시까지"; CJ's 배송출발 often includes a delivery window. Users mostly want "오늘? 내일? 이번 주?"
→ Show a **coarse, honest ETA bucket** (오늘 / 내일 / 2–3일 / 통관 중이라 3–7일) computed from state + carrier + weekday heuristics. Show a window only when the carrier provides one. The character's mood and pose reflect the bucket.

### 9. Pickup states are the sneaky failure point; get them right.
Convenience-store parcels end at "점포 도착" (QR code via 알림톡). Kyungdong and Daesin often end at "영업소 도착" for self-pickup. Marking these as "delivered" or "in transit" is exactly the mis-mapping users hate.
→ `ready_for_pickup` is a first-class state with a distinct scene ("편의점에서 기다리는 중"), a reminder after 24–48 h, and a link to the pickup instructions.

### 10. Don't monetize through trust-eroding mechanics.
Route's surprise shipping-protection fees and denied claims, faked Coupang proof photos in the news, and refund disputes at 17TRACK all erode trust.
→ No insurance upsells, no dark-pattern subscriptions, no fake urgency. Cosmetic in-app purchases or a "support the pals" tip jar later, and optionally an opt-in affiliate link only on the "order something" path, never on tracking screens.

### 11. Character design rules: cute, but out of the way.
Toss shows the value of "one consistent voice" and of minimizing bad feelings in error states. Yamato's cat and Japan Post's Posukuma show logistics mascots can carry a brand. Duolingo shows the risk of a pushy mascot.
→ The character speaks **one line**, in friendly 해요체 (not 반말 by default), with a "간단히 보기" mode that hides the mascot for power users. One character per transport mode (truck for domestic, plane for international air, ship for sea, and a courier animal for the last mile) makes the *journey* legible at a glance. The character never covers the number, ETA or carrier.

### 12. Privacy-first and login-free.
Competitors push account creation and inbox access (AfterShip, Shop). Apple now extracts orders from Mail on-device.
→ The MVP stores parcels **locally** (IndexedDB) with no account. Phone numbers and addresses are never required. If sync arrives later, make it opt-in. Korean PIPA and the general "택배 송장 개인정보" sensitivity make this a selling point ("주소·전화번호는 몰라도 돼요").

---

## Recommended MVP feature list (ship first)

1. **Add parcel** by typing, pasting a whole message (smart extraction), or Android share-target. Ranked carrier candidates with one-tap correction. Optional nickname and shop (AliExpress / Temu / Coupang / Naver / 기타).
2. **Parcel list** sorted by urgency (out for delivery > exceptions > pickup waiting > in transit > delivered), each with the character's mini pose + one-line status + ETA bucket.
3. **Parcel detail**: character "scene" for the current state, 5-step progress bar, plain-language explanation + "what happens next", full timeline with a raw-text toggle, and a "택배사 사이트에서 보기" deep link (from `trackingUrlTemplate`).
4. **Cross-border journey**: attach a second (domestic) number to the same parcel; customs stage explained.
5. **Normalized status engine** (status-taxonomy.md) with the `stale` flag and reassurance copy.
6. **Mock tracking data** (realistic scenarios per carrier, including cross-border and pickup) behind a provider interface, so the real API slots in later.
7. **PWA install flow** led by the character; **Web Push** opt-in after install (the plumbing can be stubbed in the MVP).
8. **Korean-first i18n** (ko default, en toggle), friendly 해요체 copy deck per state.
9. **Archive** of delivered parcels; delete; rename.
10. **Share** a read-only status card (image or link) for "언제 와?" family and friend messages.

## Delight features (after core is solid)

- **Character per leg**: plane ✈️ for the international leg, a 세관 booth scene, then a handoff to the truck 🚚 and a final-mile animal courier. The handoff animation is the "aha" moment.
- **Arrival celebration**: confetti plus a collectible "stamp" (도장) per delivered parcel, mirroring postal stamp culture (Korea Post's character stamps, Japan Post's Posukuma). Purely celebratory; no streak pressure.
- **Mood weather**: the character's expression reflects the ETA bucket and staleness (sleepy on weekends, sweating in customs), with honest copy.
- **"왜 안 와요?" button**: a one-tap diagnosis ("마지막 업데이트가 간선하차 18시간 전이에요. CJ는 보통 다음 날 배송출발해요. 내일 오전까지 소식 없으면 여기로 문의하세요").
- **Holiday/peak awareness**: 설·추석 택배 마감 and 택배 없는 날 notices, as character announcements.
- **Character-voiced share card** ("Parcel Pal says: 내일 도착 예정!") for KakaoTalk sharing.
- **Skins/outfits** (seasonal, carrier-colored) as the future monetization surface.
- Later, native wrapper: **Live Activities/Dynamic Island + widgets** where the character "drives" across the Lock Screen.

## Things to avoid

- Ads in the tracking flow; time-limited "ad removal"; weekly subscriptions.
- Faking progress or inventing precise ETAs.
- Guilt-trip or streak mechanics; notification spam on every 간선 scan (push only on meaningful states; quiet hours 22:00–08:00 by default).
- Forcing login or phone/address entry.
- Showing a single "detected carrier" as fact when the number is ambiguous.
- Calling any vendor API directly from the browser with a secret key. Always go through a proxy.
- Marking pickup-ready (편의점/영업소) parcels as delivered.
