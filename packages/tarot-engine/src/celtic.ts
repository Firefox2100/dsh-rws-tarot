import { cards, getMethod, type Rank, type Suit } from '@dsh-rws-tarot/data'
import { fullDeck, without } from './deck.ts'
import { Pack, type Placed } from './pack.ts'
import type { Rng } from './rng.ts'

/** A person or matter the book names a Significator for: by sex and by whether the person is over forty. */
export interface Person {
  readonly sex: 'male' | 'female'
  readonly fortyOrOver: boolean
}

/** The court rank the book gives a person: Knight for a man of forty and upward, King for a younger male, Queen for a woman over forty, Page for a younger female. */
export function rankFor(person: Person): Rank {
  if (person.sex === 'male') return person.fortyOrOver ? 'knight' : 'king'
  return person.fortyOrOver ? 'queen' : 'page'
}

/** The court card for a person of the given colouring (the suit); the book allows the Diviner to judge temperament instead. */
export function significatorFor(person: Person, suit: Suit): string {
  const rank = rankFor(person)
  const card = cards.find(c => c.suit === suit && c.rank === rank)
  if (card === undefined) throw new Error(`no ${rank} of ${suit} in the data`)
  return card.id
}

export interface CelticStart {
  readonly significator: Placed
  readonly facing: 'left' | 'right'
  /** The pack that remains, shuffled and cut as the book instructs, in the order the cards will be turned up. */
  readonly order: Placed[]
  readonly draws: number
}

export interface CelticOptions {
  readonly significatorId: string
  /** The side the Significator faces; the book leaves a Trump or small card to the Diviner's choice. */
  readonly facing: 'left' | 'right'
  readonly rng: Rng
  /** Chance each card is turned the other way up; the book's method does not turn cards, so 0 follows it exactly. */
  readonly reversals: number
}

/**
 * Prepare the Ancient Celtic Method: the Significator is laid aside face up, then the rest of the pack is shuffled and
 * cut the number of times the book gives.
 */
export function startCeltic(options: CelticOptions): CelticStart {
  const method = getMethod('celtic')
  const pack = Pack.create({ deck: without(fullDeck(), [options.significatorId]), rng: options.rng, reversals: options.reversals, shuffle: false })
  for (let i = 0; i < method.preparation.shuffleAndCutTimes; i++) {
    pack.shuffle()
    pack.cut()
  }
  if (options.reversals > 0) pack.turnSome(options.reversals)
  return {
    significator: { cardId: options.significatorId, reversed: false },
    facing: options.facing,
    order: [...pack.snapshot().order],
    draws: method.positions.length,
  }
}
