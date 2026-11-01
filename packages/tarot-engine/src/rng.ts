/** A source of uniform floats in [0, 1). The only randomness the engine consumes. */
export interface Rng {
  next(): number
}

/** Uniform integer in [0, max). The float has 53 random bits, so the modulo-free scaling is unbiased for any realistic `max`. */
export function randomInt(rng: Rng, max: number): number {
  if (!Number.isInteger(max) || max < 1) throw new RangeError(`randomInt: max must be a positive integer, got ${max}`)
  return Math.floor(rng.next() * max)
}

function hash(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

/** Reproducible generator (sfc32 seeded through a string hash): the same seed always yields the same sequence. */
export function seededRng(seed: string | number): Rng {
  const seedHash = hash(String(seed))
  let a = seedHash()
  let b = seedHash()
  let c = seedHash()
  let d = seedHash()
  const word = (): number => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return t >>> 0
  }
  for (let i = 0; i < 15; i++) word()
  return {
    next() {
      const high = word() >>> 5 // 27 bits
      const low = word() >>> 6 // 26 bits
      return (high * 67108864 + low) / 9007199254740992
    },
  }
}

/** Operating-system entropy, for draws that must not be predictable. */
export function cryptoRng(): Rng {
  return {
    next() {
      const words = globalThis.crypto.getRandomValues(new Uint32Array(2))
      return ((words[0]! >>> 5) * 67108864 + (words[1]! >>> 6)) / 9007199254740992
    },
  }
}
