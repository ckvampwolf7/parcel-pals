# Status taxonomy: normalized states for Parcel Pals

Goal: one small set of states that (a) maps cleanly to AfterShip/17TRACK/Ship24/tracker.delivery, (b) absorbs messy Korean carrier wording, and (c) gives the character a distinct "scene" and line for each state.

## 1. Reference: AfterShip's 9 tags

AfterShip applies one of 9 tags automatically to every checkpoint: `Pending`, `InfoReceived`, `InTransit`, `OutForDelivery`, `AttemptFail`, `Delivered`, `AvailableForPickup`, `Exception`, `Expired` ([docs](https://www.aftership.com/docs/tracking/enum/delivery-statuses)). Each tag also has numbered **subtags** (e.g. `Delivered_001`). Map by subtag when we integrate, and verify the current subtag list then.

Other vendors, for adapters:
- **17TRACK:** NotFound, InfoReceived, InTransit, Expired, AvailableForPickup, OutForDelivery, DeliveryFailure, Delivered, Exception _(from memory; verify)_.
- **Ship24 `statusMilestone`:** pending, info_received, in_transit, out_for_delivery, failed_attempt, available_for_pickup, delivered, exception.
- **tracker.delivery `TrackEventStatusCode`:** UNKNOWN, INFORMATION_RECEIVED, AT_PICKUP, IN_TRANSIT, OUT_FOR_DELIVERY, ATTEMPT_FAIL, DELIVERED, AVAILABLE_FOR_PICKUP, EXCEPTION _(from memory; verify)_.

## 2. Proposed normalized set (13 states)

`stage` drives a 5-step progress bar (배송지키미 also uses a unified 5-stage view, which users like): 1 접수 → 2 이동 → 3 동네 도착 → 4 배송 중 → 5 도착.

| Our state | Stage | AfterShip tag | Meaning | Character scene (idea) | Sample line (ko / en) |
|---|---|---|---|---|---|
| `not_found` | 0 | `Pending` | Number not (yet) found at the carrier | Pal waiting at the shop door with a clipboard | "아직 택배사에 정보가 없어요. 보통 송장 출력 후 몇 시간 뒤에 떠요!" / "The carrier doesn't have it yet. It usually shows up a few hours after the label is printed." |
| `info_received` | 1 | `InfoReceived` | Label created, parcel not handed over | Pal stretching, packing a backpack | "판매자가 송장을 만들었어요. 이제 기사님이 가지러 올 차례예요." |
| `picked_up` | 1 | `InTransit` (pickup subtag) | Carrier physically has it (집화) | Pal lifts the box: "got it!" | "제가 상자를 받았어요! 출발 준비 완료 📦" |
| `in_transit` | 2 | `InTransit` | Moving between hubs (간선) | Pal on the highway / plane / boat | "큰 트럭 타고 허브터미널로 가는 중이에요. 밤새 이동하는 경우가 많아요." |
| `customs` | 2 | `InTransit` (customs subtag) / `Exception` if held | Import customs clearance (international) | Pal in line at a customs booth | "세관에서 확인 중이에요. 보통 1~3일이면 통과해요." |
| `handed_over` | 2 | `InTransit` | Handed to a domestic last-mile carrier (new number may be issued) | Pal high-fives a local courier pal | "한국 택배사 CJ대한통운에 넘겨줬어요! 새 송장번호도 같이 챙겨둘게요." |
| `at_local_hub` | 3 | `InTransit` | Arrived at destination branch / sub-terminal | Pal arrives in your neighbourhood | "우리 동네 터미널에 도착했어요. 보통 다음 배송 출발이 곧이에요." |
| `out_for_delivery` | 4 | `OutForDelivery` | On the delivery vehicle today | Pal running toward your door | "오늘 배송 출발! 곧 문 앞에서 만나요 🏃" |
| `attempt_failed` | 4 | `AttemptFail` | Delivery attempted, failed (부재 etc.) | Pal knocking, nobody home | "문 앞에 갔는데 못 전해드렸어요. 기사님 연락을 확인해 주세요." |
| `ready_for_pickup` | 5 | `AvailableForPickup` | Waiting at store / branch / locker | Pal waiting at the convenience store counter | "편의점에 도착했어요! 알림톡으로 받은 QR을 챙겨 가세요." |
| `delivered` | 5 | `Delivered` | Delivered | Pal celebrates, waves goodbye | "배송 완료! 즐거운 언박싱 되세요 🎉" |
| `exception` | – | `Exception` | Problem: return, damage, bad address, customs hold, lost | Pal looks worried but holds the box tight | "문제가 생겼어요: 주소 확인이 필요하대요. 이렇게 해보세요 →" |
| `returning` | – | `Exception` (return subtag) | Being returned to sender | Pal turns around, sad | "보내는 분께 다시 돌아가는 중이에요. 판매자에게 문의해 보세요." |
| `expired` | – | `Expired` | No updates for a long time; tracking no longer active | Pal asleep on the box | "한동안 소식이 없어요. 판매자나 택배사에 문의해 보는 게 좋겠어요." |

**Derived flag (not a state): `stale`**. Set it when there has been no new event for more than N hours, with N depending on state: `in_transit` > 48 h (weekday), `customs` > 72 h, `out_for_delivery` past 22:00. The character explains what is *normal*, e.g. "주말엔 간선 이동이 멈추기도 해요". It never fakes progress.

## 3. Korean carrier wording → our state

Raw checkpoint text varies by carrier and changes over time. Rules are matched **in order, first match wins**, on the status column (and on the description when the status is blank). Precedence matters because some strings contain several keywords.

| Priority | Our state | Keywords / regex (ko) | Typical carrier wording |
|---|---|---|---|
| 1 | `returning` | `/반송|반품.*(이동|입고|출발)|회송/` | 반송, 반송출발, 회송 (우체국); 반품 집화 |
| 2 | `exception` | `/파손|분실|사고|주소.*(불명|오류)|수취.*거절|통관.*보류|보류|배송불가|폐기/` | 사고, 주소불명, 수취거절, 통관보류, 미배송(사유) |
| 3 | `delivered` | `/배송\s*완료|배달\s*완료|수령|인수자\s*등록|고객.*전달|전달\s*완료/` | 배송완료 (CJ, 로젠), 배달완료 (우체국, 롯데), 인수자등록 (롯데/CJ) |
| 4 | `ready_for_pickup` | `/점포\s*도착|편의점.*(도착|보관)|영업소\s*도착|보관\s*중|무인.*(보관|함)|택배함/` | 점포도착 (GS/CU 편의점택배), 영업소 도착 (경동/대신), 무인택배함 보관 |
| 5 | `attempt_failed` | `/미배달|미배송|부재|배달\s*실패|재배달/` | 미배달 (수취인부재) (우체국), 미배송 (로젠) |
| 6 | `out_for_delivery` | `/배송\s*출발|배달\s*출발|배달\s*준비|배송\s*출고|배송\s*중|배달\s*중/` | 배송출발 (CJ, "배달예정시간 …"), 배달준비 (우체국), 배송출고 (로젠), 배송출발 (한진) |
| 7 | `at_local_hub` | `/SM\s*입고|배송지\s*도착|배달\s*(지|국)\s*도착|(대리점|영업소|캠프)\s*(도착|입고)|터미널\s*도착.*(배송|배달)/` | SM입고 (CJ sub-terminal), 도착 at 배달국 (우체국), 캠프 도착 (쿠팡), 배송지 터미널 도착 |
| 8 | `customs` | `/통관|세관|반입|수입\s*신고|반출|목록\s*심사|검사\s*대상/` | 반입신고, 수입신고, 수입신고수리, 반출신고, 목록통관 (유니패스) |
| 9 | `handed_over` | `/인계|국내\s*택배사|이관/` | 국내 택배사 인계 (Cainiao → CJ), 운송사 인계 |
| 10 | `in_transit` | `/간선\s*(상차|하차)|이동\s*중|터미널\s*(입고|출고|도착)|허브|발송|상차|하차|출고|입고|도착/` | 간선상차 / 간선하차 (CJ), 이동중 (한진), 터미널입고 / 출고 (로젠), 발송 / 도착 (우체국), 상품 이동중 (롯데) |
| 11 | `picked_up` | `/집화|집하|인수|픽업\s*완료|상품\s*인수/` | 집화처리 (CJ), 집하 (롯데/로젠), 접수 *after* pickup (우체국) |
| 12 | `info_received` | `/접수|송장\s*(등록|출력)|정보\s*수신|상품\s*준비|출고\s*요청/` | 접수 (우체국/한진), 상품접수 (롯데), 상품준비중 (쿠팡) |
| 13 | `not_found` | (no events) | "조회된 결과가 없습니다" |

Notes:
- **CJ 대한통운:** 집화처리 → 간선상차 → 간선하차 → (SM입고) → 배송출발 (often with 배달예정시간 window) → 배송완료. Its own tracker shows 5 steps: 접수, 집화완료, 허브터미널 도착, 배송출발, 배송완료. 상차 = loaded/departing, 하차 = unloaded/arrived.
- **우체국:** 접수 → 발송 → 도착 (repeated per office) → 배달준비 → 배달완료 / 미배달(사유). Here "배달준비" means it is on today's route, so it maps to `out_for_delivery`.
- **한진:** 접수 → 입고 → 이동중 → 도착 → 배송준비중 → 배송출발 → 배송완료.
- **롯데:** 상품접수 → 상품 집하 → 상품 이동중 → 배송 출발 → 배달 완료 (+ 인수자등록).
- **로젠:** 집하 → 터미널입고 → 터미널출고 → 배송출고 → 배송완료 / 미배송.
- **경동/대신:** many shipments end at a branch, so 영업소 도착 maps to `ready_for_pickup` (not delivered!). This is a common mis-mapping.
- **Cross-border (직구):** origin events (often Chinese or English; translate them) → 항공/해운 출발 → 반입신고 → 수입신고 / 목록통관 → 수입신고수리 → 반출신고 → 국내 택배사 인계 → domestic flow above. Customs holds (통관보류) are often caused by a missing or mismatched **개인통관고유부호**. Treat those as `exception` with a specific fix-it hint.
- "도착" alone is ambiguous (hub arrival vs final office). Rule 7 catches the final-office cases first, and everything else falls through to `in_transit`.
- Keep the raw text and show it under a "택배사 원문 보기" toggle: transparency builds trust, and it lets users correct mis-mapping.

Wording sources: [CJ status explainer (brunch)](https://brunch.co.kr/@feel2174/35), [CJ tracker guide](https://brunch.co.kr/@lignosahub/186), [UNIPASS cardnews](https://www.customs.go.kr/download/CARDNEWS_INQUIRY_231010.pdf), [직구 customs stages](https://www.windly.cc/blog/unipass-customs-clearance-inquiry). Korea Post, Hanjin, Lotte and Logen sequences come from general knowledge of their public trackers **(unverified this session; validate against live responses when the API is integrated)**.

## 4. Notification policy per state (default)

| State | Push? | Why |
|---|---|---|
| picked_up | ✅ (first time only) | "It's real now" reassurance |
| in_transit | ❌ (silent timeline update) | Avoid spam; 간선 events are frequent |
| customs | ✅ entering customs, ✅ cleared | High-anxiety step for 직구 |
| handed_over | ✅ (+ new number) | Users lose track here |
| at_local_hub | ❌ | Low value |
| out_for_delivery | ✅ | Top value |
| attempt_failed / exception / returning | ✅ high priority | Action needed |
| ready_for_pickup | ✅ + reminder after 24–48 h | Stores and lockers have holding limits |
| delivered | ✅ | Closure; character celebration |
| stale | ✅ at most once per parcel per 48 h | Proactive reassurance instead of silence |

Quiet hours: no push 22:00–08:00 local by default, except exceptions. Korean deliveries can run late into the evening, so make this configurable.
