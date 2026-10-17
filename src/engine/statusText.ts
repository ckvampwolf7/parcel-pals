/**
 * Raw carrier wording → normalized status (docs/research/status-taxonomy.md §3). First match wins.
 * Used by real providers and by explainStatus() for checkpoints without a simulator code.
 */
import type { StatusTag } from '@/types';

export type JargonTerm =
  | 'returning' | 'exception' | 'delivered' | 'pickup_ready' | 'attempt_fail' | 'out_for_delivery' | 'arrive_local'
  | 'customs_cleared' | 'customs_declared' | 'customs_in' | 'handover' | 'depart' | 'arrive_hub' | 'pickup' | 'received' | 'transit';

const RULES: Array<[RegExp, JargonTerm]> = [
  [/반송|반품.*(이동|입고|출발)|회송|RETURN/i, 'returning'],
  [/파손|분실|사고|주소.*(불명|오류)|수취.*거절|통관.*보류|보류|배송\s*불가|폐기|EXCEPTION|DAMAGED|LOST|ON HOLD/i, 'exception'],
  [/배송\s*완료|배달\s*완료|수령\s*완료|인수자\s*등록|고객.*(전달|수령)|전달\s*완료|창구\s*교부|DELIVERED|PICKED UP BY/i, 'delivered'],
  [/점포\s*도착|편의점.*(도착|보관)|영업소\s*도착|보관\s*중|우체국\s*보관|무인.*(보관|함)|택배함|READY FOR PICKUP|AVAILABLE FOR PICKUP/i, 'pickup_ready'],
  [/미배달|미배송|부재|배달\s*실패|재배달|ATTEMPT|NOTICE LEFT/i, 'attempt_fail'],
  [/배송\s*출발|배달\s*출발|배달\s*준비|배송\s*출고|배송\s*중|배달\s*중|OUT FOR DELIVERY|ON .*VEHICLE FOR DELIVERY|LOADED ON DELIVERY VEHICLE|WITH DELIVERY COURIER/i, 'out_for_delivery'],
  [/SM\s*입고|배송지\s*도착|배달\s*(지|국)\s*도착|(대리점|영업소|캠프|배송점)\s*(도착|입고)|배송\s*준비|DELIVERY STATION|AT LOCAL .*FACILITY|ARRIVED AT POST OFFICE|DESTINATION SCAN/i, 'arrive_local'],
  [/수입\s*신고\s*수리|통관\s*완료|반출|CLEARED|SHIPMENT RELEASE|RELEASED BY (THE )?CUSTOMS|CLEARANCE (PROCESSING )?COMPLETE/i, 'customs_cleared'],
  [/수입\s*신고|목록\s*심사|DECLARATION/i, 'customs_declared'],
  [/통관|세관|반입|검사\s*대상|CUSTOMS|CLEARANCE|IMPORT SCAN/i, 'customs_in'],
  [/인계|국내\s*택배사|이관|HANDED OVER/i, 'handover'],
  [/간선\s*상차|상차|출고|발송|이동\s*중|DEPART|LEFT\s+.*(FACILITY|LOCATION)|EXPORT SCAN|출항|항공기\s*출발/i, 'depart'],
  [/간선\s*하차|하차|입고|도착|ARRIVED|입항/i, 'arrive_hub'],
  [/집화|집하|픽업\s*완료|상품\s*인수|PICKED UP|ACCEPTED AT|ORIGIN SCAN/i, 'pickup'],
  [/접수|송장\s*(등록|출력)|정보\s*수신|상품\s*준비|출고\s*요청|INFORMATION (RECEIVED|SENT)|LABEL/i, 'received'],
];

export function classifyCarrierText(text: string): JargonTerm | undefined {
  for (const [re, term] of RULES) if (re.test(text)) return term;
  return undefined;
}

export function termToStatus(term: JargonTerm | undefined): StatusTag {
  switch (term) {
    case 'returning': case 'exception': return 'exception';
    case 'delivered': return 'delivered';
    case 'pickup_ready': return 'available_for_pickup';
    case 'attempt_fail': return 'attempt_fail';
    case 'out_for_delivery': return 'out_for_delivery';
    case 'customs_in': case 'customs_declared': case 'customs_cleared': return 'customs';
    case 'received': return 'info_received';
    case undefined: return 'in_transit';
    default: return 'in_transit';
  }
}

/** Status for a raw carrier status string. */
export function statusFromCarrierText(text: string): StatusTag {
  return termToStatus(classifyCarrierText(text));
}
