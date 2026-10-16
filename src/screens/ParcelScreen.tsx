/** Owned by the Journey team. LEAD STUB — replace. */
import { useParcel } from '@/store';
import { Character } from '@/characters';
import { moodFor } from '@/engine';
export default function ParcelScreen({ id }: { id: string }) {
  const p = useParcel(id);
  if (!p) return <main><h1>Not found</h1></main>;
  return (<main><h1>{p.nickname}</h1><Character kind={p.character} mood={moodFor(p.snapshot)} />
    <ol data-testid="timeline">{p.snapshot?.checkpoints.map((c) => <li key={c.id}>{c.message.ko}</li>)}</ol></main>);
}
