/** Parcel detail screen (#/p/<id>) — owned by the Journey team. UI lives in src/journey/. */
import { useParcel } from '@/store';
import { ParcelNotFound, ParcelView } from '@/journey/ParcelView';

export default function ParcelScreen({ id }: { id: string }) {
  const parcel = useParcel(id);
  if (!parcel) return <ParcelNotFound />;
  return <ParcelView parcel={parcel} />;
}
