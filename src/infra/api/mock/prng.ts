/**
 * Deterministic pseudo-random helpers
 * ===================================
 *
 * The mock layer NEVER uses `Math.random()`. Every value is derived from a
 * stable seed (an entity name + a row index, or a string hash) so the same
 * row always renders the same data across re-renders, navigations and reloads.
 * Stable output keeps React keys steady and makes the UI feel like a real,
 * persistent dataset instead of flickering noise.
 *
 * `mulberry32` is a tiny, fast, well-distributed 32-bit PRNG. We seed it from
 * a string hash so callers can pass human-readable seeds like
 * `"order:3:amount"`.
 */

/** FNV-1a-ish string hash → unsigned 32-bit int. Stable and cheap. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 PRNG — returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A small deterministic RNG bound to a string seed. All the convenience
 * methods (`int`, `pick`, `bool`…) advance the same internal stream, so the
 * sequence is reproducible as long as the seed and call-order are stable.
 */
export class SeededRandom {
  private next: () => number

  constructor(seed: string | number) {
    const numericSeed = typeof seed === "number" ? seed >>> 0 : hashString(seed)
    this.next = mulberry32(numericSeed || 1)
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next()
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min]
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Pick a stable element from an array. Empty arrays return undefined. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) return undefined as unknown as T
    return items[this.int(0, items.length - 1)]!
  }

  /** Boolean with a given probability of being true (default 50%). */
  bool(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue
  }

  /** Float in [min, max] rounded to `decimals` places. */
  decimal(min: number, max: number, decimals = 2): number {
    const value = min + this.next() * (max - min)
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }
}

