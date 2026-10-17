/** Thin wrappers over the engine's speech helpers (kept so the screen never crashes on odd data). */
import { checkpointLine, explainStatus, nextStepLine } from '@/engine';
import type { Checkpoint, Locale, Parcel } from '@/types';

/** "What happens next" line, or null when there is nothing to add. */
export function nextStep(parcel: Parcel, locale: Locale, now?: Date): string | null {
  try { return nextStepLine(parcel, locale, now) || null; } catch { return null; }
}

/** Plain-language explanation of a checkpoint (jargon → words). */
export function explainCheckpoint(parcel: Parcel, c: Checkpoint, locale: Locale): string {
  try {
    const s = explainStatus(c, locale, parcel.carrierId);
    if (s) return s;
  } catch { /* fall through */ }
  return checkpointLine(parcel, c, locale);
}
