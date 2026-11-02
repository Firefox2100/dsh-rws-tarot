import { Pack, type Placed } from './pack.ts'
import type { Rng } from './rng.ts'

export const PLAIN_METHOD = 'plain'

/** The most cards one plain draw turns up. */
export const PLAIN_LIMIT = 12

export interface PlainOptions {
  /** How many cards to turn up, from 1 to `PLAIN_LIMIT`. */
  readonly count: number
  readonly rng: Rng
  /** Chance each card is turned the other way up. */
  readonly reversals: number
}

export interface PlainStart {
  readonly significator: null
  /** The whole pack, shuffled and cut; the first `draws` cards are turned up in order. */
  readonly order: Placed[]
  readonly draws: number
  readonly turns: number[]
}

/** Prepare a draw of `count` cards from the shuffled and cut pack. It belongs to no method of the book, so its cards have no positions. */
export function startPlain(options: PlainOptions): PlainStart {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > PLAIN_LIMIT) {
    throw new RangeError(`startPlain: draw 1 to ${PLAIN_LIMIT} cards, not ${options.count}`)
  }
  const pack = Pack.create({ rng: options.rng, reversals: options.reversals })
  pack.cut()
  return { significator: null, order: [...pack.snapshot().order], draws: options.count, turns: Array.from({ length: options.count }, () => 1) }
}
