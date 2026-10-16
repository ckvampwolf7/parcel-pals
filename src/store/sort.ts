import type { Parcel } from '@/types';

/** Urgency rank: out for delivery > problems > pickup waiting > moving (by ETA) > pending > delivered > archived. */
export function urgencyRank(p: Parcel): number {
  if (p.archived) return 9;
  const s = p.snapshot;
  switch (s?.status ?? 'pending') {
    case 'out_for_delivery': return 0;
    case 'exception': case 'attempt_fail': return 1;
    case 'available_for_pickup': return 2;
    case 'info_received': case 'in_transit': case 'customs': return 3;
    case 'expired': return 4;
    case 'pending': return 5;
    case 'delivered': return 6;
    default: return 5;
  }
}

const time = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN);
const lastTime = (p: Parcel) => time(p.snapshot?.checkpoints.at(-1)?.time) || time(p.createdAt) || 0;

export function compareParcels(a: Parcel, b: Parcel): number {
  const ra = urgencyRank(a);
  const rb = urgencyRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 3 || ra === 0) {
    const ea = time(a.snapshot?.eta?.latest);
    const eb = time(b.snapshot?.eta?.latest);
    if (!Number.isNaN(ea) || !Number.isNaN(eb)) {
      if (Number.isNaN(ea)) return 1;
      if (Number.isNaN(eb)) return -1;
      if (ea !== eb) return ea - eb;
    }
  }
  // most recent activity first
  const d = lastTime(b) - lastTime(a);
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortParcels(parcels: Parcel[]): Parcel[] {
  return [...parcels].sort(compareParcels);
}
