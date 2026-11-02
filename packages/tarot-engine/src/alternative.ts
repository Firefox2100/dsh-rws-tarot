import { getMethod } from '@dsh-rws-tarot/data'
import { Pack, shuffled, type Placed } from './pack.ts'
import { randomInt, type Rng } from './rng.ts'

export interface AlternativeOptions {
  /** Whose card stands for the Querent: the Magician for a man, the High Priestess for a woman. */
  readonly sex: 'male' | 'female'
  readonly rng: Rng
  /** Chance each card is turned round in the shuffle; the book turns some, so a value above 0 follows it. */
  readonly reversals: number
}

export interface AlternativeStart {
  /** The Querent's card, laid face up beside the first line once the layout is down. */
  readonly significator: Placed
  /** The 42 cards of the layout in reading order (line by line, each from the right), then the cards left in the pack. */
  readonly order: Placed[]
  readonly draws: number
  /** A turn shows one line. */
  readonly turns: number[]
}

/**
 * Prepare the Alternative Method: shuffle and cut, deal six packets of seven, stack them into seven packets of six, and
 * lay each group of cards from the tops of those packets, shuffled, in lines of seven. The Querent's card is taken out
 * only afterwards; if it was in the layout a card haphazardly drawn from the undealt cards takes its place.
 */
export function startAlternative(options: AlternativeOptions): AlternativeStart {
  const method = getMethod('alternative')
  const { packets, perPacket } = method.dealing
  const pack = Pack.create({ rng: options.rng, reversals: options.reversals })
  pack.cut()
  const all = pack.snapshot().order
  const dealt = all.slice(0, packets * perPacket)
  const undealt = all.slice(dealt.length)

  // Each new packet holds one card of every dealt packet, the last packet's on top.
  const stacks = Array.from({ length: perPacket }, (_, column) => Array.from({ length: packets }, (_, packet) => dealt[(packets - 1 - packet) * perPacket + column]!))
  const laid: Placed[] = []
  let taken = 0
  for (const group of method.layout) {
    const cards = stacks.flatMap(stack => stack.slice(taken, taken + group.fromEach))
    laid.push(...shuffled(cards, options.rng))
    taken += group.fromEach
  }

  const cardId = options.sex === 'male' ? method.querent.male : method.querent.female
  const at = laid.findIndex(p => p.cardId === cardId)
  if (at >= 0) {
    const [replacement] = undealt.splice(randomInt(options.rng, undealt.length), 1)
    laid[at] = replacement!
  } else {
    undealt.splice(undealt.findIndex(p => p.cardId === cardId), 1)
  }
  return { significator: { cardId, reversed: false }, order: [...laid, ...undealt], draws: laid.length, turns: Array.from({ length: laid.length / method.dealing.perPacket }, () => method.dealing.perPacket) }
}
