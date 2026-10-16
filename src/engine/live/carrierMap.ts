/**
 * Our carrier ids → Delivery Tracker (tracker.delivery) carrier ids.
 * Carriers missing here have no real-time lookup; the app shows their website link instead.
 * Verified against https://apis.tracker.delivery/carriers (42 carriers) on 2026-10-16.
 */
const MAP: Record<string, string> = {
  'kr.cjlogistics': 'kr.cjlogistics',
  'kr.hanjin': 'kr.hanjin',
  'kr.lotte': 'kr.lotte',
  'kr.epost': 'kr.epost',
  'kr.logen': 'kr.logen',
  'kr.coupangls': 'kr.coupangls',
  'kr.kdexp': 'kr.kdexp',
  'kr.daesin': 'kr.daesin',
  'kr.cvsnet': 'kr.cvsnet',
  'kr.epost.ems': 'kr.epost.ems',
  'kr.epost.intl': 'kr.epost.ems',
  'cn.cainiao': 'cn.cainiao.global',
  // International postal (UPU S10, e.g. "LX123456789CN") → UPU EMS tracking
  'cn.chinapost': 'un.upu.ems',
  'cn.ems': 'un.upu.ems',
  'upu.s10': 'un.upu.ems',
  'us.ups': 'us.ups',
  'us.fedex': 'us.fedex',
  'de.dhl': 'de.dhl',
  'us.usps': 'us.usps',
  // Test carrier from tracker.delivery: numbers are "yyyy-MM-ddTHH:00:00Z" (one every 3 h, UTC)
  'dev.track.dummy': 'dev.track.dummy',
};

/** tracker.delivery id for our carrier id, or undefined when real-time lookup isn't available. */
export function liveCarrierId(carrierId: string): string | undefined {
  return MAP[carrierId];
}

export function supportsLiveTracking(carrierId: string): boolean {
  return carrierId in MAP;
}

/** A dummy tracking number that is currently "in transit" (created ~now, delivered in ~1 day). */
export function dummyTrackingNumber(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 12 * 3.6e6);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(Math.floor(d.getUTCHours() / 3) * 3);
  return d.toISOString().replace('.000Z', 'Z');
}
