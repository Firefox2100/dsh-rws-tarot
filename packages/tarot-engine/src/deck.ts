import { cards, hasCard } from '@dsh-rws-tarot/data'

/** An unordered set of cards a pack is made from, listed in the book's order. */
export type Deck = readonly string[]

/** The full pack: all 78 cards. */
export function fullDeck(): Deck {
  return cards.map(c => c.id)
}

/** A sub-deck made of the given cards; unknown or repeated ids are an error. Order follows the book, not the argument. */
export function subDeck(ids: Iterable<string>): Deck {
  const wanted = new Set<string>()
  for (const id of ids) {
    if (!hasCard(id)) throw new RangeError(`subDeck: unknown card id ${JSON.stringify(id)}`)
    if (wanted.has(id)) throw new RangeError(`subDeck: card ${id} listed twice`)
    wanted.add(id)
  }
  return cards.filter(c => wanted.has(c.id)).map(c => c.id)
}

/** The deck without the given cards, e.g. the rest of the pack once a Significator is chosen. */
export function without(deck: Deck, ids: Iterable<string>): Deck {
  const removed = new Set(ids)
  for (const id of removed) if (!deck.includes(id)) throw new RangeError(`without: card ${id} is not in the deck`)
  return deck.filter(id => !removed.has(id))
}
