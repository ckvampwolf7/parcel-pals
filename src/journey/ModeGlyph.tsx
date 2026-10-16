/** Tiny transport-mode glyphs (16×16, currentColor) for the badge next to the pal. */
import type { TransportMode } from '@/types';

const PATHS: Record<TransportMode, string> = {
  truck: 'M1.5 4.5h8v6.5h-8zM9.5 7h3l2 2.5V11h-5zM4.5 13.2a1.4 1.4 0 1 0 0-.1zM11.5 13.2a1.4 1.4 0 1 0 0-.1z',
  plane: 'M8 1.5c.8 0 1.2.8 1.2 1.8v3.4l5.3 3v1.5l-5.3-1.6v3l1.6 1.2V15L8 14.2 5.2 15v-1.2l1.6-1.2v-3L1.5 11.2V9.7l5.3-3V3.3c0-1 .4-1.8 1.2-1.8z',
  ship: 'M2 10h12l-2 3.5H4zM4 10V7h8v3M7 7V4h2v3M1.5 15c1.2 0 1.6-.8 2.6-.8s1.4.8 2.6.8 1.6-.8 2.6-.8 1.4.8 2.6.8',
  bike: 'M3.8 13.5a2.3 2.3 0 1 0 0-.1zM12.2 13.5a2.3 2.3 0 1 0 0-.1zM3.8 11.2 6.5 6h4l1.7 5.2M6.5 6l2.6 5.2h-5.3M9.5 3.5h2',
  walk: 'M9 2.5a1.3 1.3 0 1 0 0 .1zM8 5l-2 4.5 2.5 1.5L7 15M8 5l2.5 2.5 2 .5M6 9.5 4 11',
};

export function ModeGlyph({ mode, size = 16 }: { mode: TransportMode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[mode] ?? PATHS.truck} />
    </svg>
  );
}
