/** Owned by the UI team. LEAD STUB — replace. */
import { useParcels } from '@/store';
import { href } from '@/router';
export default function HomeScreen() {
  const parcels = useParcels();
  return (<main><h1>Home</h1><a href={href('/add')} data-testid="add-button">+ Add</a>
    <ul data-testid="home-list">{parcels.map((p) => <li key={p.id}><a data-testid="parcel-card" href={href('/p/' + p.id)}>{p.nickname} — {p.snapshot?.status}</a></li>)}</ul></main>);
}
