import { getCard, recurrence, type Rank, type Recurrence } from '@dsh-rws-tarot/data'
import type { Placed } from './pack.ts'

const countOf = (cards: readonly Placed[], rank: Rank, reversed: boolean): number =>
  cards.filter(p => p.reversed === reversed && getCard(p.cardId).rank === rank).length

/**
 * The book's recurrences the cards of `fresh` bring about: every rank (upright or reversed alike) of which two or more
 * now lie on the table where `before` held fewer. Only the Lesser Arcana have a rank.
 */
export function newRecurrences(before: readonly Placed[], fresh: readonly Placed[]): Recurrence[] {
  const all = [...before, ...fresh]
  const found: Recurrence[] = []
  for (const rank of new Set(fresh.map(p => getCard(p.cardId).rank))) {
    if (rank === null) continue
    for (const reversed of [false, true]) {
      const now = countOf(all, rank, reversed)
      if (now < 2 || now === countOf(before, rank, reversed)) continue
      const entry = recurrence(rank, now, reversed)
      if (entry !== undefined) found.push(entry)
    }
  }
  return found
}
