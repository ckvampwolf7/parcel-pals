/**
 * Toast bus — API frozen (any team may call showToast). The UI team renders toasts in AppShell
 * by subscribing with onToast(). Store events (parcel-updated, delivered) are turned into toasts by the UI team too.
 */
import type { CharacterKind, Mood } from '@/types';

export interface ToastInput {
  text: string;
  /** Show a pal avatar in the toast */
  character?: CharacterKind;
  mood?: Mood;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  /** Optional tap target (hash route, e.g. '/p/abc') */
  to?: string;
  durationMs?: number; // default 3500
}
export interface Toast extends ToastInput { id: number }

const subs = new Set<(t: Toast) => void>();
let n = 0;
export function showToast(input: ToastInput): void {
  const toast = { ...input, id: ++n };
  subs.forEach((s) => s(toast));
}
export function onToast(cb: (t: Toast) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}
