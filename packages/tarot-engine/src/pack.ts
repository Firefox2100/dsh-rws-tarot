import { randomInt, seededRng, type Rng } from './rng.ts'
import { fullDeck, type Deck } from './deck.ts'
import { getCard } from '@dsh-rws-tarot/data'

/** A card as it lies in the pack or on the table. `reversed` means turned the other way up. */
export interface Placed {
  readonly cardId: string
  readonly reversed: boolean
}

/** A card taken from the pack, numbered in the order of drawing across the pack's whole life. */
export interface Drawn extends Placed {
  readonly index: number
}

/** The complete state of a pack as plain JSON; a pack restored from it continues exactly where it stood. */
export interface PackState {
  readonly order: readonly Placed[]
  readonly drawn: number
}

export interface PackOptions {
  /** Cards the pack is made of; defaults to all 78. */
  readonly deck?: Deck
  readonly rng: Rng
  /** Shuffle on creation; default true. */
  readonly shuffle?: boolean
  /** Chance that each card is turned over while shuffling, 0 for none. Required: the book's methods differ on this. */
  readonly reversals: number
}

function checkChance(p: number): void {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`reversals must be between 0 and 1, got ${p}`)
}

/**
 * A pack of cards lying face down. The top is index `drawn` of `order`; drawing moves the cursor and never reorders,
 * so everything drawn so far stays readable as `order.slice(0, drawn)`.
 */
export class Pack {
  #order: Placed[]
  #drawn: number
  readonly #rng: Rng

  private constructor(order: Placed[], drawn: number, rng: Rng) {
    this.#order = order
    this.#drawn = drawn
    this.#rng = rng
  }

  /** A pack from a deck. With `shuffle`, the cards are shuffled and each is turned over with chance `reversals`. */
  static create(options: PackOptions): Pack {
    checkChance(options.reversals)
    const deck = options.deck ?? fullDeck()
    if (new Set(deck).size !== deck.length) throw new RangeError('a deck cannot hold a card twice')
    for (const id of deck) getCard(id)
    const pack = new Pack(deck.map(cardId => ({ cardId, reversed: false })), 0, options.rng)
    if (options.shuffle ?? true) {
      pack.shuffle()
      pack.turnSome(options.reversals)
    }
    return pack
  }

  /** The same, reproducible from a seed: equal `(deck, seed, reversals)` give equal packs. */
  static seeded(seed: string | number, options: Omit<PackOptions, 'rng'>): Pack {
    return Pack.create({ ...options, rng: seededRng(seed) })
  }

  /** Continue a pack from a saved state; the generator only serves later shuffles, cuts and turns. */
  static restore(state: PackState, rng: Rng): Pack {
    if (!Number.isInteger(state.drawn) || state.drawn < 0 || state.drawn > state.order.length) throw new RangeError('pack state: drawn is out of range')
    if (new Set(state.order.map(p => p.cardId)).size !== state.order.length) throw new RangeError('pack state: a card appears twice')
    for (const p of state.order) getCard(p.cardId)
    return new Pack(state.order.map(p => ({ cardId: p.cardId, reversed: p.reversed })), state.drawn, rng)
  }

  get remaining(): number {
    return this.#order.length - this.#drawn
  }

  /** Everything drawn so far, in order. */
  get drawn(): readonly Drawn[] {
    return this.#order.slice(0, this.#drawn).map((p, index) => ({ ...p, index }))
  }

  /** Cards still in the pack, top first. Reading them is for the engine's callers; a diviner does not see them. */
  get undrawn(): readonly Placed[] {
    return this.#order.slice(this.#drawn).map(p => ({ ...p }))
  }

  /** The next `n` cards from the top. Throws without changing anything when fewer than `n` remain. */
  draw(n: number): Drawn[] {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`draw: n must be a non-negative integer, got ${n}`)
    if (n > this.remaining) throw new RangeError(`draw: asked for ${n} cards but only ${this.remaining} remain`)
    const start = this.#drawn
    this.#drawn += n
    return this.#order.slice(start, this.#drawn).map((p, i) => ({ ...p, index: start + i }))
  }

  /** Shuffle the undrawn cards (Fisher-Yates). */
  shuffle(): void {
    const rest = this.#order.slice(this.#drawn)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = randomInt(this.#rng, i + 1)
      ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
    }
    this.#order = [...this.#order.slice(0, this.#drawn), ...rest]
  }

  /**
   * Cut the undrawn cards: the top `at` cards go beneath the rest. Without `at`, a random cut leaving at least one
   * card on each side (the Querent supplies `at` when the book has him cut).
   */
  cut(at?: number): void {
    const rest = this.#order.slice(this.#drawn)
    if (rest.length < 2) throw new RangeError('cut: fewer than two cards remain')
    const where = at ?? 1 + randomInt(this.#rng, rest.length - 1)
    if (!Number.isInteger(where) || where < 1 || where > rest.length - 1) throw new RangeError(`cut: position must be between 1 and ${rest.length - 1}, got ${where}`)
    this.#order = [...this.#order.slice(0, this.#drawn), ...rest.slice(where), ...rest.slice(0, where)]
  }

  /** Turn each undrawn card over with the given chance ("turn some of the cards round"). */
  turnSome(chance: number): void {
    checkChance(chance)
    this.#order = this.#order.map((p, i) => i >= this.#drawn && this.#rng.next() < chance ? { ...p, reversed: !p.reversed } : p)
  }

  /** Take a named card out of the undrawn cards without drawing it, e.g. the Significator. It keeps its orientation. */
  take(cardId: string): Placed {
    const at = this.#order.findIndex((p, i) => i >= this.#drawn && p.cardId === cardId)
    if (at < 0) throw new RangeError(`take: card ${cardId} is not among the undrawn cards`)
    const [card] = this.#order.splice(at, 1)
    return { ...card! }
  }

  snapshot(): PackState {
    return { order: this.#order.map(p => ({ ...p })), drawn: this.#drawn }
  }
}
