/**
 * Turns store AppEvents into toast inputs (UI team). Pure + testable.
 * Events that arrive in the same tick are coalesced per parcel (an update that also delivered → one 🎉 toast),
 * and a burst of many parcels collapses into one summary toast.
 */
import type { AppEvent, Checkpoint, Locale, Parcel } from '@/types';
import { checkpointLine, moodFor } from '@/engine';
import { t, hasKey } from '@/i18n';
import { parseRoute } from '@/router';
import type { ToastInput } from './toast';

interface Pending { parcel: Parcel; newCheckpoints: Checkpoint[]; delivered: boolean }

export function eventsToToasts(events: AppEvent[], locale: Locale, hash: string): ToastInput[] {
  const route = parseRoute(hash);
  const viewingId = route.name === 'parcel' ? route.id : undefined;
  const byParcel = new Map<string, Pending>();
  const out: ToastInput[] = [];

  for (const e of events) {
    if (e.type === 'parcel-updated' || e.type === 'parcel-delivered') {
      const prev = byParcel.get(e.parcel.id);
      const entry: Pending = prev ?? { parcel: e.parcel, newCheckpoints: [], delivered: false };
      entry.parcel = e.parcel;
      if (e.type === 'parcel-updated') entry.newCheckpoints.push(...e.newCheckpoints);
      else entry.delivered = true;
      byParcel.set(e.parcel.id, entry);
    } else if (e.type === 'error') {
      const msg = hasKey(e.message, locale) ? t(e.message, undefined, locale) : e.message;
      if (msg) out.push({ text: msg, tone: 'danger', durationMs: 5000 });
    }
  }

  const entries = [...byParcel.values()].filter((p) => p.parcel.id !== viewingId);
  const delivered = entries.filter((p) => p.delivered);
  const updated = entries.filter((p) => !p.delivered && p.newCheckpoints.length > 0);

  for (const d of delivered) {
    out.push({
      text: t('ui.toast.delivered', { name: d.parcel.nickname }, locale),
      character: d.parcel.character, mood: 'celebrating', tone: 'success', to: `/p/${d.parcel.id}`, durationMs: 6000,
    });
  }
  if (updated.length > 2) {
    out.push({ text: t('ui.toast.manyUpdates', { n: updated.length }, locale), character: updated[0].parcel.character, mood: 'happy', to: '/inbox', durationMs: 5000 });
  } else {
    for (const u of updated) {
      const newest = [...u.newCheckpoints].sort((a, b) => a.time.localeCompare(b.time)).at(-1)!;
      let text: string;
      try { text = checkpointLine(u.parcel, newest, locale); } catch { text = t('ui.toast.updatedFallback', { name: u.parcel.nickname }, locale); }
      const tone = u.parcel.snapshot?.delayed || newest.status === 'exception' || newest.status === 'attempt_fail' ? 'warning' : 'neutral';
      out.push({ text, character: u.parcel.character, mood: moodFor(u.parcel.snapshot), tone, to: `/p/${u.parcel.id}`, durationMs: 5000 });
    }
  }
  return out;
}
