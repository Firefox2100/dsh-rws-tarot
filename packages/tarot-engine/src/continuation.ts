import { getMethod } from '@dsh-rws-tarot/data'
import { Pack, type Placed } from './pack.ts'
import type { Rng } from './rng.ts'
import type { Reading } from './table.ts'

export interface ContinuationStart {
  /** The Querent's card, which lies face up on top of the heap of the cards set aside. */
  readonly significator: Placed
  /** The remaining cards, shuffled and cut, in the order they are laid: the first packet's cards first. */
  readonly order: Placed[]
  readonly draws: number
  /** A turn shows one line, whose length is its packet's. */
  readonly turns: number[]
}

/**
 * Carry a finished reading further: the cards the first reading did not lay are shuffled and cut once more and dealt
 * into packets of 7, 6, 5, 4, 2 and 11, each of which becomes a line.
 */
export function continueAlternative(previous: Reading, rng: Rng): ContinuationStart {
  const method = getMethod('thirtyfive')
  if (previous.method !== method.continues) throw new RangeError(`only a reading of the ${method.continues} method can be carried further`)
  if (previous.drawn < previous.draws) throw new RangeError('the reading is not finished')
  if (previous.significator === null) throw new RangeError('the reading has no Querent card')
  const left = previous.order.slice(previous.draws)
  const total = method.packets.sizes.reduce((a, b) => a + b, 0)
  if (left.length !== total) throw new RangeError(`${left.length} cards are left, not ${total}`)
  const pack = Pack.restore({ order: left, drawn: 0 }, rng)
  pack.shuffle()
  pack.cut()
  return { significator: previous.significator, order: [...pack.snapshot().order], draws: total, turns: [...method.packets.sizes] }
}
