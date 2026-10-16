/** Small deterministic hashing + PRNG helpers (no dependencies). */

/** 32-bit FNV-1a style string hash (stable across platforms). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // final avalanche (murmur3 fmix32)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export type Rng = () => number;

/** mulberry32: fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A PRNG stream derived from a string key. */
export function rngFor(key: string): Rng {
  return mulberry32(hashString(key));
}

export const uniform = (rng: Rng, a: number, b: number) => a + rng() * (b - a);
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length) % items.length];

/** Weighted pick: items as [value, weight]. */
export function pickWeighted<T>(rng: Rng, items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) { r -= w; if (r < 0) return v; }
  return items[items.length - 1][0];
}
